import * as arrow from 'apache-arrow';
import { buildVector, type Layout } from './vectors';
import { parquetMetadata, parquetRead, parquetSchema } from 'hyparquet';
import type { ColumnData, ParquetParsers, SchemaElement, SchemaTree } from 'hyparquet';

/**
 * Parquet -> Arrow, in JS, so the qpl engine can be handed a table as Arrow IPC
 * (its wasm build has no parquet reader - see src/data/qpl/runtime.ts).
 *
 * hyparquet decodes; this file decides the Arrow type of each column from the
 * parquet schema and lays the values out in typed buffers. Two choices worth
 * knowing about:
 *
 * - Timestamps and dates are NOT taken as hyparquet's default `Date` objects,
 *   which round to milliseconds. The parsers below pass the raw integers
 *   through and the column keeps the file's own unit (ms / us / ns).
 * - Only flat columns map onto Arrow columns one-to-one. Nested columns
 *   (list / struct / map) are kept as JSON text rather than dropped.
 */

/** Pass raw integers through so we can keep the file's timestamp/date precision. */
const RAW_PARSERS: Partial<ParquetParsers> = {
    timestampFromMilliseconds: (v) => v,
    timestampFromMicroseconds: (v) => v,
    timestampFromNanoseconds: (v) => v,
    dateFromDays: (v) => v,
};

type Timeunit = 'MILLIS' | 'MICROS' | 'NANOS';

function timestampType(unit: Timeunit): arrow.DataType {
    if (unit === 'MICROS') return new arrow.TimestampMicrosecond();
    if (unit === 'NANOS') return new arrow.TimestampNanosecond();
    return new arrow.TimestampMillisecond();
}

function timestampUnit(el: SchemaElement): Timeunit | undefined {
    if (el.logical_type?.type === 'TIMESTAMP') return el.logical_type.unit as Timeunit;
    if (el.converted_type === 'TIMESTAMP_MILLIS') return 'MILLIS';
    if (el.converted_type === 'TIMESTAMP_MICROS') return 'MICROS';
    // legacy INT96 timestamps: hyparquet reports nanoseconds since the epoch
    if (!el.converted_type && el.type === 'INT96') return 'NANOS';
    return undefined;
}

function layoutFor(node: SchemaTree): Layout {
    if (node.children.length > 0) return { kind: 'json' };
    const el = node.element;
    const lt = el.logical_type;
    const ct = el.converted_type;

    const unit = timestampUnit(el);
    if (unit) return { kind: 'big', type: timestampType(unit), ctor: BigInt64Array };
    if (ct === 'DATE' || lt?.type === 'DATE') {
        return { kind: 'num', type: new arrow.DateDay(), ctor: Int32Array };
    }
    // hyparquet turns DECIMAL into a JS number
    if (ct === 'DECIMAL' || lt?.type === 'DECIMAL') {
        return { kind: 'num', type: new arrow.Float64(), ctor: Float64Array };
    }

    switch (el.type) {
        case 'BOOLEAN':
            return { kind: 'bool' };
        case 'INT32': {
            const unsigned = ct === 'UINT_32' || (lt?.type === 'INTEGER' && !lt.isSigned && lt.bitWidth === 32);
            return unsigned
                ? { kind: 'num', type: new arrow.Uint32(), ctor: Uint32Array }
                : { kind: 'num', type: new arrow.Int32(), ctor: Int32Array };
        }
        case 'INT64': {
            const unsigned = ct === 'UINT_64' || (lt?.type === 'INTEGER' && !lt.isSigned && lt.bitWidth === 64);
            return unsigned
                ? { kind: 'big', type: new arrow.Uint64(), ctor: BigUint64Array }
                : { kind: 'big', type: new arrow.Int64(), ctor: BigInt64Array };
        }
        case 'FLOAT':
            return lt?.type === 'FLOAT16'
                ? { kind: 'num', type: new arrow.Float64(), ctor: Float64Array }
                : { kind: 'num', type: new arrow.Float32(), ctor: Float32Array };
        case 'DOUBLE':
            return { kind: 'num', type: new arrow.Float64(), ctor: Float64Array };
        default:
            // BYTE_ARRAY / FIXED_LEN_BYTE_ARRAY: strings, enums, uuids, json - all text by now
            return { kind: 'utf8' };
    }
}

/** Decode a parquet file into one Arrow table (all row groups concatenated). */
export async function parquetToArrow(file: ArrayBuffer): Promise<arrow.Table> {
    // hyparquet-compressors adds zstd / gzip / brotli / lz4 on top of the
    // built-in snappy; loaded on demand so plain-snappy files never pay for it.
    const { compressors } = await import('hyparquet-compressors');

    const metadata = parquetMetadata(file);
    const columns = parquetSchema(metadata).children;

    const chunks = new Map<string, ColumnData[]>();
    for (const c of columns) chunks.set(c.element.name, []);
    await parquetRead({
        file,
        metadata,
        compressors,
        parsers: RAW_PARSERS,
        onChunk: (chunk) => chunks.get(chunk.columnName)?.push(chunk),
    });

    const vectors: Record<string, arrow.Vector> = {};
    for (const node of columns) {
        const name = node.element.name;
        const parts = (chunks.get(name) ?? []).sort((a, b) => a.rowStart - b.rowStart);
        // Row groups arrive as separate chunks; join them into one value list.
        const values: unknown[] = [];
        for (const p of parts) for (let i = 0; i < p.columnData.length; i++) values.push(p.columnData[i]);
        vectors[name] = buildVector(values, layoutFor(node));
    }
    return new arrow.Table(vectors);
}

/** Convenience: parquet file -> Arrow IPC stream bytes, ready for the qpl engine. */
export async function parquetToIpc(file: ArrayBuffer): Promise<Uint8Array> {
    return arrow.tableToIPC(await parquetToArrow(file), 'stream');
}
