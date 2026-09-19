// Pure helpers shared by the Reddit widget (browser) and the SSE bridge
// (vite-plugins/redditStream.ts, node). Keep this file free of DOM/node imports.

export interface RedditPost {
    /** Reddit fullname, e.g. "t3_abc123". Unique - used as the dedupe key. */
    id: string;
    title: string;
    author: string;
    subreddit: string;
    /** Absolute link to the comments page. */
    permalink: string;
    /** The linked URL for link posts; equals permalink for self posts. */
    url: string;
    createdUtc: number;
    isSelf: boolean;
    // score, numComments, flair, over18 and postHint are only present when the post
    // came from Reddit's JSON API (OAuth or plain); the Atom fallback carries none.
    score?: number;
    numComments?: number;
    flair?: string;
    over18?: boolean;
    /** Reddit's post_hint: image | link | self | hosted:video | rich:video ... */
    postHint?: string;
    /** Absolute http(s) thumbnail URL, when Reddit has one. */
    thumbnail?: string;
    /** Markdown body of a self post, capped at MAX_SELFTEXT. */
    selftext?: string;
}

export const MAX_SELFTEXT = 8000;

/** Wire format of the bridge's SSE events. */
export const STREAM_EVENTS = {
    /** data: RedditPost[] - the current front of /new, sent once per connection. */
    snapshot: 'snapshot',
    /** data: RedditPost - a post not seen before on this connection. */
    post: 'post',
    /** data: { message: string } - the upstream poll failed; the stream keeps retrying. */
    streamError: 'stream-error',
    /** No data - a poll succeeded after one or more failures, so the client can clear its error. */
    streamOk: 'stream-ok',
} as const;

export const DEFAULT_STREAM_URL = '/api/reddit/stream';
export const DEFAULT_SUBREDDIT = 'programming';
export const DEFAULT_MAX_POSTS = 100;
export const MAX_POSTS_OPTIONS = [25, 50, 100, 250, 500];

const NAME = '[A-Za-z0-9_]{1,21}';
const SUBREDDIT_RE = new RegExp(`^${NAME}(\\+${NAME})*$`);

/**
 * Accepts "python", "r/python", "/r/python/" and "a+b" multi-reddits; returns
 * the bare name or null if it isn't a valid subreddit. The result is spliced
 * into an upstream URL on the server, so this is the injection guard.
 */
export const normalizeSubreddit = (input: string | undefined | null): string | null => {
    const s = (input ?? '').trim().replace(/^\/?r\//i, '').replace(/\/+$/, '');
    return SUBREDDIT_RE.test(s) ? s : null;
};

/** Optional search text. Trimmed and length-capped; null when empty. */
export const normalizeQuery = (input: string | undefined | null): string | null => {
    const q = (input ?? '').trim().slice(0, 200);
    return q || null;
};

/** What a stream follows: a subreddit's new posts, a search, or both (search within a subreddit). At least one is set. */
export interface StreamTarget {
    subreddit?: string;
    query?: string;
}

export const buildStreamUrl = (base: string, target: StreamTarget): string => {
    const params = new URLSearchParams();
    if (target.subreddit) params.set('subreddit', target.subreddit);
    if (target.query) params.set('q', target.query);
    return `${base}${base.includes('?') ? '&' : '?'}${params}`;
};

/**
 * Where to read a target's newest posts on Reddit: a path (no extension) and
 * its query params. Callers append `.json` or `.rss` (or use the path as-is on
 * oauth.reddit.com). All values are URL-encoded by URLSearchParams.
 */
export const upstreamRequest = (target: StreamTarget, limit: number): { path: string; params: URLSearchParams } => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (!target.query) return { path: `/r/${target.subreddit}/new`, params };
    params.set('q', target.query);
    params.set('sort', 'new');
    if (target.subreddit) params.set('restrict_sr', '1');
    return { path: target.subreddit ? `/r/${target.subreddit}/search` : '/search', params };
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const decodeEntities = (s: string): string =>
    s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, dec, hex, name) => {
        if (dec) return String.fromCodePoint(Number(dec));
        if (hex) return String.fromCodePoint(parseInt(hex, 16));
        return ENTITIES[name.toLowerCase()] ?? m;
    });

