/**
 * Where the output zone sits inside the editor widget, and how big it is. Pure
 * geometry, so the drag-to-resize maths is unit-tested.
 */
export type Dock = 'bottom' | 'right' | 'left' | 'top';

export const DOCK_OPTIONS: { label: string; value: Dock }[] = [
    { label: 'Bottom', value: 'bottom' },
    { label: 'Right', value: 'right' },
    { label: 'Left', value: 'left' },
    { label: 'Top', value: 'top' },
];

export const DEFAULT_DOCK: Dock = 'right';

/** Saved values come from a board file: anything unknown falls back to the default. */
export function normalizeDock(value: unknown): Dock {
    return DOCK_OPTIONS.some((o) => o.value === value) ? (value as Dock) : DEFAULT_DOCK;
}

/** Docked left/right: the zone sits beside the code, and its size is a width. */
export const isSideDock = (d: Dock): boolean => d === 'left' || d === 'right';

/** Left/top: the zone comes before the code. */
export const dockComesFirst = (d: Dock): boolean => d === 'left' || d === 'top';

/** A comfortable starting size: short and wide under/over the code, narrow beside it. */
export const defaultSize = (d: Dock): number => (isSideDock(d) ? 360 : 180);

const MIN_SIZE = { side: 160, stacked: 80 };
/** Always leave the code at least this much room along the split. */
const MIN_EDITOR = 120;

export interface Box {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

/** The size the zone would have if its divider were dragged to (x, y), inside `body`. */
export function sizeFromPointer(d: Dock, body: Box, x: number, y: number): number {
    switch (d) {
        case 'bottom': return body.bottom - y;
        case 'top': return y - body.top;
        case 'right': return body.right - x;
        case 'left': return x - body.left;
    }
}

/** Keep a size between the zone's minimum and what leaves the code its minimum. */
export function clampSize(d: Dock, size: number, body: Box): number {
    const total = isSideDock(d) ? body.right - body.left : body.bottom - body.top;
    const min = isSideDock(d) ? MIN_SIZE.side : MIN_SIZE.stacked;
    const max = Math.max(min, total - MIN_EDITOR);
    return Math.round(Math.min(max, Math.max(min, size)));
}
