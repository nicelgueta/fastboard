import * as arrow from 'apache-arrow';

/**
 * Turning a JS value list into an Arrow column, shared by the parquet and CSV
 * decoders. The caller decides the Arrow type (a Layout); this lays the values
 * out in the typed buffer that type needs, with a validity bitmap for nulls.
 */

/** How a column is materialised: an Arrow type, and the JS buffer that backs it. */
export type Layout =
    | { kind: 'bool' }
    | { kind: 'utf8' }
    | { kind: 'json' }
    | { kind: 'num'; type: arrow.DataType; ctor: NumCtor }
    | { kind: 'big'; type: arrow.DataType; ctor: BigCtor };

type NumCtor = Int32ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor;
type BigCtor = BigInt64ArrayConstructor | BigUint64ArrayConstructor;

export const isNull = (v: unknown): boolean => v === null || v === undefined;

function toJsonText(v: unknown): string | null {
    if (isNull(v)) return null;
    return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x));
}

export function buildVector(values: ArrayLike<unknown>, layout: Layout): arrow.Vector {
    const n = values.length;
    switch (layout.kind) {
        case 'bool':
            return arrow.vectorFromArray(Array.from(values as ArrayLike<boolean | null>), new arrow.Bool());
        case 'utf8':
            return arrow.vectorFromArray(
                Array.from(values as ArrayLike<string | null>, (v) => (isNull(v) ? null : String(v))),
                new arrow.Utf8(),
            );
        case 'json':
            return arrow.vectorFromArray(Array.from(values, toJsonText), new arrow.Utf8());
        case 'num':
        case 'big': {
            const data = new (layout.ctor as new (n: number) => ArrayLike<number | bigint> & { [i: number]: number | bigint })(n);
            const bitmap = new Uint8Array((n + 7) >> 3);
            let nullCount = 0;
            for (let i = 0; i < n; i++) {
                const v = values[i];
                if (isNull(v)) {
                    nullCount++;
                    continue;
                }
                bitmap[i >> 3] |= 1 << (i & 7);
                data[i] = layout.kind === 'big' ? BigInt(v as bigint | number) : Number(v);
            }
            return arrow.makeVector(
                arrow.makeData({
                    // makeData only accepts `data` for a concrete numeric type; the
                    // layout already guarantees `data` is the right buffer for it.
                    type: layout.type as arrow.Int64,
                    length: n,
                    nullCount,
                    data: data as never,
                    nullBitmap: nullCount > 0 ? bitmap : undefined,
                }),
            );
        }
    }
}
