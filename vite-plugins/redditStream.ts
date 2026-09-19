import { loadEnv, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
    DEFAULT_STREAM_URL,
    STREAM_EVENTS,
    normalizeQuery,
    normalizeSubreddit,
    parseAtomFeed,
    parseListing,
    upstreamRequest,
    type RedditPost,
    type StreamTarget,
} from '../src/widgets/reddit/posts.ts';

/**
 * Reddit has no push API, so this bridges it to SSE for the Reddit widget: each
 * connection polls Reddit server-side and emits a `snapshot` event followed by
 * one `post` event per new submission.
 *
 * Running the poll here rather than in the browser sidesteps CORS, and lets us
 * send the descriptive User-Agent Reddit requires. Each poll uses the richest
 * source available, in order:
 *
 *   1. OAuth JSON (oauth.reddit.com) when REDDIT_CLIENT_ID and
 *      REDDIT_CLIENT_SECRET are set (env or .env, from a Reddit "script" or
 *      "web" app). Reliable, ~100 requests/min, includes score, comments,
 *      thumbnails and post bodies.
 *   2. Plain www.reddit.com JSON. Reddit answers this with 403 for many
 *      unauthenticated clients; on a 403 we stop trying it for 30 minutes.
 *   3. The Atom feed, which is still served unauthenticated but carries only
 *      title/author/link/time and allows about one request per minute per IP.
 *
 * Only wired into `vite dev` / `vite preview`; a static deployment needs the
 * same endpoint hosted elsewhere and the widget's "Stream URL" pointed at it.
 *
 * One upstream poll per open connection - fine for a personal dashboard, but
 * share pollers per target before exposing this to many users.
 */

const KEEPALIVE_MS = 20_000;
const LISTING_LIMIT = 25;
const MAX_SEEN = 1000;
const JSON_RETRY_AFTER_BLOCK_MS = 30 * 60_000;
const USER_AGENT = 'web:fastboard-reddit-widget:1.0 (SSE dashboard bridge)';
const WWW = 'https://www.reddit.com';

// Poll cadence per source, in ms. Atom's is dictated by its ~1 request/minute
// limit (x-ratelimit-* headers), shared across every connection from this IP.
const POLL_MS = { oauth: 15_000, json: 30_000, atom: 62_000 } as const;
const RATE_LIMITED_POLL_MS = 60_000;

type Source = keyof typeof POLL_MS;
type Credentials = { id: string; secret: string };

let credentials: Credentials | undefined;
let jsonBlockedUntil = 0;
let token: { value: string; expiresAt: number } | undefined;

