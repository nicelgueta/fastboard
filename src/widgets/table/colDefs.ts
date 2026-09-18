import type { ColDef } from 'ag-grid-community';
import type { FieldType, TableSchema } from '../../data/types';

/**
 * Column-def mapping, split out from TableWidget.tsx so it can be unit
 * tested in node without pulling in ag-grid-react/Chakra/duckdb (this file
 * only needs ag-grid-community's types, which are type-only imports and
 * erased at build time - no runtime ag-grid dependency here).
 */
export function fieldTypeToCellDataType(t: FieldType): 'text' | 'number' | 'boolean' | 'date' | 'dateString' {
    switch (t) {
        case 'number':
        case 'integer':
            return 'number';
        case 'boolean':
            return 'boolean';
        case 'date':
        case 'timestamp':
            return 'dateString';
        default:
            return 'text';
    }
}

export interface ColDefOptions {
    /**
     * True when duckdb owns the ordering (a bound DataSource, paged
     * server-side). ag-grid's client-side row model only holds the current
     * page, so letting it sort would reorder that page only - visibly wrong.
     * A no-op comparator keeps the header's sort UI while leaving the actual
     * ORDER BY to the query; see TableWidget's onSortChanged.
     *
     * False for a pushed result set, where the widget holds every row and
     * ag-grid can sort it correctly by itself.
     */
    serverSort: boolean;
}

export function schemaToColDefs(schema: TableSchema, opts: ColDefOptions = { serverSort: true }): ColDef[] {
    return schema.fields.map((f) => ({
        field: f.name,
        headerName: f.label ?? f.name,
        cellDataType: fieldTypeToCellDataType(f.type),
        sortable: true,
        ...(opts.serverSort ? { comparator: () => 0 } : {}),
        filter: false,
        resizable: true,
        // Share the panel width between columns instead of leaving dead space
        // to the right of the last one. minWidth keeps them readable when a
        // table has many columns (they overflow into a horizontal scroll).
        flex: 1,
        minWidth: 120,
    }));
}
