import { useCallback, useEffect, DependencyList } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWidgetStore, WidgetRecord, WidgetExports } from './widgetStore';
import { WidgetState } from '../interfaces';
import type { EditorWidgetExports } from '../widgets/types';

// The public widget-linking API. Consumers should reach for these instead of
// touching useWidgetStore directly - they encapsulate the selector shapes
// that keep re-renders scoped to the widget(s) that actually changed.

/** A single widget's registry record, or undefined if it doesn't exist (e.g. it was closed). */
export const useWidget = (wKey: string): WidgetRecord | undefined =>
    useWidgetStore((s) => s.widgets[wKey]);

/**
 * All registered widgets of a given type, e.g. the editor listing every
 * table widget to link against. Referentially stable across renders that
 * don't change the underlying set (via useShallow) - safe to use in a
 * useEffect/useMemo dependency array.
 */
export const useWidgetsByType = (type: string): WidgetRecord[] =>
    useWidgetStore(useShallow((s) => Object.values(s.widgets).filter((w) => w.type === type)));

/** Every registered widget. Same referential-stability guarantee as useWidgetsByType. */
export const useAllWidgets = (): WidgetRecord[] =>
    useWidgetStore(useShallow((s) => Object.values(s.widgets)));

/**
 * Which editor widget (if any) currently targets each table widget, keyed by
 * the table's wKey. A table <-> editor link is 1:1: exactly one editor may
 * target a given table at a time - see EditorWidget's handleTargetChange,
 * which is what actually enforces that exclusivity. Both TableWidget and
 * EditorWidget read this to show their connected/disconnected status.
 */
export const useEditorLinks = (): Record<string, WidgetRecord> =>
    useWidgetStore(useShallow((s) => {
        const links: Record<string, WidgetRecord> = {};
        for (const w of Object.values(s.widgets)) {
            if (w.type !== 'editor') continue;
            const exp = s.exports[w.wKey] as unknown as EditorWidgetExports | undefined;
            if (exp?.targetWKey) links[exp.targetWKey] = w;
        }
        return links;
    }));

/** A widget's own private, persisted state, plus a patch setter. */
export const useWidgetState = <T extends Record<string, any> = WidgetState>(
    wKey: string
): [T, (patch: Partial<T>) => void] => {
    const state = useWidgetStore(useShallow((s) => (s.states[wKey] as unknown as T | undefined) ?? ({} as T)));
    const setStateAction = useWidgetStore((s) => s.setState);
    const setState = useCallback(
        (patch: Partial<T>) => setStateAction(wKey, patch as Partial<WidgetState>),
        [setStateAction, wKey]
    );
    return [state, setState];
};

/**
 * Read another widget's published exports. Returns undefined both before
 * anything has been published and after the publishing widget has been
 * closed (dangling reference) - consumers must handle that case rather than
 * assume the link is always live.
 */
export const useWidgetExports = <T = WidgetExports>(wKey: string | undefined): T | undefined =>
    useWidgetStore((s) => (wKey ? (s.exports[wKey] as T | undefined) : undefined));

/**
 * Publish this widget's public surface for others to consume. Re-publishes
 * whenever `deps` changes, and unpublishes automatically on unmount so a
 * closed widget never leaves a stale entry for useWidgetsByType/useWidgetExports
 * consumers to pick up.
 */
export const usePublishExports = <T extends object>(
    wKey: string,
    exportsObj: T,
    deps: DependencyList
): void => {
    const publish = useWidgetStore((s) => s.publish);
    const unpublish = useWidgetStore((s) => s.unpublish);
    useEffect(() => {
        publish(wKey, exportsObj as unknown as WidgetExports);
        return () => unpublish(wKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wKey, publish, unpublish, ...deps]);
};
