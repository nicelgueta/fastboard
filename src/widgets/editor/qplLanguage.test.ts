import { describe, expect, it } from 'vitest';
import { symbolCompletions } from './qplLanguage';

describe('symbolCompletions', () => {
    it('offers tables, their columns, variables and functions', () => {
        const items = symbolCompletions({
            tables: [{ name: 'trades', columns: ['sym', 'price'], rows: 8 }, { name: 'lazy' }],
            variables: ['n'],
            functions: ['f'],
        });
        const by = (label: string) => items.find((i) => i.label === label);
        expect(by('trades')).toMatchObject({ kind: 'Struct', detail: 'table, 8 rows' });
        expect(by('lazy')).toMatchObject({ kind: 'Struct', detail: 'table' });
        expect(by('price')).toMatchObject({ kind: 'Field', detail: 'column of trades' });
        expect(by('n')?.kind).toBe('Variable');
        expect(by('f')?.kind).toBe('Function');
    });

    it('lists a column shared by several tables once', () => {
        const items = symbolCompletions({
            tables: [{ name: 'a', columns: ['sym'] }, { name: 'b', columns: ['sym'] }],
            variables: [],
            functions: [],
        });
        expect(items.filter((i) => i.label === 'sym')).toHaveLength(1);
    });

    it('is empty when the interpreter could not be asked', () => {
        expect(symbolCompletions(null)).toEqual([]);
    });
});