const tagText = (xml: string, tag: string): string | undefined => {
    const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml);
    return m ? decodeEntities(m[1]) : undefined;
};

/**
 * The small HTML subset Reddit renders post bodies with (paragraphs, headings,
 * lists, emphasis, links, code, quotes, tables) -> markdown. Anything else is
 * stripped to its text. Entities are decoded last so escaped text like
 * "&lt;div&gt;" survives the tag strip.
 */
export const htmlToMarkdown = (html: string): string => {
    const md = html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<pre[^>]*>\s*(?:<code[^>]*>)?([\s\S]*?)(?:<\/code>)?\s*<\/pre>/gi, (_, code) => `\n\n\`\`\`\n${code.replace(/<[^>]+>/g, '')}\n\`\`\`\n\n`)
        .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
        .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
        .replace(/<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
        .replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
        .replace(/<(?:del|s)>([\s\S]*?)<\/(?:del|s)>/gi, '~~$1~~')
        .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${'#'.repeat(Number(n))} ${t}\n\n`)
        .replace(/<li[^>]*>/gi, '\n- ')
        .replace(/<blockquote[^>]*>/gi, '\n\n> ')
        .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
        .replace(/<br\s*\/?>/gi, '  \n')
        .replace(/<\/(?:p|ul|ol|blockquote|div)>/gi, '\n\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<\/t[dh]>/gi, ' | ')
        .replace(/<[^>]+>/g, '');
    return decodeEntities(md).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
};

/**
 * Reddit's Atom feed (/r/<sub>/new.rss) -> posts, newest first (the feed's own
 * order). We use Atom because Reddit answers unauthenticated .json listing
 * requests with 403, while the feed is still served. The trade-off is that
 * Atom carries no score, comment count, flair or NSFW flag, but does include the
 * post body (as HTML, converted here) and, for link posts, a thumbnail. Entries missing an
 * id or title are skipped; anything that isn't a feed yields [].
 */
export const parseAtomFeed = (xml: string): RedditPost[] => {
    const posts: RedditPost[] = [];
    for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const e = m[1];
        const id = tagText(e, 'id');
        const title = tagText(e, 'title');
        if (!id || !title) continue;
        const permalink = /<link\s+href="([^"]+)"/.exec(e)?.[1];
        const content = tagText(e, 'content') ?? '';
        // Link posts carry their outbound URL in the [link] anchor; self posts point back at the thread.
        const outboundRaw = /<a href="([^"]+)">\[link\]<\/a>/.exec(content)?.[1];
        // The HTML inside <content> is itself escaped, so the href needs a second decode.
        const outbound = outboundRaw && decodeEntities(outboundRaw);
        const published = Date.parse(tagText(e, 'published') ?? tagText(e, 'updated') ?? '');
        const link = decodeEntities(permalink ?? '');
        // Self posts wrap their body in <div class="md">; link posts have no such block.
        const body = /<div class="md">([\s\S]*?)<\/div>\s*<!-- SC_ON -->/.exec(content)?.[1];
        const thumbnail = /<media:thumbnail\s+url="([^"]+)"/.exec(e)?.[1];
        posts.push({
            id,
            title: title.trim(),
            author: (tagText(e, 'name') ?? '[deleted]').replace(/^\/u\//, '').trim(),
            subreddit: /<category term="([^"]*)"/.exec(e)?.[1] ?? '',
            permalink: link,
            url: outbound ?? link,
            createdUtc: Number.isNaN(published) ? 0 : Math.floor(published / 1000),
            isSelf: !outbound || outbound === link,
            thumbnail: thumbnail ? decodeEntities(thumbnail) : undefined,
            selftext: (body && htmlToMarkdown(body).slice(0, MAX_SELFTEXT)) || undefined,
        });
    }
    return posts;
};

interface ListingChild {
    data?: Record<string, unknown>;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/**
 * Reddit JSON listing (request with raw_json=1 so text is unescaped) -> posts,
 * newest first. Skips malformed children; anything that isn't a listing yields [].
 */
export const parseListing = (json: unknown): RedditPost[] => {
    const children = (json as { data?: { children?: ListingChild[] } })?.data?.children;
    if (!Array.isArray(children)) return [];
    const posts: RedditPost[] = [];
    for (const c of children) {
        const d = c?.data;
        if (!d || typeof d.name !== 'string' || typeof d.title !== 'string') continue;
        const permalink = `https://www.reddit.com${String(d.permalink ?? '')}`;
        const isSelf = !!d.is_self;
        const thumb = str(d.thumbnail);
        posts.push({
            id: d.name,
            title: d.title,
            author: String(d.author ?? '[deleted]'),
            subreddit: String(d.subreddit ?? ''),
            permalink,
            url: isSelf || typeof d.url !== 'string' ? permalink : d.url,
            createdUtc: Number(d.created_utc ?? 0),
            isSelf,
            score: Number(d.score ?? 0),
            numComments: Number(d.num_comments ?? 0),
            flair: str(d.link_flair_text),
            over18: !!d.over_18,
            thumbnail: thumb && /^https?:\/\//.test(thumb) ? thumb : undefined,
            postHint: str(d.post_hint),
            selftext: str(d.selftext)?.replace(/&#x200B;/g, '').slice(0, MAX_SELFTEXT),
        });
    }
    return posts;
};

