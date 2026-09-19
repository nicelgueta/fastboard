import { describe, it, expect } from 'vitest';
import { cellToText, rowToCsv, rowToJson } from './rowCopy';

const cols = [{ field: 'id' }, { field: 'name' }, { field: 'note' }];

describe('cellToText', () => {
    it('renders null and undefined as empty', () => {
        expect(cellToText(null)).toBe('');
        expect(cellToText(undefined)).toBe('');
    });
    it('stringifies primitives, bigint and dates', () => {
        expect(cellToText(0)).toBe('0');
        expect(cellToText(false)).toBe('false');
        expect(cellToText(9007199254740993n)).toBe('9007199254740993');
        expect(cellToText(new Date('2024-01-02T03:04:05Z'))).toBe('2024-01-02T03:04:05.000Z');
    });
    it('serialises objects as JSON', () => {
        expect(cellToText({ a: 1n })).toBe('{"a":"1"}');
    });
});

describe('rowToCsv', () => {
    it('follows column order and ignores extra keys', () => {
        expect(rowToCsv({ note: 'x', name: 'Ann', id: 1, extra: 2 }, cols)).toBe('1,Ann,x');
    });
    it('quotes fields with commas, quotes and newlines', () => {
        expect(rowToCsv({ id: 1, name: 'a,b', note: 'say "hi"\nnow' }, cols)).toBe('1,"a,b","say ""hi""\nnow"');
    });
    it('leaves missing values empty', () => {
        expect(rowToCsv({ id: 1 }, cols)).toBe('1,,');
    });
});

describe('rowToJson', () => {
    it('keeps column order, nulls missing values, and survives bigint', () => {
        const out = rowToJson({ name: 'Ann', id: 5n }, cols);
        expect(JSON.parse(out)).toEqual({ id: '5', name: 'Ann', note: null });
        expect(Object.keys(JSON.parse(out))).toEqual(['id', 'name', 'note']);
    });
});
