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

    it('maps date/timestamp to text, since they arrive pre-formatted', () => {
        expect(fieldTypeToCellDataType('date')).toBe('text');
        expect(fieldTypeToCellDataType('timestamp')).toBe('text');
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

    it('keeps ag-grid\'s sort UI (server-paged data) but disables its own filter UI', () => {
        const defs = schemaToColDefs(schema);
        for (const d of defs) {
            expect(d.sortable).toBe(true);
            expect(d.filter).toBe(false);
        }
    });

    it('installs a no-op comparator for server-paged data so ag-grid never reorders a page locally', () => {
        const defs = schemaToColDefs(schema, { serverSort: true });
        for (const d of defs) {
            expect(d.comparator).toBeDefined();
            const comparator = d.comparator as (...args: any[]) => number;
            expect(comparator(1, 2, null, null, false)).toBe(0);
        }
    });

    it('leaves real client-side sorting on for a pushed result set', () => {
        const defs = schemaToColDefs(schema, { serverSort: false });
        for (const d of defs) {
            expect(d.comparator).toBeUndefined();
        }
    });
});
