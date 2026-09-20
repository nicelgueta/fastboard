import { describe, it, expect } from 'vitest';
import {
    normalizeSubreddit, normalizeQuery, buildStreamUrl, upstreamRequest, parseListing, parseAtomFeed, htmlToMarkdown, mergePosts, timeAgo, RedditPost,
    sortPosts, asPostSort, hasCounts, sortNeedsCounts,
} from './posts';

const post = (id: string, extra: Partial<RedditPost> = {}): RedditPost => ({
    id, title: id, author: 'a', subreddit: 's', permalink: '', url: '', createdUtc: 0,
    isSelf: true, ...extra,
});

describe('normalizeSubreddit', () => {
    it('strips r/ prefixes and slashes', () => {
        expect(normalizeSubreddit('python')).toBe('python');
        expect(normalizeSubreddit('r/python')).toBe('python');
        expect(normalizeSubreddit(' /r/Python/ ')).toBe('Python');
    });
    it('accepts multi-reddits', () => {
        expect(normalizeSubreddit('a+b_c')).toBe('a+b_c');
    });
    it('rejects anything that could alter the upstream URL', () => {
        for (const bad of ['', 'a/b', 'a?x=1', 'a b', '../x', 'a+', '+a', 'a'.repeat(22), undefined, null]) {
            expect(normalizeSubreddit(bad as string)).toBeNull();
        }
    });
});

describe('normalizeQuery', () => {
    it('trims, caps and nulls empties', () => {
        expect(normalizeQuery('  bitcoin etf ')).toBe('bitcoin etf');
        expect(normalizeQuery('   ')).toBeNull();
        expect(normalizeQuery(undefined)).toBeNull();
        expect(normalizeQuery('x'.repeat(500))).toHaveLength(200);
    });
});

describe('buildStreamUrl', () => {
    it('encodes the target as query params, always with a limit', () => {
        expect(buildStreamUrl('/sse/redditSearch', { subreddit: 'a+b' })).toBe('/sse/redditSearch?subreddit=a%2Bb&limit=25');
        expect(buildStreamUrl('https://x.test/s?k=1', { subreddit: 'a', query: 'c & d' })).toBe('https://x.test/s?k=1&subreddit=a&search_term=c+%26+d&limit=25');
        expect(buildStreamUrl('/s', { query: 'q' })).toBe('/s?search_term=q&limit=25');
    });
});

describe('upstreamRequest', () => {
    it('reads a subreddit\'s new posts', () => {
        const { path, params } = upstreamRequest({ subreddit: 'python' }, 25);
        expect(path).toBe('/r/python/new');
        expect(params.toString()).toBe('limit=25');
    });
    it('searches within a subreddit, newest first', () => {
        const { path, params } = upstreamRequest({ subreddit: 'python', query: 'a&b' }, 25);
        expect(path).toBe('/r/python/search');
        expect(params.get('q')).toBe('a&b');
        expect(params.get('sort')).toBe('new');
        expect(params.get('restrict_sr')).toBe('1');
    });
    it('searches all of Reddit without a subreddit', () => {
        const { path, params } = upstreamRequest({ query: 'x' }, 10);
        expect(path).toBe('/search');
        expect(params.has('restrict_sr')).toBe(false);
    });
});

describe('parseListing', () => {
    const child = (d: Record<string, unknown>) => ({ kind: 't3', data: d });
    it('maps listing children and skips malformed ones', () => {
        const posts = parseListing({
            data: {
                children: [
                    child({ name: 't3_1', title: 'Link', author: 'bob', subreddit: 'x', permalink: '/r/x/comments/1/link/',
                        url: 'https://example.com', is_self: false, created_utc: 100, score: 5, num_comments: 2,
                        link_flair_text: 'News', over_18: true, thumbnail: 'https://t.example/i.jpg', post_hint: 'link' }),
                    child({ name: 't3_2', title: 'Self', permalink: '/r/x/comments/2/self/', url: 'ignored', is_self: true,
                        thumbnail: 'self', selftext: 'a&#x200B;b' }),
                    child({ title: 'no name' }),
                    null,
                ],
            },
        });
        expect(posts).toHaveLength(2);
        expect(posts[0]).toMatchObject({
            id: 't3_1', url: 'https://example.com', flair: 'News', over18: true, score: 5, numComments: 2,
            thumbnail: 'https://t.example/i.jpg', postHint: 'link', isSelf: false,
        });
        expect(posts[0].permalink).toBe('https://www.reddit.com/r/x/comments/1/link/');
        expect(posts[1]).toMatchObject({ author: '[deleted]', url: 'https://www.reddit.com/r/x/comments/2/self/', selftext: 'ab' });
        expect(posts[1].thumbnail).toBeUndefined();
        expect(posts[1].flair).toBeUndefined();
    });
    it('caps very long selftext', () => {
        const [p] = parseListing({ data: { children: [child({ name: 't3_3', title: 't', selftext: 'x'.repeat(50000) })] } });
        expect(p.selftext).toHaveLength(8000);
    });
    it('returns [] for unexpected shapes', () => {
        expect(parseListing(null)).toEqual([]);
        expect(parseListing({ data: {} })).toEqual([]);
        expect(parseListing({ message: 'Too Many Requests', error: 429 })).toEqual([]);
    });
});

