import { useAppSettings } from './appSettings';

/**
 * Where saved boards / layout configs / saved widgets live.
 *
 * localStorage is the default and always works. When the host app implements
 * the REST endpoints it can be switched to "remote" in app settings, and the
 * same collections are read from and written to:
 *
 *   boards         -> `${base}/boards`
 *   layoutConfigs  -> `${base}/layoutConfigs`
 *   saved_widgets  -> `${base}/savedWidgets`
 *
 * with `base` defaulting to `/app`. The expected contract per collection:
 *   GET    <collection>            -> string[]            (keys)
 *   GET    <collection>/<key>      -> the stored object
 *   PUT    <collection>/<key>      -> body is the object
 *   DELETE <collection>/<key>
 *
 * Remote reads fall back to localStorage when the endpoint is unavailable, so
 * a misconfigured backend degrades instead of losing the user's boards.
 */

export type Collection = 'boards' | 'layoutConfigs' | 'saved_widgets';

/** Legacy localStorage store names, kept so existing saved data still loads. */
const LOCAL_STORE_NAME: Record<Collection, string> = {
    boards: 'allBoards',
    layoutConfigs: 'layoutConfigs',
    saved_widgets: 'saved_widgets',
};

const REMOTE_PATH: Record<Collection, string> = {
    boards: 'boards',
    layoutConfigs: 'layoutConfigs',
    saved_widgets: 'savedWidgets',
};

export interface StorageAdapter {
    list(collection: Collection): Promise<string[]>;
    get<T = any>(collection: Collection, key: string): Promise<T | undefined>;
    set(collection: Collection, key: string, value: unknown): Promise<void>;
    remove(collection: Collection, key: string): Promise<void>;
}

// --- local -----------------------------------------------------------------
const kvKey = (store: string, key: string) => `kvstore-${store}-${key}`;
const INDEX_KEY = 'allKvStoreKeys';

const readIndex = (): string[] => {
    try {
        return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
    } catch {
        return [];
    }
};

export const localAdapter: StorageAdapter = {
    async list(collection) {
        const store = LOCAL_STORE_NAME[collection];
        return readIndex()
            .filter((k: string) => k.startsWith(`kvstore-${store}-`))
            .map((k: string) => k.replace(`kvstore-${store}-`, ''));
    },
    async get(collection, key) {
        try {
            const raw = localStorage.getItem(kvKey(LOCAL_STORE_NAME[collection], key));
            return raw ? JSON.parse(raw) : undefined;
        } catch {
            return undefined;
        }
    },
    async set(collection, key, value) {
        const full = kvKey(LOCAL_STORE_NAME[collection], key);
        const index = readIndex();
        if (!index.includes(full)) {
            index.push(full);
            localStorage.setItem(INDEX_KEY, JSON.stringify(index));
        }
        localStorage.setItem(full, JSON.stringify(value));
    },
    async remove(collection, key) {
        const full = kvKey(LOCAL_STORE_NAME[collection], key);
        localStorage.removeItem(full);
        localStorage.setItem(INDEX_KEY, JSON.stringify(readIndex().filter((k) => k !== full)));
    },
};

// --- remote ----------------------------------------------------------------
const makeRemoteAdapter = (base: string): StorageAdapter => {
    const url = (collection: Collection, key?: string) =>
        `${base.replace(/\/$/, '')}/${REMOTE_PATH[collection]}${key ? `/${encodeURIComponent(key)}` : ''}`;

    return {
        async list(collection) {
            const res = await fetch(url(collection), { headers: { Accept: 'application/json' } });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            const body = await res.json();
            return Array.isArray(body) ? body.map(String) : [];
        },
        async get(collection, key) {
            const res = await fetch(url(collection, key), { headers: { Accept: 'application/json' } });
            if (res.status === 404) return undefined;
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            return res.json();
        },
        async set(collection, key, value) {
            const res = await fetch(url(collection, key), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(value),
            });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        },
        async remove(collection, key) {
            const res = await fetch(url(collection, key), { method: 'DELETE' });
            if (!res.ok && res.status !== 404) throw new Error(`${res.status} ${res.statusText}`);
        },
    };
};

/**
 * The active adapter. Remote operations fall back to local on failure so a
 * backend that is down or not implemented never costs the user their data.
 */
export const getStorage = (): StorageAdapter => {
    const { storage, remoteBaseUrl } = useAppSettings.getState();
    if (storage !== 'remote') return localAdapter;
    const remote = makeRemoteAdapter(remoteBaseUrl);
    const withFallback = <A extends any[], R>(
        remoteFn: (...a: A) => Promise<R>,
        localFn: (...a: A) => Promise<R>,
    ) => async (...a: A): Promise<R> => {
        try {
            return await remoteFn(...a);
        } catch (e) {
            console.warn('Remote storage unavailable, falling back to local:', e);
            return localFn(...a);
        }
    };
    return {
        list: withFallback(remote.list, localAdapter.list),
        get: withFallback(remote.get, localAdapter.get),
        set: withFallback(remote.set, localAdapter.set),
        remove: withFallback(remote.remove, localAdapter.remove),
    };
};
