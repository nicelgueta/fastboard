import { create } from 'zustand';
import { WidgetState } from '../interfaces';

// A widget instance's public registry record - enough for other widgets to
// discover it, list it by type, and know its current display name/settings.
// This is intentionally smaller than the app-level `WidgetDict` (which also
// carries the static widget config - description, maxNo, settingsConfig,
// defaultLayout); Main.tsx derives `WidgetDict[]` from this plus the static
// `widgetConfig` when it needs the fuller shape (board save, maxNo checks).
export interface WidgetRecord {
    wKey: string;            // panel id, `${type}-${timestamp}`
    type: string;             // BaseWidgetDict.type
    name: string;              // user-visible title (follows tab renames)
    settings: Record<string, any>;
}

// Per-widget public surface other widgets may consume. A widget publishes
// this; consumers read it. Keep it serializable-ish - functions are allowed
// but are NOT persisted with the board.
export interface WidgetExports {
    [key: string]: unknown;
}

export interface WidgetStoreState {
    widgets: Record<string, WidgetRecord>;
    states: Record<string, WidgetState>;      // private per-widget state (persisted)
    exports: Record<string, WidgetExports>;   // public surface (NOT persisted)

    register: (w: WidgetRecord) => void;
    unregister: (wKey: string) => void;
    rename: (wKey: string, name: string) => void;
    setSettings: (wKey: string, settings: Record<string, any>) => void;
    setState: (wKey: string, patch: Partial<WidgetState>) => void;
    publish: (wKey: string, exportsObj: WidgetExports) => void;
    unpublish: (wKey: string) => void;

    // Bulk operations used by board load/reset - replace the whole registry
    // and state map in one shot rather than a churn of individual actions.
    loadWidgets: (widgets: Record<string, WidgetRecord>, states: Record<string, WidgetState>) => void;
    resetAll: () => void;
}

export const useWidgetStore = create<WidgetStoreState>((set) => ({
    widgets: {},
    states: {},
    exports: {},

    register: (w) => set((s) => ({
        widgets: { ...s.widgets, [w.wKey]: w },
        // ensure a state entry exists so useWidgetState never has to special-case
        // "registered but no state yet" vs "never registered".
        states: s.states[w.wKey] ? s.states : { ...s.states, [w.wKey]: {} as WidgetState },
    })),

    unregister: (wKey) => set((s) => {
        if (!(wKey in s.widgets) && !(wKey in s.states) && !(wKey in s.exports)) {
            return s;
        }
        const widgets = { ...s.widgets };
        delete widgets[wKey];
        const states = { ...s.states };
        delete states[wKey];
        const exportsMap = { ...s.exports };
        delete exportsMap[wKey];
        return { widgets, states, exports: exportsMap };
    }),

    rename: (wKey, name) => set((s) => {
        const existing = s.widgets[wKey];
        if (!existing) return s;
        return { widgets: { ...s.widgets, [wKey]: { ...existing, name } } };
    }),

    setSettings: (wKey, settings) => set((s) => {
        const existing = s.widgets[wKey];
        if (!existing) return s;
        return { widgets: { ...s.widgets, [wKey]: { ...existing, settings } } };
    }),

    setState: (wKey, patch) => set((s) => ({
        states: {
            ...s.states,
            [wKey]: { ...(s.states[wKey] || {}), ...patch } as WidgetState,
        },
    })),

    publish: (wKey, exportsObj) => set((s) => ({
        exports: { ...s.exports, [wKey]: exportsObj },
    })),

    unpublish: (wKey) => set((s) => {
        if (!(wKey in s.exports)) return s;
        const exportsMap = { ...s.exports };
        delete exportsMap[wKey];
        return { exports: exportsMap };
    }),

    loadWidgets: (widgets, states) => set({ widgets, states, exports: {} }),

    resetAll: () => set({ widgets: {}, states: {}, exports: {} }),
}));
