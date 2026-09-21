import { describe, expect, it } from 'vitest';
import * as arrow from 'apache-arrow';
import { tableToRows } from './decode';

const big = (type: arrow.DataType, values: (bigint | null)[]) => {
    const data = new BigInt64Array(values.map((v) => v ?? 0n));
    const nullBitmap = new Uint8Array(Math.ceil(values.length / 8));
    values.forEach((v, i) => { if (v !== null) nullBitmap[i >> 3] |= 1 << (i & 7); });
    return new arrow.Vector([arrow.makeData({ type, length: values.length, data, nullBitmap, nullCount: values.filter((v) => v === null).length } as any)]);
};
const int = (type: arrow.DataType, values: (number | null)[]) => {
    const data = new Int32Array(values.map((v) => v ?? 0));
    const nullBitmap = new Uint8Array(Math.ceil(values.length / 8));
    values.forEach((v, i) => { if (v !== null) nullBitmap[i >> 3] |= 1 << (i & 7); });
    return new arrow.Vector([arrow.makeData({ type, length: values.length, data, nullBitmap, nullCount: values.filter((v) => v === null).length } as any)]);
};

const roundTrip = (t: arrow.Table) => arrow.tableFromIPC(arrow.tableToIPC(t, 'stream'));

describe('tableToRows temporal columns', () => {
    it('formats dates', () => {
        const day = (n: number) => new Date(n * 86_400_000);
        const t = new arrow.Table({
            d: arrow.vectorFromArray([day(19797), null, day(-1)], new arrow.DateDay()),
            d64: arrow.vectorFromArray([day(19797), new Date(1710495000123), null], new arrow.DateMillisecond()),
        });
        const rows = tableToRows(roundTrip(t));
        expect(rows.map((r) => r.d)).toEqual(['2024-03-15', null, '1969-12-31']);
        expect(rows.map((r) => r.d64)).toEqual(['2024-03-15', '2024-03-15 09:30:00.123', null]);
    });

    it('formats timestamps at their own precision', () => {
        const ms = 1710495000123n;
        const t = new arrow.Table({
            s: big(new arrow.TimestampSecond(), [1710495000n, null]),
            ms: big(new arrow.TimestampMillisecond(), [ms, 1710495060000n]),
            us: big(new arrow.TimestampMicrosecond(), [1710495000123456n, 0n]),
            ns: big(new arrow.TimestampNanosecond(), [1710495000123456789n, -1n]),
        });
        const rows = tableToRows(roundTrip(t));
        expect(rows[0]).toEqual({
            s: '2024-03-15 09:30:00',
            ms: '2024-03-15 09:30:00.123',
            us: '2024-03-15 09:30:00.123456',
            ns: '2024-03-15 09:30:00.123456789',
        });
        expect(rows[1]).toEqual({
            s: null,
            ms: '2024-03-15 09:31:00',
            us: '1970-01-01 00:00:00',
            ns: '1969-12-31 23:59:59.999999999',
        });
    });

    it('formats times of day', () => {
        const t = new arrow.Table({
            t32: int(new arrow.TimeMillisecond(), [34_200_000, null]),
            t64: big(new arrow.TimeNanosecond(), [34_200_000_000_123n, 0n]),
        });
        expect(tableToRows(roundTrip(t))).toEqual([
            { t32: '09:30:00', t64: '09:30:00.000000123' },
            { t32: null, t64: '00:00:00' },
        ]);
    });

    it('leaves other columns alone', () => {
        const t = arrow.tableFromArrays({ n: [1, 2], s: ['a', 'b'] });
        expect(tableToRows(t)).toEqual([{ n: 1, s: 'a' }, { n: 2, s: 'b' }]);
    });
});
