import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as arrow from 'apache-arrow';
import { parquetToArrow, parquetToIpc } from './parquet';

const fixture = (name: string): ArrayBuffer => {
    const buf = readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

const col = (t: arrow.Table, name: string) => [...t.getChild(name)!];

describe('parquetToArrow', () => {
    it('keeps the parquet column types', async () => {
        const t = await parquetToArrow(fixture('mixed.snappy.parquet'));
        const types = Object.fromEntries(t.schema.fields.map((f) => [f.name, f.type.toString()]));
        expect(types).toEqual({
            sym: 'Utf8',
            price: 'Float64',
            qty32: 'Int32',
            size: 'Int64',
            big: 'Int64',
            u8: 'Int32',
            ok: 'Bool',
            day: 'Date32<DAY>',
            ts_us: 'Timestamp<MICROSECOND>',
            ts_ms: 'Timestamp<MILLISECOND>',
            dec: 'Float64',
            tags: 'Utf8',
        });
        expect(t.numRows).toBe(4);
    });

    it('preserves values and nulls', async () => {
        const t = await parquetToArrow(fixture('mixed.snappy.parquet'));
        expect(col(t, 'sym')).toEqual(['AAPL', 'MSFT', null, 'GOOG']);
        expect(col(t, 'price')).toEqual([182.3, 415.2, 140.5, null]);
        expect(col(t, 'qty32')).toEqual([1, 2, 3, 4]);
        expect(col(t, 'size')).toEqual([100n, 250n, null, 300n]);
        expect(col(t, 'ok')).toEqual([true, false, null, true]);
        expect(col(t, 'dec')).toEqual([1.25, 2.5, null, -0.01]);
    });

    it('does not lose precision on 64-bit ints beyond 2^53', async () => {
        const t = await parquetToArrow(fixture('mixed.snappy.parquet'));
        expect(col(t, 'big')[0]).toBe(2n ** 62n);
    });

    it('keeps microsecond timestamps and dates exact', async () => {
        const t = await parquetToArrow(fixture('mixed.snappy.parquet'));
        // 2024-03-15T09:30:00.123456 UTC, as microseconds since the epoch
        const micros = BigInt(Date.UTC(2024, 2, 15, 9, 30, 0)) * 1000n + 123456n;
        // arrow-js reports a Timestamp cell in milliseconds, so check the raw buffer
        expect(t.getChild('ts_us')!.data[0].values[0]).toBe(micros);
        expect(t.getChild('ts_us')!.get(1)).toBeNull();
        expect(t.getChild('ts_ms')!.get(0)).toBe(Date.UTC(2024, 2, 15, 9, 30));
        // date32 is days since the epoch; 1969-12-31 is -1
        expect(t.getChild('day')!.data[0].values[1]).toBe(-1);
        expect(t.getChild('day')!.data[0].values[0]).toBe(Math.floor(Date.UTC(2024, 2, 15) / 86_400_000));
    });

    it('keeps nested columns as JSON text', async () => {
        const t = await parquetToArrow(fixture('mixed.snappy.parquet'));
        expect(col(t, 'tags')).toEqual(['["a","b"]', '[]', null, '["c"]']);
    });

    it('reads zstd-compressed files', async () => {
        const t = await parquetToArrow(fixture('mixed.zstd.parquet'));
        expect(col(t, 'sym')).toEqual(['AAPL', 'MSFT', null, 'GOOG']);
    });

    it('joins row groups in order', async () => {
        const t = await parquetToArrow(fixture('mixed.multi-rowgroup.parquet'));
        expect(t.numRows).toBe(4);
        expect(col(t, 'qty32')).toEqual([1, 2, 3, 4]);
        expect(col(t, 'sym')).toEqual(['AAPL', 'MSFT', null, 'GOOG']);
    });
});

describe('parquetToIpc', () => {
    it('round-trips through the Arrow IPC stream format', async () => {
        const back = arrow.tableFromIPC(await parquetToIpc(fixture('mixed.snappy.parquet')));
        expect(back.numRows).toBe(4);
        expect(col(back, 'size')).toEqual([100n, 250n, null, 300n]);
        expect(back.schema.fields.find((f) => f.name === 'ts_us')!.type.toString()).toBe('Timestamp<MICROSECOND>');
    });
});
