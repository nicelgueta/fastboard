import type { BaseWidgetDict } from '../../interfaces';
import { DefaultLayout } from '../../layout';

// Kept dependency-free (no three.js, no duckdb, no GraphWidget import) so
// registry.ts can list the widget in the "Add to board" menu without loading
// any of the graph code.

/** Catalog levels the graph can show, from the roots down. Shared by the setting and the widget toolbar. */
export const GRAPH_DEPTH_OPTIONS = [
    { label: 'Databases only', value: 0 },
    { label: 'Down to schemas', value: 1 },
    { label: 'Down to tables', value: 2 },
    { label: 'Down to columns', value: 3 },
];

export const GraphWidgetConfig: BaseWidgetDict = {
    type: 'graph',
    disabled: false,
    name: '3D Catalog Graph',
    description: 'Explore the loaded data catalog - databases, schemas, tables and columns - as a 3D graph.',
    maxNo: 3,
    defaultLayout: { ...DefaultLayout, initialWidth: 720, initialHeight: 480 },
    settings: [
        {
            label: 'Default depth',
            settingsKey: 'defaultDepth',
            tooltip: 'How many catalog levels to draw. Fewer levels is much faster on large catalogs; you can change it live from the widget toolbar.',
            type: 'select',
            options: GRAPH_DEPTH_OPTIONS,
            default: 3,
        },
    ],
};
