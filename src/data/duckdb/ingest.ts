import * as duckdb from '@duckdb/duckdb-wasm';
import { getDuckDb } from './runtime';
import type { FieldDef, FieldType, TableSchema } from '../types';

export type IngestFormat = 'csv' | 'json' | 'parquet';

const TABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * User-supplied table names reach raw SQL. Only allow identifier-safe names
 * and quote them everywhere they're embedded.
 */
export function sanitizeTableName(name: string): string {
  if (!TABLE_NAME_RE.test(name)) {
    throw new Error(
      `Invalid table name "${name}": must match ${TABLE_NAME_RE} (letters, digits, underscore; cannot start with a digit).`,
    );
  }
  return name;
}

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Map a duckdb DESCRIBE column_type string onto FieldType. */
export function mapDuckType(duckType: string): FieldType {
  const t = duckType.toUpperCase();
  if (t.includes('BOOL')) return 'boolean';
  if (t.startsWith('TIMESTAMP') || t.includes('DATETIME')) return 'timestamp';
  if (t === 'DATE') return 'date';
  if (t.includes('INT') || t === 'HUGEINT' || t === 'UHUGEINT') return 'integer';
  if (
    t.includes('DECIMAL') ||
    t.includes('FLOAT') ||
    t.includes('DOUBLE') ||
    t.includes('REAL') ||
    t.includes('NUMERIC')
  ) {
    return 'number';
  }
  return 'string';
}

export async function describeTable(tableName: string): Promise<TableSchema> {
  const db = await getDuckDb();
  const conn = await db.connect();
  try {
    const describeResult = await conn.query(`DESCRIBE ${quoteIdent(tableName)}`);
    const rows = describeResult.toArray().map((r) => r.toJSON()) as Array<{
      column_name: string;
      column_type: string;
      null: string;
    }>;
    const fields: FieldDef[] = rows.map((r) => ({
      name: r.column_name,
      type: mapDuckType(r.column_type),
      nullable: r.null !== 'NO',
    }));

    const countResult = await conn.query(`SELECT COUNT(*) AS cnt FROM ${quoteIdent(tableName)}`);
    const countRow = countResult.toArray()[0]?.toJSON() as { cnt: unknown } | undefined;
    const rowCount = countRow ? Number(countRow.cnt) : undefined;

    return { name: tableName, fields, rowCount };
  } finally {
    await conn.close();
  }
}

async function createTableFromRegisteredFile(
  safeTableName: string,
  fileHandle: string,
  readExpr: string,
): Promise<TableSchema> {
  const db = await getDuckDb();
  const conn = await db.connect();
  try {
    // fileHandle is derived from the sanitized table name plus a fixed
    // extension (never raw user input), so this literal is safe to embed.
    await conn.query(
      `CREATE OR REPLACE TABLE ${quoteIdent(safeTableName)} AS SELECT * FROM ${readExpr.replace('__FILE__', fileHandle)}`,
    );
  } finally {
    await conn.close();
  }
  return describeTable(safeTableName);
}

export async function registerCsv(file: File, tableName: string): Promise<TableSchema> {
  const safeName = sanitizeTableName(tableName);
  const db = await getDuckDb();
  const fileHandle = `${safeName}.csv`;
  await db.registerFileBuffer(fileHandle, new Uint8Array(await file.arrayBuffer()));
  return createTableFromRegisteredFile(safeName, fileHandle, `read_csv_auto('__FILE__')`);
}

export async function registerJson(file: File, tableName: string): Promise<TableSchema> {
  const safeName = sanitizeTableName(tableName);
  const db = await getDuckDb();
  const fileHandle = `${safeName}.json`;
  await db.registerFileBuffer(fileHandle, new Uint8Array(await file.arrayBuffer()));
  return createTableFromRegisteredFile(safeName, fileHandle, `read_json_auto('__FILE__')`);
}

export async function registerParquet(file: File, tableName: string): Promise<TableSchema> {
  const safeName = sanitizeTableName(tableName);
  const db = await getDuckDb();
  const fileHandle = `${safeName}.parquet`;
  await db.registerFileBuffer(fileHandle, new Uint8Array(await file.arrayBuffer()));
  return createTableFromRegisteredFile(safeName, fileHandle, `read_parquet('__FILE__')`);
}

export async function registerUrl(
  url: string,
  format: IngestFormat,
  tableName: string,
): Promise<TableSchema> {
  const safeName = sanitizeTableName(tableName);
  const db = await getDuckDb();
  const ext = format === 'parquet' ? 'parquet' : format;
  const fileHandle = `${safeName}.${ext}`;
  await db.registerFileURL(fileHandle, url, duckdb.DuckDBDataProtocol.HTTP, false);

  const readExpr =
    format === 'csv'
      ? `read_csv_auto('__FILE__')`
      : format === 'json'
        ? `read_json_auto('__FILE__')`
        : `read_parquet('__FILE__')`;

  return createTableFromRegisteredFile(safeName, fileHandle, readExpr);
}
