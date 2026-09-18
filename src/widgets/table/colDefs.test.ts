import { describe, expect, it } from 'vitest';
import { fieldTypeToCellDataType, schemaToColDefs } from './colDefs';
import type { TableSchema } from '../../data/types';

describe('fieldTypeToCellDataType', () => {
    it('maps numeric types to number', () => {
        expect(fieldTypeToCellDataType('number')).toBe('number');
        expect(fieldTypeToCellDataType('integer')).toBe('number');
    });

    it('maps boolean', () => {
        expect(fieldTypeToCellDataType('boolean')).toBe('boolean');
    });

    it('maps date/timestamp to dateString', () => {
        expect(fieldTypeToCellDataType('date')).toBe('dateString');
        expect(fieldTypeToCellDataType('timestamp')).toBe('dateString');
    });

    it('falls back to text for string and categorical', () => {
        expect(fieldTypeToCellDataType('string')).toBe('text');
        expect(fieldTypeToCellDataType('categorical')).toBe('text');
    });
});

describe('schemaToColDefs', () => {
    const schema: TableSchema = {
        name: 't',
        fields: [
            { name: 'id', type: 'integer' },
            { name: 'label', label: 'Label', type: 'string' },
            { name: 'active', type: 'boolean' },
        ],
    };

    it('builds one colDef per field, preferring label over name for headerName', () => {
        const defs = schemaToColDefs(schema);
        expect(defs).toHaveLength(3);
        expect(defs[0]).toMatchObject({ field: 'id', headerName: 'id', cellDataType: 'number' });
        expect(defs[1]).toMatchObject({ field: 'label', headerName: 'Label', cellDataType: 'text' });
        expect(defs[2]).toMatchObject({ field: 'active', headerName: 'active', cellDataType: 'boolean' });
    });

    it('disables client-side sort/filter on every column (server-paged data, own filter UI)', () => {
        const defs = schemaToColDefs(schema);
        for (const d of defs) {
            expect(d.sortable).toBe(false);
            expect(d.filter).toBe(false);
        }
    });
});
