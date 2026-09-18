import type { BaseWidgetDict } from '../../interfaces';
import { DefaultLayout } from '../../layout';

// Kept dependency-free (no ag-grid, no duckdb, no TableWidget import) so
// registry.ts can statically list the widget in the "Add tool" menu without
// pulling in any of the heavy widget code - see registry.ts's comment.
export const TableWidgetConfig: BaseWidgetDict = {
    type: 'table',
    disabled: false,
    name: 'Data Table',
    description: 'A filterable, paginated data table over a CSV, JSON or Parquet source.',
    maxNo: 10,
    defaultLayout: { ...DefaultLayout, initialWidth: 720, initialHeight: 420 },
    settings: [
        {
            label: 'Page size',
            settingsKey: 'defaultPageSize',
            tooltip: 'Rows fetched per page.',
            type: 'select',
            options: [
                { label: '25', value: 25 },
                { label: '50', value: 50 },
                { label: '100', value: 100 },
                { label: '250', value: 250 },
                { label: '500', value: 500 },
            ],
            default: 25,
        },
        {
            label: 'Source table',
            settingsKey: 'sourceTableName',
            tooltip: 'Name of an existing duckdb table to bind to on load. Leave blank to upload a file instead.',
            type: 'input',
            default: '',
        },
        {
            label: 'Show filter bar',
            settingsKey: 'showFilterBar',
            tooltip: 'Show the filter toolbar above the grid.',
            type: 'switch',
            default: true,
        },
    ],
};
