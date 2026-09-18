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

export function schemaToColDefs(schema: TableSchema): ColDef[] {
    return schema.fields.map((f) => ({
        field: f.name,
        headerName: f.label ?? f.name,
        cellDataType: fieldTypeToCellDataType(f.type),
        sortable: false,
        filter: false,
        resizable: true,
        // Share the panel width between columns instead of leaving dead space
        // to the right of the last one. minWidth keeps them readable when a
        // table has many columns (they overflow into a horizontal scroll).
        flex: 1,
        minWidth: 120,
    }));
}
