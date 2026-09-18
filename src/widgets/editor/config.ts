import type { BaseWidgetDict, WidgetSetting } from '../../interfaces';
import { DefaultLayout } from '../../layout';

// Kept dependency-free (no monaco, no EditorWidget import) - registry.ts
// imports this statically so the "Add tool" menu can list every widget
// without loading Monaco. The target-table picker is intentionally NOT a
// declarative setting: it must reflect the live set of table widgets on the
// board, so it lives inside the widget body instead (see EditorWidget.tsx).
const LANGUAGE_SETTING: WidgetSetting = {
    label: 'Language',
    settingsKey: 'language',
    tooltip: 'Syntax highlighting language. SQL mode adds a run bar that executes the query against a linked table widget.',
    type: 'select',
    options: [
        { label: 'SQL', value: 'sql' },
        { label: 'JavaScript', value: 'javascript' },
        { label: 'TypeScript', value: 'typescript' },
        { label: 'Python', value: 'python' },
        { label: 'JSON', value: 'json' },
        { label: 'YAML', value: 'yaml' },
        { label: 'Markdown', value: 'markdown' },
        { label: 'Shell', value: 'shell' },
    ],
    default: 'sql',
};

export const EditorWidgetConfig: BaseWidgetDict = {
    type: 'editor',
    disabled: false,
    name: 'Code Editor',
    description: 'Monaco editor with syntax highlighting; runs SQL against a linked data table.',
    maxNo: 10,
    defaultLayout: { ...DefaultLayout, initialWidth: 640, initialHeight: 360 },
    settings: [LANGUAGE_SETTING],
};
