// Pure helpers for the Reddit widget. The stream it reads is served by server/ (Haskell).

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

/**
 * The stream (server/Main.hs, GET /sse/redditSearch) sends an unnamed `message` event
 * whenever the newest post changes: `{ data: <Reddit listing children> }`, which
 * parseListing turns into posts. This is the one named event.
 */
export const STREAM_EVENTS = {
    /** data: { message: string } - the upstream poll failed; the stream keeps retrying. */
    streamError: 'stream-error',
} as const;

/** How many of a subreddit's newest posts to ask Reddit for on each poll. */
export const LISTING_LIMIT = 25;

export const DEFAULT_STREAM_URL = '/sse/redditSearch';
export const DEFAULT_SUBREDDIT = 'programming';
export const DEFAULT_MAX_POSTS = 100;
export const MAX_POSTS_OPTIONS = [25, 50, 100, 250, 500];

const NAME = '[A-Za-z0-9_]{1,21}';
const SUBREDDIT_RE = new RegExp(`^${NAME}(\\+${NAME})*$`);

/**
 * Accepts "python", "r/python", "/r/python/" and "a+b" multi-reddits; returns
 * the bare name or null if it isn't a valid subreddit. The server
 * puts this in an upstream URL path, so this is the first injection guard.
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
    if (target.query) params.set('search_term', target.query);
    params.set('limit', String(LISTING_LIMIT));
    return `${base}${base.includes('?') ? '&' : '?'}${params}`;
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
