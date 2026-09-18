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
  return table.toArray().map((r) => normalizeRow(r.toJSON() as Record<string, unknown>));
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
