import { describe, expect, it } from 'vitest';
import * as arrow from 'apache-arrow';
import { csvToArrow } from './csv';

const col = (t: arrow.Table, name: string) => [...t.getChild(name)!];
const types = (t: arrow.Table) => Object.fromEntries(t.schema.fields.map((f) => [f.name, f.type.toString()]));

describe('csvToArrow type inference', () => {
    it('infers a type per column', () => {
        const t = csvToArrow(
            [
                'sym,price,qty,ok,day,ts,note',
                'AAPL,182.3,100,true,2024-03-15,2024-03-15 09:30:00.123456,hello',
                'MSFT,415,250,FALSE,2024-03-16,2024-03-15T09:31:00Z,"a, b"',
            ].join('\n'),
        );
        expect(types(t)).toEqual({
            sym: 'Utf8',
            price: 'Float64',
            qty: 'Int64',
            ok: 'Bool',
            day: 'Date32<DAY>',
            ts: 'Timestamp<MICROSECOND>',
            note: 'Utf8',
        });
        expect(col(t, 'price')).toEqual([182.3, 415]);
        expect(col(t, 'qty')).toEqual([100n, 250n]);
        expect(col(t, 'ok')).toEqual([true, false]);
        expect(col(t, 'note')).toEqual(['hello', 'a, b']);
    });

    it('treats empty fields as null', () => {
        const t = csvToArrow('a,b\n1,x\n,\n3,z');
        expect(col(t, 'a')).toEqual([1n, null, 3n]);
        expect(col(t, 'b')).toEqual(['x', null, 'z']);
    });

    it('keeps values with leading zeros as text', () => {
        const t = csvToArrow('zip,n\n02134,1\n90210,2');
        expect(types(t)).toMatchObject({ zip: 'Utf8', n: 'Int64' });
        expect(col(t, 'zip')).toEqual(['02134', '90210']);
    });

    it('promotes a mix of integers and decimals to float, and huge integers too', () => {
        const t = csvToArrow('a,b\n1,9223372036854775808\n2.5,3');
        expect(types(t)).toMatchObject({ a: 'Float64', b: 'Float64' });
    });

    it('falls back to text when a column mixes kinds', () => {
        const t = csvToArrow('a,b\n1,true\nx,2');
        expect(types(t)).toEqual({ a: 'Utf8', b: 'Utf8' });
    });

    it('rejects impossible dates instead of rolling them over', () => {
        expect(types(csvToArrow('d\n2024-02-30'))).toEqual({ d: 'Utf8' });
        expect(types(csvToArrow('d\n2024-02-29'))).toEqual({ d: 'Date32<DAY>' });
        expect(types(csvToArrow('d\n2023-02-29'))).toEqual({ d: 'Utf8' });
    });

    it('keeps exact microseconds, and applies a zone offset', () => {
        const t = csvToArrow('ts\n2024-03-15 09:30:00.123456\n2024-03-15T09:30:00+01:00');
        const micros = t.getChild('ts')!.data[0].values as BigInt64Array;
        const base = BigInt(Date.UTC(2024, 2, 15, 9, 30, 0)) * 1000n;
        expect(micros[0]).toBe(base + 123456n);
        expect(micros[1]).toBe(base - 3_600_000_000n);
    });

    it('stores dates as days since the epoch', () => {
        const t = csvToArrow('d\n1969-12-31\n2000-01-01');
        expect(t.getChild('d')!.data[0].values[0]).toBe(-1);
        expect(t.getChild('d')!.data[0].values[1]).toBe(10957);
    });
});

describe('csvToArrow parsing', () => {
    it('handles quotes, embedded newlines, a BOM and CRLF', () => {
        const t = csvToArrow('﻿name,bio\r\n"Ann","line1\nline2"\r\n"Bob ""B""",x\r\n');
        expect(t.schema.fields.map((f) => f.name)).toEqual(['name', 'bio']);
        expect(col(t, 'name')).toEqual(['Ann', 'Bob "B"']);
        expect(col(t, 'bio')).toEqual(['line1\nline2', 'x']);
    });

    it('detects other delimiters', () => {
        expect(col(csvToArrow('a;b\n1;2\n3;4'), 'b')).toEqual([2n, 4n]);
        expect(col(csvToArrow('a\tb\n1\t2'), 'b')).toEqual([2n]);
    });

    it('names blank and duplicate headers', () => {
        const t = csvToArrow('a,,a,b\n1,2,3,4');
        expect(t.schema.fields.map((f) => f.name)).toEqual(['a', 'column_2', 'a_2', 'b']);
    });

    it('tolerates ragged rows and blank lines', () => {
        const t = csvToArrow('a,b,c\n1,2\n\n3,4,5,6\n');
        expect(t.numRows).toBe(2);
        expect(col(t, 'c')).toEqual([null, 5n]);
    });

    it('a header-only file is an empty table of text columns', () => {
        const t = csvToArrow('a,b');
        expect(t.numRows).toBe(0);
        expect(t.schema.fields.map((f) => f.name)).toEqual(['a', 'b']);
    });

    it('rejects an empty file', () => {
        expect(() => csvToArrow('')).toThrow(/empty/);
        expect(() => csvToArrow('\n\n')).toThrow(/empty/);
    });

    it('round-trips through the Arrow IPC stream format', () => {
        const t = csvToArrow('a,b,c\n1,x,2024-01-01\n,,\n3,z,2024-01-03');
        const back = arrow.tableFromIPC(arrow.tableToIPC(t, 'stream'));
        expect(col(back, 'a')).toEqual([1n, null, 3n]);
        expect(col(back, 'c').length).toBe(3);
    });
});