describe('parseAtomFeed', () => {
    const entry = (id: string, title: string, opts: { outbound?: string; author?: string; body?: string; thumb?: string } = {}) => `
        <entry>
          <author><name>/u/${opts.author ?? 'bob'}</name><uri>https://www.reddit.com/user/bob</uri></author>
          <category term="Python" label="r/Python"/>
          <content type="html">${opts.body ?? ''}&lt;div&gt;&lt;span&gt;&lt;a href=&quot;${opts.outbound ?? `https://www.reddit.com/r/Python/comments/${id}/t/`}&quot;&gt;[link]&lt;/a&gt;&lt;/span&gt;&lt;/div&gt;</content>
          ${opts.thumb ? `<media:thumbnail url="${opts.thumb}" />` : ''}
          <id>t3_${id}</id>
          <link href="https://www.reddit.com/r/Python/comments/${id}/t/" />
          <updated>2026-09-19T18:37:04+00:00</updated>
          <published>2026-09-19T18:37:04+00:00</published>
          <title>${title}</title>
        </entry>`;
    const feed = (...entries: string[]) => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>newest</title>${entries.join('')}</feed>`;

    it('maps entries for self posts', () => {
        const [p] = parseAtomFeed(feed(entry('abc', 'Hello')));
        expect(p).toEqual({
            id: 't3_abc', title: 'Hello', author: 'bob', subreddit: 'Python',
            permalink: 'https://www.reddit.com/r/Python/comments/abc/t/',
            url: 'https://www.reddit.com/r/Python/comments/abc/t/',
            createdUtc: Date.parse('2026-09-19T18:37:04+00:00') / 1000, isSelf: true,
        });
    });
    it('extracts the body of self posts as markdown', () => {
        const body = '&lt;!-- SC_OFF --&gt;&lt;div class=&quot;md&quot;&gt;&lt;p&gt;Hello &lt;strong&gt;world&lt;/strong&gt; &amp;amp; co&lt;/p&gt; &lt;ul&gt;&lt;li&gt;one&lt;/li&gt;&lt;/ul&gt;&lt;/div&gt;&lt;!-- SC_ON --&gt;';
        const [p] = parseAtomFeed(feed(entry('b', 'Body', { body })));
        expect(p.selftext).toBe('Hello **world** & co\n\n- one');
    });
    it('leaves selftext empty for link posts and reads media thumbnails', () => {
        const [p] = parseAtomFeed(feed(entry('t', 'Pic', { outbound: 'https://i.example/a.jpg', thumb: 'https://t.example/x.jpg?a=1&amp;b=2' })));
        expect(p.selftext).toBeUndefined();
        expect(p.thumbnail).toBe('https://t.example/x.jpg?a=1&b=2');
    });
    it('takes the outbound url of link posts, decoding entities twice', () => {
        const [p] = parseAtomFeed(feed(entry('x', 'Link', { outbound: 'https://example.com/a?b=1&amp;amp;c=2' })));
        expect(p.url).toBe('https://example.com/a?b=1&c=2');
        expect(p.isSelf).toBe(false);
        expect(p.permalink).toContain('/comments/x/');
    });
    it('decodes entities in titles', () => {
        const [p] = parseAtomFeed(feed(entry('e', 'Tom &amp; Jerry &lt;3 &#39;quotes&#39; &#x1F600; it&amp;#39;s')));
        expect(p.title).toBe("Tom & Jerry <3 'quotes' \u{1F600} it&#39;s");
    });
    it('keeps feed order and skips entries without an id or title', () => {
        const posts = parseAtomFeed(feed(entry('1', 'one'), '<entry><title>no id</title></entry>', entry('2', 'two')));
        expect(posts.map((p) => p.id)).toEqual(['t3_1', 't3_2']);
    });
    it('returns [] for non-feeds', () => {
        expect(parseAtomFeed('')).toEqual([]);
        expect(parseAtomFeed('<html>Too Many Requests</html>')).toEqual([]);
    });
});

describe('htmlToMarkdown', () => {
    it('converts headings, emphasis, links, code and quotes', () => {
        const md = htmlToMarkdown(
            '<h2>Title</h2><p>a <em>b</em> <a href="https://x.test/?q=1&amp;r=2">link</a> <code>x &lt; y</code></p>' +
            '<blockquote><p>quoted</p></blockquote><pre><code>line1\nline2</code></pre>',
        );
        expect(md).toBe('## Title\n\na *b* [link](https://x.test/?q=1&r=2) `x < y`\n\n> quoted\n\n```\nline1\nline2\n```');
    });
    it('keeps escaped angle brackets as text and strips unknown tags', () => {
        expect(htmlToMarkdown('<span>use &lt;div&gt; here</span><br/>next')).toBe('use <div> here\nnext');
    });
});