/**
 * Prepend `incoming` (newest first) to `existing` (newest first), dropping
 * duplicates - an id already present keeps its slot but takes the fresher
 * fields - and cap at `max`.
 */
export const mergePosts = (existing: RedditPost[], incoming: RedditPost[], max: number): RedditPost[] => {
    const fresh = new Map(incoming.map((p) => [p.id, p]));
    const kept = existing.map((p) => fresh.get(p.id) ?? p);
    const known = new Set(existing.map((p) => p.id));
    const added = incoming.filter((p) => !known.has(p.id));
    return [...added, ...kept].slice(0, Math.max(1, max));
};

export type PostSort = 'new' | 'old' | 'top' | 'comments' | 'title';
export const DEFAULT_SORT: PostSort = 'new';

export const SORT_OPTIONS: { value: PostSort; label: string }[] = [
    { value: 'new', label: 'Newest' },
    { value: 'old', label: 'Oldest' },
    { value: 'top', label: 'Top score' },
    { value: 'comments', label: 'Most comments' },
    { value: 'title', label: 'Title A-Z' },
];

/** Score and comment counts come only from Reddit's JSON API; the Atom fallback has neither. */
export const sortNeedsCounts = (sort: PostSort): boolean => sort === 'top' || sort === 'comments';
export const hasCounts = (posts: RedditPost[]): boolean =>
    posts.some((p) => p.score !== undefined || p.numComments !== undefined);

/** Normalise a persisted value: anything unknown (a hand-edited board, an older version) falls back to newest. */
export const asPostSort = (v: unknown): PostSort =>
    SORT_OPTIONS.some((o) => o.value === v) ? (v as PostSort) : DEFAULT_SORT;

/**
 * A new array in the requested order; the input is not touched. Ties (and posts
 * with no count under a count sort) fall back to newest first, and posts missing
 * the count go after those that have it, so a partly-populated feed still reads
 * sensibly. `post.id` is the final tiebreak so the order is fully deterministic.
 */
export const sortPosts = (posts: RedditPost[], sort: PostSort): RedditPost[] => {
    const byNewest = (a: RedditPost, b: RedditPost) => b.createdUtc - a.createdUtc || a.id.localeCompare(b.id);
    const byCount = (pick: (p: RedditPost) => number | undefined) => (a: RedditPost, b: RedditPost) => {
        const x = pick(a);
        const y = pick(b);
        if (x === undefined && y === undefined) return byNewest(a, b);
        if (x === undefined) return 1;
        if (y === undefined) return -1;
        return y - x || byNewest(a, b);
    };
    const cmp =
        sort === 'old' ? (a: RedditPost, b: RedditPost) => a.createdUtc - b.createdUtc || a.id.localeCompare(b.id)
        : sort === 'top' ? byCount((p) => p.score)
        : sort === 'comments' ? byCount((p) => p.numComments)
        : sort === 'title' ? (a: RedditPost, b: RedditPost) =>
            a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }) || byNewest(a, b)
        : byNewest;
    return [...posts].sort(cmp);
};

export const timeAgo = (createdUtc: number, nowMs: number = Date.now()): string => {
    const s = Math.max(0, Math.floor(nowMs / 1000 - createdUtc));
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
};
