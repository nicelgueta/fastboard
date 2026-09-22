import * as arrow from 'apache-arrow';
import { getQplSession } from '../../data/qpl/runtime';
import { arrowSchemaToTableSchema } from '../../data/decode';
import { formatArrowTable } from './formatTable';
import type { TableWidgetExports } from '../types';
import type { RunSqlResult } from './runSql';

export interface RunQplResult extends RunSqlResult {
    /** Text the statements printed (`log`, a scalar, a list), whether or not a table came back too. */
    output: string;
    /** False when nothing was pushed to the table (a scalar, an assignment). */
    returnedTable: boolean;
}

/** A qpl failure that still carries what the statements printed before it. */
export class QplRunError extends Error {
    constructor(message: string, readonly output: string) {
        super(message);
        this.name = 'QplRunError';
    }
}

/**
 * Runs qpl `src` in the shared interpreter and pushes the resulting table into
 * `target`, the same way runSql.ts does for duckdb: Arrow IPC bytes through
 * TableWidgetExports.setResult. When the statements produce no table (a scalar,
 * an assignment) nothing is pushed. Either way what they printed comes back in
 * `output`.
 *
 * Throws a QplRunError on a qpl error - callers should surface `err.message`
 * verbatim, and `err.output` is whatever printed before it.
 */
export async function runQplAgainstTarget(
    src: string,
    target: TableWidgetExports,
    source?: { wKey: string; name: string },
): Promise<RunQplResult> {
    const session = await getQplSession();
    const start = performance.now();
    const result = await session.run(src);
    const elapsedMs = performance.now() - start;
    if (result.error) throw new QplRunError(result.error, result.output);
    if (!result.ipc) return { totalRows: 0, elapsedMs, output: result.output, returnedTable: false };

    const table = arrow.tableFromIPC(result.ipc);
    target.setResult({
        bytes: result.ipc,
        format: 'arrow-ipc',
        totalRows: table.numRows,
        schema: arrowSchemaToTableSchema(table, target.tableName ?? 'query_result'),
        source,
    });
    return { totalRows: table.numRows, elapsedMs, output: result.output, returnedTable: true };
}

/**
 * Raw mode: no target table widget is linked, so `src` runs in the shared
 * interpreter exactly as it would in a local qpl REPL - a resulting table is
 * printed as text (appended to whatever the statements printed) instead of
 * being pushed anywhere.
 */
export async function runQplRaw(src: string): Promise<RunQplResult> {
    const session = await getQplSession();
    const start = performance.now();
    const result = await session.run(src);
    const elapsedMs = performance.now() - start;
    if (result.error) throw new QplRunError(result.error, result.output);
    if (!result.ipc) return { totalRows: 0, elapsedMs, output: result.output, returnedTable: false };

    const table = arrow.tableFromIPC(result.ipc);
    const printed = formatArrowTable(table);
    const output = result.output ? `${result.output}\n${printed}` : printed;
    return { totalRows: table.numRows, elapsedMs, output, returnedTable: true };
}
