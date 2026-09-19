/**
 * How the editor's Run button labels itself for the room the toolbar has:
 * the full label with its shortcut, then just "Run", then the icon alone.
 */
export type RunLabelMode = 'full' | 'short' | 'icon';

export const RUN_SHORTCUT_LABEL = 'Run (Ctrl/Cmd+Enter)';

/**
 * Toolbar widths (px) at which the label steps down. The full label needs room
 * beside the two pickers, the connection status and the Output button; the
 * pickers and status shrink first, so these are where the button itself has to.
 */
export const FULL_LABEL_MIN_WIDTH = 760;
export const SHORT_LABEL_MIN_WIDTH = 520;

/** `width` is null until the toolbar has been measured: assume there is room. */
export function runLabelMode(width: number | null): RunLabelMode {
    if (width === null || width >= FULL_LABEL_MIN_WIDTH) return 'full';
    if (width >= SHORT_LABEL_MIN_WIDTH) return 'short';
    return 'icon';
}