describe('mergePosts', () => {
    it('prepends new posts and dedupes by id', () => {
        const merged = mergePosts([post('b'), post('a')], [post('c'), post('b')], 10);
        expect(merged.map((p) => p.id)).toEqual(['c', 'b', 'a']);
    });
    it('refreshes fields of a known post in place', () => {
        const merged = mergePosts([post('a', { title: 'old' })], [post('a', { title: 'new' })], 10);
        expect(merged).toHaveLength(1);
        expect(merged[0].title).toBe('new');
    });
    it('caps at max, dropping the oldest', () => {
        const merged = mergePosts([post('b'), post('a')], [post('c')], 2);
        expect(merged.map((p) => p.id)).toEqual(['c', 'b']);
    });
});

describe('timeAgo', () => {
    it('picks the coarsest sensible unit', () => {
        const now = 1_000_000 * 1000;
        expect(timeAgo(1_000_000 - 5, now)).toBe('5s');
        expect(timeAgo(1_000_000 - 120, now)).toBe('2m');
        expect(timeAgo(1_000_000 - 7200, now)).toBe('2h');
        expect(timeAgo(1_000_000 - 172800, now)).toBe('2d');
        expect(timeAgo(1_000_000 + 30, now)).toBe('0s');
    });
});

describe('sortPosts', () => {
    const ids = (ps: RedditPost[]) => ps.map((p) => p.id);
    const feed = [
        post('a', { createdUtc: 100, score: 5, numComments: 50, title: 'banana' }),
        post('b', { createdUtc: 300, score: 50, numComments: 5, title: 'Apple' }),
        post('c', { createdUtc: 200, score: 20, numComments: 20, title: 'cherry' }),
    ];

    it('newest and oldest go by time', () => {
        expect(ids(sortPosts(feed, 'new'))).toEqual(['b', 'c', 'a']);
        expect(ids(sortPosts(feed, 'old'))).toEqual(['a', 'c', 'b']);
    });
    it('top and comments go highest first', () => {
        expect(ids(sortPosts(feed, 'top'))).toEqual(['b', 'c', 'a']);
        expect(ids(sortPosts(feed, 'comments'))).toEqual(['a', 'c', 'b']);
    });
    it('title is case-insensitive and numeric-aware', () => {
        expect(ids(sortPosts(feed, 'title'))).toEqual(['b', 'a', 'c']);
        const nums = [post('x', { title: 'item 10' }), post('y', { title: 'item 2' })];
        expect(ids(sortPosts(nums, 'title'))).toEqual(['y', 'x']);
    });
    it('ties fall back to newest, then id, so the order is deterministic', () => {
        const tied = [post('m', { score: 1, createdUtc: 10 }), post('n', { score: 1, createdUtc: 20 }), post('k', { score: 1, createdUtc: 20 })];
        expect(ids(sortPosts(tied, 'top'))).toEqual(['k', 'n', 'm']);
    });
    it('a zero score is a real score, not a missing one', () => {
        const mix = [post('none', { createdUtc: 999 }), post('zero', { score: 0, createdUtc: 1 })];
        expect(ids(sortPosts(mix, 'top'))).toEqual(['zero', 'none']);
    });
    it('posts with no count go after those that have one, newest first among themselves', () => {
        const mix = [post('old-none', { createdUtc: 1 }), post('scored', { score: 3, createdUtc: 5 }), post('new-none', { createdUtc: 9 })];
        expect(ids(sortPosts(mix, 'top'))).toEqual(['scored', 'new-none', 'old-none']);
    });
    it('with no counts at all, a count sort is just newest first', () => {
        const bare = [post('a', { createdUtc: 1 }), post('b', { createdUtc: 2 })];
        expect(ids(sortPosts(bare, 'top'))).toEqual(['b', 'a']);
        expect(ids(sortPosts(bare, 'comments'))).toEqual(['b', 'a']);
    });
    it('does not mutate its input, and handles empty', () => {
        const input = [...feed];
        sortPosts(input, 'old');
        expect(ids(input)).toEqual(['a', 'b', 'c']);
        expect(sortPosts([], 'top')).toEqual([]);
    });
});

describe('sort helpers', () => {
    it('asPostSort rejects unknown values', () => {
        expect(asPostSort('top')).toBe('top');
        expect(asPostSort('bogus')).toBe('new');
        expect(asPostSort(undefined)).toBe('new');
    });
    it('knows which sorts need counts, and whether a feed has them', () => {
        expect(sortNeedsCounts('top') && sortNeedsCounts('comments')).toBe(true);
        expect(sortNeedsCounts('new') || sortNeedsCounts('title') || sortNeedsCounts('old')).toBe(false);
        expect(hasCounts([post('a')])).toBe(false);
        expect(hasCounts([post('a'), post('b', { score: 0 })])).toBe(true);
        expect(hasCounts([post('a', { numComments: 2 })])).toBe(true);
    });
});
