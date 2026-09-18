import { describe, expect, it, beforeEach } from 'vitest';
import { useWidgetStore, WidgetRecord } from './widgetStore';

// zustand stores are plain objects outside React - exercise the store
// directly rather than through hooks. This is deliberately where the
// referential-stability guarantees that `useShallow` in src/store/hooks.ts
// relies on are verified: unrelated widget records must keep the same
// object identity across actions that don't touch them, or a shallow
// array-equality check (what useWidgetsByType/useAllWidgets use) would
// never consider two renders "equal" and consumers would re-render/loop
// on every store change regardless of relevance.

const rec = (wKey: string, type: string, name = type): WidgetRecord => ({
    wKey,
    type,
    name,
    settings: {},
});

beforeEach(() => {
    useWidgetStore.setState({ widgets: {}, states: {}, exports: {} });
});

describe('register / unregister', () => {
    it('adds a widget and an empty state entry on register', () => {
        useWidgetStore.getState().register(rec('table-1', 'table'));
        const s = useWidgetStore.getState();
        expect(s.widgets['table-1']).toEqual(rec('table-1', 'table'));
        expect(s.states['table-1']).toEqual({});
    });

    it('does not clobber an existing state entry on re-register', () => {
        const { register, setState } = useWidgetStore.getState();
        register(rec('table-1', 'table'));
        setState('table-1', { name: 'custom', foo: 'bar' } as any);
        register({ ...rec('table-1', 'table'), name: 'renamed' });
        expect(useWidgetStore.getState().states['table-1']).toEqual({ name: 'custom', foo: 'bar' });
        expect(useWidgetStore.getState().widgets['table-1'].name).toBe('renamed');
    });

    it('unregister removes the widget, its state, and its exports atomically', () => {
        const { register, setState, publish, unregister } = useWidgetStore.getState();
        register(rec('table-1', 'table'));
        setState('table-1', { name: 'x' } as any);
        publish('table-1', { rows: [1, 2, 3] });

        unregister('table-1');

        const s = useWidgetStore.getState();
        expect(s.widgets['table-1']).toBeUndefined();
        expect(s.states['table-1']).toBeUndefined();
        expect(s.exports['table-1']).toBeUndefined();
    });

    it('unregistering a widget that was never registered is a safe no-op and does not create a new object reference', () => {
        const before = useWidgetStore.getState();
        useWidgetStore.getState().unregister('does-not-exist');
        const after = useWidgetStore.getState();
        // no state churn - identical top-level slices
        expect(after.widgets).toBe(before.widgets);
        expect(after.states).toBe(before.states);
        expect(after.exports).toBe(before.exports);
    });

    it('closing one widget (unregister) does not disturb unrelated widget object identity - the case useWidgetsByType/useShallow depend on', () => {
        const { register, unregister } = useWidgetStore.getState();
        register(rec('table-1', 'table'));
        register(rec('table-2', 'table'));
        register(rec('editor-1', 'editor'));

        const table2Before = useWidgetStore.getState().widgets['table-2'];
        const editor1Before = useWidgetStore.getState().widgets['editor-1'];

        unregister('table-1');

        expect(useWidgetStore.getState().widgets['table-2']).toBe(table2Before);
        expect(useWidgetStore.getState().widgets['editor-1']).toBe(editor1Before);
    });
});

describe('rename / setSettings', () => {
    it('rename updates only the name field and is a no-op for a missing widget', () => {
        const { register, rename } = useWidgetStore.getState();
        register(rec('table-1', 'table'));
        rename('table-1', 'My Table');
        expect(useWidgetStore.getState().widgets['table-1'].name).toBe('My Table');

        const before = useWidgetStore.getState().widgets;
        rename('does-not-exist', 'nope');
        expect(useWidgetStore.getState().widgets).toBe(before);
    });

    it('setSettings replaces the settings object for that widget only', () => {
        const { register, setSettings } = useWidgetStore.getState();
        register(rec('table-1', 'table'));
        register(rec('table-2', 'table'));
        const table2Before = useWidgetStore.getState().widgets['table-2'];

        setSettings('table-1', { pageSize: 50 });

        expect(useWidgetStore.getState().widgets['table-1'].settings).toEqual({ pageSize: 50 });
        expect(useWidgetStore.getState().widgets['table-2']).toBe(table2Before);
    });
});

