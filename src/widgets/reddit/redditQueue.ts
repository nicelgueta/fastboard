import {
    LISTING_LIMIT,
    parseAtomFeed,
    parseListing,
    upstreamRequest,
    type RedditPost,
    type StreamTarget,
} from './posts';

// The browser-side fallback for the Reddit widget, used when fastboard-server can't supply the
// stream (no server, or no Reddit credentials on it). Reddit throttles per IP, so every request
// from every open widget goes through the one queue below: a single task that makes one request
// at a time, spaced out, and shares a result between widgets following the same target.

const WWW = 'https://www.reddit.com';
const JSON_BLOCK_MS = 30 * 60_000;
/** Minimum gap between any two requests, by the source the next one will use. Atom is limited to about one a minute. */
const GAP_MS = { json: 6_000, atom: 62_000 } as const;
/** How soon a target is polled again after a success, by source. */
const POLL_MS = { json: 30_000, atom: 62_000 } as const;
const RETRY_MS = 30_000;

type Source = keyof typeof GAP_MS;

export interface FeedListener {
    /** The target's current listing, newest first; sent when its newest post changes. */
    onPosts(posts: RedditPost[]): void;
    /** A poll failed (message), or a later one succeeded (undefined). */
    onError(message: string | undefined): void;
}

interface Entry {
    target: StreamTarget;
    listeners: Set<FeedListener>;
    dueAt: number;
    latest?: RedditPost[];
    error?: string;
}

interface Deps {
    fetch: typeof fetch;
    now: () => number;
}

class HttpError extends Error {
    constructor(readonly status: number) {
        super(`Reddit responded ${status}`);
    }
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';
const targetKey = (t: StreamTarget) => `${t.subreddit?.toLowerCase() ?? ''}|${t.query ?? ''}`;

export class RedditRequestQueue {
    private entries = new Map<string, Entry>();
    private running = false;
    private inflight?: AbortController;
    private wake?: () => void;
    /** Earliest time the next request may go out. */
    private slotAt = 0;
    private jsonBlockedUntil = 0;

    constructor(private deps: Deps = { fetch: (input, init) => fetch(input, init), now: Date.now }) {}

    /** Follow a target until the returned function is called. The first listing is sent as soon as the queue reaches it. */
    subscribe(target: StreamTarget, listener: FeedListener): () => void {
        const key = targetKey(target);
        let entry = this.entries.get(key);
        if (!entry) {
            entry = { target, listeners: new Set(), dueAt: 0 };
            this.entries.set(key, entry);
        }
        entry.listeners.add(listener);
        if (entry.latest) listener.onPosts(entry.latest);
        if (entry.error) listener.onError(entry.error);
        this.wake?.();
        if (!this.running) void this.run();

        return () => {
            entry.listeners.delete(listener);
            if (entry.listeners.size === 0 && this.entries.get(key) === entry) this.entries.delete(key);
            if (this.entries.size === 0) this.inflight?.abort();
            this.wake?.();
        };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            const done = () => {
                clearTimeout(timer);
                this.wake = undefined;
                resolve();
            };
            const timer = setTimeout(done, ms);
            this.wake = done;
        });
    }

    private async run() {
        this.running = true;
        try {
            while (this.entries.size > 0) {
                const next = [...this.entries.values()].reduce((a, b) => (b.dueAt < a.dueAt ? b : a));
                const wait = Math.max(next.dueAt, this.slotAt) - this.deps.now();
                if (wait > 0) {
                    await this.sleep(wait); // cut short when a target is added or removed
                    continue;
                }
                await this.poll(next);
            }
        } finally {
            this.running = false;
        }
    }

    private async poll(entry: Entry) {
        const ctl = (this.inflight = new AbortController());
        let source: Source = this.jsonBlocked() ? 'atom' : 'json';
        try {
            const result = await this.fetchPosts(entry.target, ctl.signal);
            source = result.source;
            if (!this.isLive(entry)) return;
            entry.dueAt = this.deps.now() + POLL_MS[source];
            const changed = result.posts[0]?.id !== entry.latest?.[0]?.id;
            if (result.posts.length > 0 && changed) {
                entry.latest = result.posts;
                entry.listeners.forEach((l) => l.onPosts(result.posts));
            }
            if (entry.error) {
                entry.error = undefined;
                entry.listeners.forEach((l) => l.onError(undefined));
            }
        } catch (e) {
            if (isAbort(e) || !this.isLive(entry)) return;
            entry.dueAt = this.deps.now() + RETRY_MS;
            entry.error = describeFailure(e, entry.target);
            entry.listeners.forEach((l) => l.onError(entry.error));
        } finally {
            this.slotAt = this.deps.now() + GAP_MS[this.jsonBlocked() ? 'atom' : source];
            if (this.inflight === ctl) this.inflight = undefined;
        }
    }

    private isLive(entry: Entry) {
        return this.entries.get(targetKey(entry.target)) === entry;
    }

    private jsonBlocked() {
        return this.deps.now() < this.jsonBlockedUntil;
    }

    // Reddit answers many unauthenticated .json requests with 403 (and browsers can hit CORS or network
    // errors), while the Atom feed is still served. So try JSON, remember when it's refused, and use Atom
    // - which has no score, comment count, flair or NSFW flag - until the block lapses.
    private async fetchPosts(target: StreamTarget, signal: AbortSignal): Promise<{ posts: RedditPost[]; source: Source }> {
        const { path, params } = upstreamRequest(target, LISTING_LIMIT);
        if (!this.jsonBlocked()) {
            try {
                const res = await this.deps.fetch(`${WWW}${path}.json?${params}&raw_json=1`, { signal, headers: { Accept: 'application/json' } });
                if (res.ok) return { posts: parseListing(await res.json()), source: 'json' };
                if (res.status !== 403) throw new HttpError(res.status);
            } catch (e) {
                if (isAbort(e) || e instanceof HttpError) throw e;
            }
            this.jsonBlockedUntil = this.deps.now() + JSON_BLOCK_MS;
        }
        let res: Response;
        try {
            res = await this.deps.fetch(`${WWW}${path}.rss?${params}`, { signal, headers: { Accept: 'application/atom+xml' } });
        } catch (e) {
            if (isAbort(e)) throw e;
            throw new Error('Could not reach Reddit from the browser (offline, or blocked by CORS)');
        }
        if (!res.ok) throw new HttpError(res.status);
        return { posts: parseAtomFeed(await res.text()), source: 'atom' };
    }
}

const describeFailure = (e: unknown, target: StreamTarget): string => {
    if (e instanceof HttpError && e.status === 404 && target.subreddit && !target.query) {
        return `r/${target.subreddit} was not found (or is private/banned)`;
    }
    return e instanceof Error ? e.message : 'Reddit request failed';
};

/** The one queue every Reddit widget in the app goes through. */
export const redditQueue = new RedditRequestQueue();
