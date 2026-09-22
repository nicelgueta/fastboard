import * as arrow from 'apache-arrow';
import { describe, expect, it } from 'vitest';
import { formatArrowTable } from './formatTable';

describe('formatArrowTable', () => {
    it('box-draws columns and rows with a trailing row count', () => {
        const table = arrow.tableFromArrays({ id: [1, 2], name: ['a', 'bb'] });
        const text = formatArrowTable(table);
        expect(text).toBe(
            [
                '┌────┬──────┐',
                '│ id │ name │',
                '├────┼──────┤',
                '│ 1  │ a    │',
                '│ 2  │ bb   │',
                '└────┴──────┘',
                '(2 rows)',
            ].join('\n')
        );
    });

    it('renders null cells as NULL', () => {
        const table = arrow.tableFromArrays({ n: [1, null] });
        expect(formatArrowTable(table)).toContain('NULL');
    });

    it('caps rows shown and says how many more there were', () => {
        const table = arrow.tableFromArrays({ n: Array.from({ length: 5 }, (_, i) => i) });
        const text = formatArrowTable(table, 2);
        expect(text).toContain('… (3 more rows not shown)');
        expect(text).toContain('(5 rows)');
    });

    it('handles a table with no columns', () => {
        const table = arrow.tableFromArrays({});
        expect(formatArrowTable(table)).toBe('(0 columns)');
    });

    it('says "1 row" not "1 rows"', () => {
        const table = arrow.tableFromArrays({ n: [1] });
        expect(formatArrowTable(table)).toContain('(1 row)');
    });
});