const getToken = async (creds: Credentials, signal: AbortSignal): Promise<string> => {
    if (token && Date.now() < token.expiresAt) return token.value;
    const res = await fetch(`${WWW}/api/v1/access_token`, {
        method: 'POST',
        signal,
        headers: {
            'User-Agent': USER_AGENT,
            Authorization: `Basic ${Buffer.from(`${creds.id}:${creds.secret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
    if (!res.ok || !body.access_token) throw new Error(`Reddit rejected the OAuth credentials (${res.status})`);
    token = { value: body.access_token, expiresAt: Date.now() + ((body.expires_in ?? 3600) - 60) * 1000 };
    return token.value;
};

type Fetched = { posts: RedditPost[]; source: Source } | { failed: Response };

const fetchPosts = async (target: StreamTarget, signal: AbortSignal): Promise<Fetched> => {
    const { path, params } = upstreamRequest(target, LISTING_LIMIT);
    const get = (url: string, headers: Record<string, string>) =>
        fetch(url, { signal, headers: { 'User-Agent': USER_AGENT, ...headers } });

    if (credentials) {
        const bearer = await getToken(credentials, signal);
        const res = await get(`https://oauth.reddit.com${path}?${params}&raw_json=1`, {
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
        });
        if (res.ok) return { posts: parseListing(await res.json()), source: 'oauth' };
        if (res.status === 401) token = undefined; // expired early; re-mint on the next poll
        return { failed: res };
    }

    if (Date.now() >= jsonBlockedUntil) {
        const res = await get(`${WWW}${path}.json?${params}&raw_json=1`, { Accept: 'application/json' });
        if (res.ok) return { posts: parseListing(await res.json()), source: 'json' };
        if (res.status === 403) jsonBlockedUntil = Date.now() + JSON_RETRY_AFTER_BLOCK_MS;
        else return { failed: res };
    }

    const res = await get(`${WWW}${path}.rss?${params}`, { Accept: 'application/atom+xml' });
    if (!res.ok) return { failed: res };
    return { posts: parseAtomFeed(await res.text()), source: 'atom' };
};

const send = (res: ServerResponse, event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

const describeFailure = (upstream: Response, target: StreamTarget): string => {
    if (upstream.status === 404 && target.subreddit && !target.query) {
        return `r/${target.subreddit} was not found (or is private/banned)`;
    }
    return `Reddit responded ${upstream.status}`;
};

const streamTarget = (req: IncomingMessage, res: ServerResponse, target: StreamTarget) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n\n');

    const abort = new AbortController();
    const seen = new Set<string>();
    let first = true;
    let failing = false;
    let timer: NodeJS.Timeout | undefined;

    const poll = async () => {
        let delay: number = POLL_MS.atom;
        try {
            const result = await fetchPosts(target, abort.signal);
            if ('failed' in result) {
                failing = true;
                if (result.failed.status === 429) {
                    const reset = Number(result.failed.headers.get('x-ratelimit-reset'));
                    delay = reset > 0 ? (reset + 1) * 1000 : RATE_LIMITED_POLL_MS;
                }
                send(res, STREAM_EVENTS.streamError, { message: describeFailure(result.failed, target) });
            } else {
                const { posts, source } = result;
                delay = POLL_MS[source];
                if (failing) {
                    failing = false;
                    send(res, STREAM_EVENTS.streamOk, null);
                }
                if (first) {
                    first = false;
                    send(res, STREAM_EVENTS.snapshot, posts);
                } else {
                    // Listing is newest-first; emit oldest-first so the client sees them in order.
                    for (const p of posts.filter((p) => !seen.has(p.id)).reverse()) send(res, STREAM_EVENTS.post, p);
                }
                for (const p of posts) seen.add(p.id);
                // Set iterates in insertion order, so this drops the oldest entries.
                while (seen.size > MAX_SEEN) seen.delete(seen.values().next().value as string);
            }
        } catch (err) {
            if (abort.signal.aborted) return;
            failing = true;
            send(res, STREAM_EVENTS.streamError, { message: (err as Error).message });
        }
        if (!abort.signal.aborted) timer = setTimeout(poll, delay);
    };

    const keepalive = setInterval(() => res.write(': keepalive\n\n'), KEEPALIVE_MS);
    req.on('close', () => {
        abort.abort();
        clearTimeout(timer);
        clearInterval(keepalive);
    });
    void poll();
};

const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== DEFAULT_STREAM_URL) return next();
    const rawSub = url.searchParams.get('subreddit');
    const subreddit = normalizeSubreddit(rawSub);
    const query = normalizeQuery(url.searchParams.get('q'));
    if ((rawSub && !subreddit) || (!subreddit && !query)) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Provide a valid "subreddit" and/or a "q" search query');
        return;
    }
    streamTarget(req, res, { subreddit: subreddit ?? undefined, query: query ?? undefined });
};

export default function redditStream(): Plugin {
    return {
        name: 'fastboard-reddit-stream',
        configResolved(config) {
            // Vite only exposes VITE_-prefixed vars to the client; these must stay server-side.
            const env = loadEnv(config.mode, config.envDir || config.root, '');
            const id = env.REDDIT_CLIENT_ID;
            const secret = env.REDDIT_CLIENT_SECRET;
            credentials = id && secret ? { id, secret } : undefined;
        },
        configureServer: (server) => void server.middlewares.use(handler),
        configurePreviewServer: (server) => void server.middlewares.use(handler),
    };
}
