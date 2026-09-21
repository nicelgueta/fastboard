import * as arrow from 'apache-arrow';
import type { QueryResult, TableSchema, FieldDef } from './types';

/**
 * Decoding helpers for QueryResult's columnar bytes.
 *
 * The DataSource interface hands back Arrow IPC or Parquet (see types.ts).
 * Views convert to whatever they need at the last moment - ag-grid wants plain
 * row objects, so `resultToRows` is what the table widget calls. Parquet is
 * decoded by handing the bytes to duckdb rather than parsing them in JS.
 */

/** Arrow IPC decodes natively; Parquet is routed through duckdb. */
export async function resultToTable(result: QueryResult): Promise<arrow.Table> {
  if (result.format === 'arrow-ipc') {
    return arrow.tableFromIPC(result.bytes);
  }
  // Parquet: register the buffer as a virtual file and let duckdb read it.
  // Imported lazily so that a caller only ever handling Arrow does not drag
  // the duckdb bundle into its chunk.
  const { getDuckDb } = await import('./duckdb/runtime');
  const db = await getDuckDb();
  const name = `__decode_${Date.now()}_${Math.random().toString(36).slice(2)}.parquet`;
  await db.registerFileBuffer(name, result.bytes);
  const conn = await db.connect();
  try {
    return await conn.query(`SELECT * FROM read_parquet('${name}')`);
  } finally {
    await conn.close();
    await db.dropFile(name).catch(() => {
      /* best effort - a leaked virtual file is not worth failing a query over */
    });
  }
}

/**
 * Row objects for a view layer (ag-grid's rowData, etc).
 *
 * Note this materializes every row: call it per page, not on a whole table.
 */
export async function resultToRows(result: QueryResult): Promise<Record<string, unknown>[]> {
  const table = await resultToTable(result);
  return tableToRows(table);
}

export function tableToRows(table: arrow.Table): Record<string, unknown>[] {
  const rows = table.toArray().map((r) => normalizeRow(r.toJSON() as Record<string, unknown>));
  // Arrow's own decode of these is epoch millis (or a bare integer for a time of
  // day), which a grid shows as a big number, so they are replaced with text.
  for (const field of table.schema.fields) {
    const col = table.getChild(field.name);
    if (!col || !isTemporal(field.type)) continue;
    const texts = temporalToText(col as arrow.Vector);
    for (let i = 0; i < rows.length; i++) rows[i][field.name] = texts[i];
  }
  return rows;
}

const isTemporal = (t: arrow.DataType) =>
  arrow.DataType.isDate(t) || arrow.DataType.isTimestamp(t) || arrow.DataType.isTime(t);

const UNIT_DIGITS = [0, 3, 6, 9]; // arrow.TimeUnit: SECOND, MILLISECOND, MICROSECOND, NANOSECOND

/**
 * Text for each value of a date / timestamp / time column, read from the raw
 * integers so microsecond and nanosecond timestamps keep their precision (Arrow
 * JS would round them through a float of milliseconds). Dates are
 * `YYYY-MM-DD`, timestamps `YYYY-MM-DD HH:MM:SS[.fff]` and times
 * `HH:MM:SS[.fff]`, all UTC, with the fraction shown only when non-zero.
 */
export function temporalToText(col: arrow.Vector): (string | null)[] {
  const type = col.type as arrow.DataType;
  const isDate = arrow.DataType.isDate(type);
  const isDay = isDate && (type as arrow.Date_).unit === arrow.DateUnit.DAY;
  const digits = isDate ? 3 : UNIT_DIGITS[(type as arrow.Timestamp | arrow.Time).unit] ?? 0;

  const out: (string | null)[] = [];
  for (const data of col.data) {
    // 64-bit types come as a BigInt64Array, except Date64 which is pairs of 32-bit words
    const values = data.values as Int32Array | BigInt64Array;
    const pairs = values instanceof Int32Array && isDate && !isDay;
    for (let i = 0; i < data.length; i++) {
      if (!data.getValid(i)) {
        out.push(null);
        continue;
      }
      const at = data.offset + i;
      const raw = pairs
        ? (BigInt(values[2 * at + 1]) << 32n) | BigInt((values as Int32Array)[2 * at] >>> 0)
        : BigInt(values[at]);
      out.push(
        isDay ? isoDate(raw * 86_400n) : arrow.DataType.isTime(type) ? clock(raw, digits) : stamp(raw, digits, isDate),
      );
    }
  }
  return out;
}

const floorDiv = (a: bigint, b: bigint) => (a / b) - (a % b !== 0n && (a < 0n) !== (b < 0n) ? 1n : 0n);
const pad = (n: number | bigint, w = 2) => String(n).padStart(w, '0');

/** `YYYY-MM-DD` for whole seconds since the epoch. */
function isoDate(secs: bigint): string {
  return new Date(Number(secs) * 1000).toISOString().slice(0, 10);
}

/** `.fff` for the sub-second part `frac` of a value with `digits` places, trailing zeros dropped; '' when zero. */
function fraction(frac: bigint, digits: number): string {
  if (digits === 0 || frac === 0n) return '';
  return '.' + pad(frac, digits).replace(/0+$/, '');
}

function stamp(v: bigint, digits: number, dateOnly: boolean): string {
  const per = 10n ** BigInt(digits);
  const secs = floorDiv(v, per);
  const iso = new Date(Number(secs) * 1000).toISOString();
  // a Date64 that is exactly midnight is a plain date
  if (dateOnly && secs % 86_400n === 0n && v - secs * per === 0n) return iso.slice(0, 10);
  return iso.slice(0, 10) + ' ' + iso.slice(11, 19) + fraction(v - secs * per, digits);
}

function clock(v: bigint, digits: number): string {
  const per = 10n ** BigInt(digits);
  const secs = floorDiv(v, per);
  const s = Number(((secs % 86_400n) + 86_400n) % 86_400n);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}${fraction(v - secs * per, digits)}`;
}

/**
 * Arrow hands back values JS views choke on: BigInt for 64-bit ints (React
 * cannot render it, JSON.stringify throws on it) and Arrow-internal wrappers
 * for dates. Flatten to plain JS so grids and editors can consume it.
 */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = normalizeValue(v);
  }
  return out;
}

export function normalizeValue(v: unknown): unknown {
  if (typeof v === 'bigint') {
    // Outside the safe range, keep it as a string rather than silently losing
    // precision - a wrong number is worse than a string in a cell.
    return v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(v)
      : v.toString();
  }
  if (v instanceof Date) return v;
  if (ArrayBuffer.isView(v)) return Array.from(v as unknown as ArrayLike<number>);
  return v;
}

/** Map an Arrow schema onto FastBoard's FieldDef[], for building column defs. */
export function arrowSchemaToTableSchema(table: arrow.Table, name: string): TableSchema {
  const fields: FieldDef[] = table.schema.fields.map((f) => ({
    name: f.name,
    type: arrowTypeToFieldType(f.type),
    nullable: f.nullable,
  }));
  return { name, fields, rowCount: table.numRows };
}

function arrowTypeToFieldType(t: arrow.DataType): FieldDef['type'] {
  if (arrow.DataType.isBool(t)) return 'boolean';
  if (arrow.DataType.isInt(t)) return 'integer';
  if (arrow.DataType.isFloat(t) || arrow.DataType.isDecimal(t)) return 'number';
  if (arrow.DataType.isDate(t)) return 'date';
  if (arrow.DataType.isTimestamp(t)) return 'timestamp';
  return 'string';
}
