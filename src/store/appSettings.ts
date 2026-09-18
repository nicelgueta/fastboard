import { create } from 'zustand';

/**
 * App-wide settings, reachable from the cog in the top-right.
 *
 * These are global preferences, distinct from per-widget settings (which are
 * declared as WidgetSetting[] on each widget's config and edited from that
 * widget's own Settings modal).
 */

export type StorageBackend = 'local' | 'remote';

/** Table defaults. Values mirror ag-grid's own Quartz defaults unless noted. */
export interface TableSettings {
    /** ag-grid default: 14 */
    fontSize: number;
    /** ag-grid default: 42 */
    rowHeight: number;
    /** ag-grid default: 48 */
    headerHeight: number;
    /** Zebra striping. */
    stripeRows: boolean;
    /** Vertical cell separators. */
    columnBorders: boolean;
    /** Default rows per page for new table widgets. */
    defaultPageSize: number;
    /** Monospace numerals/text in cells - easier to scan numeric columns. */
    monospaceCells: boolean;
}

export interface AppSettingsState {
    table: TableSettings;
    storage: StorageBackend;
    /** Base path for the remote backend. Boards -> `${base}/boards`, etc. */
    remoteBaseUrl: string;

    setTable: (patch: Partial<TableSettings>) => void;
    setStorage: (backend: StorageBackend) => void;
    setRemoteBaseUrl: (url: string) => void;
    reset: () => void;
}

export const DEFAULT_TABLE_SETTINGS: TableSettings = {
    fontSize: 14,
    rowHeight: 42,
    headerHeight: 48,
    stripeRows: true,
    columnBorders: false,
    defaultPageSize: 25,
    monospaceCells: true,
};

const STORE_KEY = 'kvstore-appSettings-v1';

const loadPersisted = (): Partial<AppSettingsState> => {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Partial<AppSettingsState>;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        // Private windows / blocked site data - fall back to defaults rather
        // than failing app start.
        return {};
    }
};

const persist = (s: AppSettingsState) => {
    try {
        localStorage.setItem(
            STORE_KEY,
            JSON.stringify({ table: s.table, storage: s.storage, remoteBaseUrl: s.remoteBaseUrl }),
        );
    } catch {
        /* best effort */
    }
};

const persisted = loadPersisted();

export const useAppSettings = create<AppSettingsState>((set, get) => ({
    table: { ...DEFAULT_TABLE_SETTINGS, ...(persisted.table || {}) },
    storage: persisted.storage === 'remote' ? 'remote' : 'local',
    remoteBaseUrl: typeof persisted.remoteBaseUrl === 'string' ? persisted.remoteBaseUrl : '/app',

    setTable: (patch) => {
        set((s) => ({ table: { ...s.table, ...patch } }));
        persist(get());
    },
    setStorage: (backend) => {
        set({ storage: backend });
        persist(get());
    },
    setRemoteBaseUrl: (url) => {
        set({ remoteBaseUrl: url });
        persist(get());
    },
    reset: () => {
        set({ table: { ...DEFAULT_TABLE_SETTINGS }, storage: 'local', remoteBaseUrl: '/app' });
        persist(get());
    },
}));
