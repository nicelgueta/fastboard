import type { BaseWidgetDict } from '../../interfaces';
import { DefaultLayout } from '../../layout';

// Kept dependency-free (no monaco, no EditorWidget import) - registry.ts
// imports this statically so the "Add tool" menu can list every widget
// without loading Monaco. The target-table picker is intentionally NOT a
// declarative setting: it must reflect the live set of table widgets on the
// board, so it lives inside the widget body instead (see EditorWidget.tsx).
// The language picker lives there too, next to the target table, and is saved
// with the widget's state rather than as a declarative setting.

/** Languages the editor offers - both runnable (see EditorWidget). */
export const EDITOR_LANGUAGES = [
    { label: 'SQL (DuckDB)', value: 'sql' },
    { label: 'qpl', value: 'qpl' },
] as const;

export const EditorWidgetConfig: BaseWidgetDict = {
    type: 'editor',
    disabled: false,
    name: 'Code Editor',
    description: 'Monaco editor with syntax highlighting; runs SQL or qpl against a linked data table.',
    maxNo: 10,
    defaultLayout: { ...DefaultLayout, initialWidth: 640, initialHeight: 360 },
    settings: [],
};
