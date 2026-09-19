import * as arrow from 'apache-arrow';
import { arrowSchemaToTableSchema } from '../decode';
import { sanitizeTableName } from '../tableName';
import type { DataSource, QueryRequest, QueryResult, TableSchema } from '../types';
import { getQplSession } from './runtime';
import type { QplResult } from './runner';

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** A column name that can be written bare in a qpl query. */
function requireIdent(name: string): string {
    if (!IDENT_RE.test(name)) {
        throw new Error(`Column "${name}" can't be used here: qpl queries need a plain identifier name.`);
    }
    return name;
}

function unwrap(r: QplResult): Uint8Array {
    if (r.error) throw new Error(r.error);
    if (!r.ipc) throw new Error(r.output.trim() || 'The query did not return a table.');
    return r.ipc;
}

/**
 * DataSource for a table held by the qpl interpreter (see ingest.ts for how
 * tables get there).
 *
 * Sorting and the row window are both done by qpl (`order`, and `limit` with a
 * negative count for an offset - see query()). There is no filter:
 * the table widget's expression builder targets SQL, and compiling it to qpl is
 * deliberately not done (`supportsFilter` is false). To filter, use the qpl
 * editor widget.
 */
export class QplDataSource implements DataSource {
    readonly id: string;
    readonly label: string;
    readonly sqlName: string;
    readonly supportsFilter = false;
    private readonly tableName: string;
    private schemaCache: TableSchema | null = null;

    constructor(tableName: string, opts?: { id?: string; label?: string }) {
        this.tableName = sanitizeTableName(tableName);
        this.id = opts?.id ?? `qpl:${this.tableName}`;
        this.label = opts?.label ?? this.tableName;
        this.sqlName = this.tableName;
    }

    async getSchema(): Promise<TableSchema> {
        if (this.schemaCache) return this.schemaCache;
        const session = await getQplSession();
        // `0 limit` returns no rows but keeps the columns
        const empty = arrow.tableFromIPC(unwrap(await session.evalStatement(`0 limit select from ${this.tableName}`)));
        this.schemaCache = { ...arrowSchemaToTableSchema(empty, this.tableName), rowCount: await session.rowCount(this.tableName) };
        return this.schemaCache;
    }

    /** Drop the cached schema, e.g. after the underlying table changes shape. */
    invalidateSchema(): void {
        this.schemaCache = null;
    }

    async query(req: QueryRequest): Promise<QueryResult> {
        if (req.filter) throw new Error('The qpl data source does not support filters.');
        await this.getSchema();
        const session = await getQplSession();

        const cols = req.select?.length ? req.select.map(requireIdent).join(', ') : '';
        const order = req.sort?.length
            ? ` order ${req.sort.map((s) => `${requireIdent(s.field)} ${s.direction === 'desc' ? 'desc' : 'asc'}`).join(', ')}`
            : '';
        const select = `select ${cols} from ${this.tableName}${order}`;

        // The window [offset, offset + n) is the last n rows of the first
        // offset + n: qpl's `limit` takes from the front, and a negative count
        // from the back. Done in qpl so the result bytes pass through untouched
        // (apache-arrow can't slice and re-encode 64-bit-offset text columns).
        const totalRows = await session.rowCount(this.tableName);
        const n = Math.max(0, Math.min(req.limit, totalRows - req.offset));
        const query = n === 0 ? `0 limit ${select}` : `-${n} limit ${req.offset + n} limit ${select}`;
        const bytes = unwrap(await session.evalStatement(query));

        return {
            format: 'arrow-ipc',
            bytes,
            totalRows,
            schema: { ...arrowSchemaToTableSchema(arrow.tableFromIPC(bytes), this.tableName), rowCount: totalRows },
        };
    }
}
