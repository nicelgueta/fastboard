import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, string>();

beforeEach(() => {
    mem.clear();
    vi.stubGlobal('localStorage', {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, v),
        removeItem: (k: string) => void mem.delete(k),
    });
});
afterEach(() => vi.unstubAllGlobals());

describe('remote storage with no backend routes', () => {
    it('delete also removes the board that a failed remote save fell back to local', async () => {
        const { useAppSettings } = await import('./appSettings');
        const { getStorage, localAdapter } = await import('./storage');
        useAppSettings.setState({ storage: 'remote', remoteBaseUrl: '/app' });
        // PUT/GET fail, DELETE 404s: what a server without the /app routes does
        vi.stubGlobal('fetch', vi.fn(async (_u: string, init?: RequestInit) =>
            new Response('', { status: init?.method === 'PUT' ? 500 : 404 })));

        await getStorage().set('boards', 'b1', { name: 'b1' });
        expect(await localAdapter.list('boards')).toEqual(['b1']);

        await getStorage().remove('boards', 'b1');
        expect(await localAdapter.list('boards')).toEqual([]);
    });
});
