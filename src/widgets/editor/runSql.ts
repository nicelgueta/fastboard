import * as arrow from 'apache-arrow';
import { getDuckDb } from '../../data/duckdb/runtime';
import { arrowSchemaToTableSchema } from '../../data/decode';
import type { TableWidgetExports } from '../types';

export interface RunSqlResult {
  totalRows: number;
  elapsedMs: number;
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
