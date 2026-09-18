import { getDuckDb } from './runtime';
import { describeTable, quoteIdent, sanitizeTableName } from './ingest';
import { toSql } from '../expression';
import type { DataSource, FieldDef, QueryRequest, QueryResult, TableSchema } from '../types';

function requireKnownField(name: string, fields: FieldDef[]): FieldDef {
  const def = fields.find((f) => f.name === name);
  if (!def) {
    throw new Error(`Unknown field: ${name}`);
  }
  return def;
}

/**
 * DataSource implementation backed by a table already registered in the
 * shared duckdb-wasm instance (see ingest.ts for how tables get there).
 */
export class DuckDbDataSource implements DataSource {
  readonly id: string;
  readonly label: string;
  readonly sqlName: string;
  private readonly tableName: string;
  private schemaCache: TableSchema | null = null;

  constructor(tableName: string, opts?: { id?: string; label?: string }) {
    this.tableName = sanitizeTableName(tableName);
    this.id = opts?.id ?? this.tableName;
    this.label = opts?.label ?? this.tableName;
    this.sqlName = this.tableName;
  }

  async getSchema(): Promise<TableSchema> {
    if (this.schemaCache) return this.schemaCache;
    const schema = await describeTable(this.tableName);
    this.schemaCache = schema;
    return schema;
  }

  /** Drop the cached schema, e.g. after the underlying table changes shape. */
  invalidateSchema(): void {
    this.schemaCache = null;
  }

  async getCategories(field: string): Promise<Array<{ label: string; value: string | number }>> {
    const schema = await this.getSchema();
    const def = requireKnownField(field, schema.fields);
    const db = await getDuckDb();
    const conn = await db.connect();
    try {
      const result = await conn.query(
        `SELECT DISTINCT ${quoteIdent(def.name)} AS v FROM ${quoteIdent(this.tableName)} WHERE ${quoteIdent(def.name)} IS NOT NULL ORDER BY ${quoteIdent(def.name)} LIMIT 1000`,
      );
      return result.toArray().map((r) => {
        const row = r.toJSON() as { v: string | number };
        return { label: String(row.v), value: row.v };
      });
    } finally {
      await conn.close();
    }
  }

  async query(req: QueryRequest): Promise<QueryResult> {
    const schema = await this.getSchema();
    const fields = schema.fields;

    const filterSql = req.filter ? toSql(req.filter, fields) : { sql: '1=1', params: [] as unknown[] };

    const selectCols = req.select && req.select.length > 0 ? req.select.map((s) => quoteIdent(requireKnownField(s, fields).name)).join(', ') : '*';

    const orderClause =
      req.sort && req.sort.length > 0
        ? ` ORDER BY ${req.sort
            .map((s) => `${quoteIdent(requireKnownField(s.field, fields).name)} ${s.direction === 'desc' ? 'DESC' : 'ASC'}`)
            .join(', ')}`
        : '';

    const db = await getDuckDb();
    const conn = await db.connect();
    try {
      const rowSql = `SELECT ${selectCols} FROM ${quoteIdent(this.tableName)} WHERE ${filterSql.sql}${orderClause} LIMIT ? OFFSET ?`;
      const rowStmt = await conn.prepare(rowSql);
      let rows: Record<string, unknown>[];
      try {
        const arrowTable = await rowStmt.query(...filterSql.params, req.limit, req.offset);
        rows = arrowTable.toArray().map((r) => r.toJSON() as Record<string, unknown>);
      } finally {
        await rowStmt.close();
      }

      const countSql = `SELECT COUNT(*) AS cnt FROM ${quoteIdent(this.tableName)} WHERE ${filterSql.sql}`;
      const countStmt = await conn.prepare(countSql);
      let totalRows = 0;
      try {
        const countTable = await countStmt.query(...filterSql.params);
        const countRow = countTable.toArray()[0]?.toJSON() as { cnt: unknown } | undefined;
        totalRows = countRow ? Number(countRow.cnt) : 0;
      } finally {
        await countStmt.close();
      }

      return { rows, totalRows };
    } finally {
      await conn.close();
    }
  }
}
