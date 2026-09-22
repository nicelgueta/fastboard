import * as arrow from 'apache-arrow';
import { getDuckDb } from '../../data/duckdb/runtime';
import { arrowSchemaToTableSchema } from '../../data/decode';
import { formatArrowTable } from './formatTable';
import type { TableWidgetExports } from '../types';

export interface RunSqlResult {
  totalRows: number;
  elapsedMs: number;
}

export interface RunSqlRawResult extends RunSqlResult {
  /** The result printed as a text table, the way a CLI would show it. */
  text: string;
}

/**
 * Runs `sql` against the shared duckdb instance and pushes the result into
 * `target` (a table widget's published exports) as Arrow IPC bytes - the
 * same wire format DataSource.query returns (src/data/types.ts). Expression
 * goes out, Arrow comes back; duckdb (via the table widget) renders it.
 *
 * Throws on a duckdb error - callers should surface `err.message` verbatim,
 * it is genuinely useful.
 */
export async function runSqlAgainstTarget(
  sql: string,
  target: TableWidgetExports,
  source?: { wKey: string; name: string }
): Promise<RunSqlResult> {
  const db = await getDuckDb();
  const conn = await db.connect();
  const start = performance.now();
  try {
    const table = await conn.query(sql);
    const elapsedMs = performance.now() - start;
    const bytes = arrow.tableToIPC(table, 'stream');
    const schema = arrowSchemaToTableSchema(table, target.tableName ?? 'query_result');
    target.setResult({
      bytes,
      format: 'arrow-ipc',
      totalRows: table.numRows,
      schema,
      source,
    });
    return { totalRows: table.numRows, elapsedMs };
  } finally {
    await conn.close();
  }
}

/**
 * Raw mode: no target table widget is linked, so `sql` runs against the
 * shared duckdb instance exactly as it would on the CLI, and the result comes
 * back as text to print in the editor's output log instead of arrow-ipc.
 */
export async function runSqlRaw(sql: string): Promise<RunSqlRawResult> {
  const db = await getDuckDb();
  const conn = await db.connect();
  const start = performance.now();
  try {
    const table = await conn.query(sql);
    const elapsedMs = performance.now() - start;
    return { totalRows: table.numRows, elapsedMs, text: formatArrowTable(table) };
  } finally {
    await conn.close();
  }
}
