import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedditRequestQueue, type FeedListener } from './redditQueue';

const listing = (...names: string[]) => ({
    data: { children: names.map((n) => ({ data: { name: n, title: n, permalink: `/r/x/${n}/` } })) },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const atom = (id: string) => new Response(
    `<feed><entry><id>${id}</id><title>${id}</title><link href="https://www.reddit.com/r/x/comments/${id}/t/"/></entry></feed>`,
);

const listener = () => ({ onPosts: vi.fn(), onError: vi.fn() } satisfies FeedListener);

describe('RedditRequestQueue', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const make = (impl: (url: string) => Response | Promise<Response>) => {
        const fetch = vi.fn((url: string) => Promise.resolve(impl(url)));
        return { fetch, queue: new RedditRequestQueue({ fetch: fetch as unknown as typeof globalThis.fetch, now: Date.now }) };
    };

    it('never has two requests in flight and spaces them out across widgets', async () => {
        let active = 0;
        let maxActive = 0;
        const stamps: number[] = [];
        const { fetch, queue } = make(() => json(listing('t3_a')));
        fetch.mockImplementation(async () => {
            stamps.push(Date.now());
            maxActive = Math.max(maxActive, ++active);
            await new Promise((r) => setTimeout(r, 100));
            active--;
            return json(listing('t3_a'));
        });
        queue.subscribe({ subreddit: 'one' }, listener());
        queue.subscribe({ subreddit: 'two' }, listener());
        queue.subscribe({ query: 'three' }, listener());
        await vi.advanceTimersByTimeAsync(60_000);
        expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(maxActive).toBe(1);
        for (let i = 1; i < stamps.length; i++) expect(stamps[i] - stamps[i - 1]).toBeGreaterThanOrEqual(6_000);
    });

    it('shares one poll between widgets on the same target, including late joiners', async () => {
        const { fetch, queue } = make(() => json(listing('t3_a')));
        const a = listener();
        const b = listener();
        queue.subscribe({ subreddit: 'X' }, a);
        await vi.advanceTimersByTimeAsync(1);
        queue.subscribe({ subreddit: 'x' }, b);
        expect(b.onPosts).toHaveBeenCalledTimes(1);
        expect(a.onPosts).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('only sends when the newest post changes', async () => {
        let n = 0;
        const { queue } = make(() => json(listing(n++ < 2 ? 't3_a' : 't3_b')));
        const l = listener();
        queue.subscribe({ subreddit: 'x' }, l);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(l.onPosts.mock.calls.map(([p]) => p[0].id)).toEqual(['t3_a', 't3_b']);
    });

    it('falls back to the Atom feed when JSON is refused, and stops trying JSON for a while', async () => {
        const { fetch, queue } = make((url) => (url.includes('.json') ? new Response('no', { status: 403 }) : atom('t3_z')));
        const l = listener();
        queue.subscribe({ subreddit: 'x' }, l);
        await vi.advanceTimersByTimeAsync(200_000);
        expect(l.onPosts.mock.calls[0][0][0].id).toBe('t3_z');
        expect(fetch.mock.calls.filter(([u]) => u.includes('.json'))).toHaveLength(1);
        expect(fetch.mock.calls.filter(([u]) => u.includes('.rss')).length).toBeGreaterThan(1);
    });

    it('falls back to Atom on a network/CORS failure too', async () => {
        const { queue } = make((url) => {
            if (url.includes('.json')) throw new TypeError('Failed to fetch');
            return atom('t3_z');
        });
        const l = listener();
        queue.subscribe({ subreddit: 'x' }, l);
        await vi.advanceTimersByTimeAsync(1);
        expect(l.onPosts).toHaveBeenCalledTimes(1);
    });

    it('reports failures, retries, and clears the error once a poll succeeds', async () => {
        let n = 0;
        const { queue } = make(() => (n++ === 0 ? json({}, 500) : json(listing('t3_a'))));
        const l = listener();
        queue.subscribe({ subreddit: 'x' }, l);
        await vi.advanceTimersByTimeAsync(1);
        expect(l.onError).toHaveBeenLastCalledWith('Reddit responded 500');
        await vi.advanceTimersByTimeAsync(40_000);
        expect(l.onError).toHaveBeenLastCalledWith(undefined);
        expect(l.onPosts).toHaveBeenCalledTimes(1);
    });

    it('stops polling when the last listener leaves', async () => {
        const { fetch, queue } = make(() => json(listing('t3_a')));
        const off = queue.subscribe({ subreddit: 'x' }, listener());
        await vi.advanceTimersByTimeAsync(1);
        off();
        await vi.advanceTimersByTimeAsync(300_000);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });
});