describe('setState', () => {
    it('merges a patch into existing state rather than replacing it', () => {
        const { register, setState } = useWidgetStore.getState();
        register(rec('editor-1', 'editor'));
        setState('editor-1', { content: 'select 1' } as any);
        setState('editor-1', { language: 'sql' } as any);
        expect(useWidgetStore.getState().states['editor-1']).toEqual({
            content: 'select 1',
            language: 'sql',
        });
    });
});

describe('publish / unpublish (exports - the "dangling reference" case)', () => {
    it('publish makes exports readable; unpublish (e.g. on unmount) clears them without touching the widget registry', () => {
        const { register, publish, unpublish } = useWidgetStore.getState();
        register(rec('table-1', 'table'));
        publish('table-1', { tableName: 'my_table' });
        expect(useWidgetStore.getState().exports['table-1']).toEqual({ tableName: 'my_table' });

        unpublish('table-1');
        expect(useWidgetStore.getState().exports['table-1']).toBeUndefined();
        // widget registry itself is untouched - only exports were cleared
        expect(useWidgetStore.getState().widgets['table-1']).toBeDefined();
    });

    it('reading exports for a wKey that was never published, or was unregistered, both resolve to undefined (no throw)', () => {
        expect(useWidgetStore.getState().exports['ghost']).toBeUndefined();

        const { register, publish, unregister } = useWidgetStore.getState();
        register(rec('table-1', 'table'));
        publish('table-1', { rows: [] });
        unregister('table-1');
        expect(useWidgetStore.getState().exports['table-1']).toBeUndefined();
    });
});

describe('loadWidgets / resetAll (board load/reset)', () => {
    it('loadWidgets replaces widgets and states wholesale and always clears exports (never persisted)', () => {
        const { register, publish, loadWidgets } = useWidgetStore.getState();
        register(rec('table-1', 'table'));
        publish('table-1', { rows: [1] });

        loadWidgets(
            { 'editor-1': rec('editor-1', 'editor') },
            { 'editor-1': { name: 'editor' } as any }
        );

        const s = useWidgetStore.getState();
        expect(Object.keys(s.widgets)).toEqual(['editor-1']);
        expect(Object.keys(s.states)).toEqual(['editor-1']);
        expect(s.exports).toEqual({});
    });

    it('resetAll clears everything', () => {
        const { register, publish, resetAll } = useWidgetStore.getState();
        register(rec('table-1', 'table'));
        publish('table-1', { rows: [1] });
        resetAll();
        const s = useWidgetStore.getState();
        expect(s.widgets).toEqual({});
        expect(s.states).toEqual({});
        expect(s.exports).toEqual({});
    });
});

describe('useWidgetsByType filtering semantics (the shape src/store/hooks.ts selects with useShallow)', () => {
    it('filters by type and reflects live registry contents', () => {
        const { register, unregister } = useWidgetStore.getState();
        register(rec('table-1', 'table'));
        register(rec('table-2', 'table'));
        register(rec('editor-1', 'editor'));

        const byType = (type: string) => Object.values(useWidgetStore.getState().widgets).filter((w) => w.type === type);

        expect(byType('table').map((w) => w.wKey).sort()).toEqual(['table-1', 'table-2']);
        expect(byType('editor').map((w) => w.wKey)).toEqual(['editor-1']);
        expect(byType('graph')).toEqual([]);

        unregister('table-2');
        expect(byType('table').map((w) => w.wKey)).toEqual(['table-1']);
    });
});
