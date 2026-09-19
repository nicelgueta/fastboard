import { getDuckDb } from '../../data/duckdb/runtime';
import type { CatalogGraph, CatalogLink, CatalogNode, CatalogSource } from './catalog';

// Row shapes of the duckdb catalog functions we read. Only the columns we use.
export interface DbRow { database_name: string }
export interface SchemaRow { database_name: string; schema_name: string }
export interface TableRow {
  database_name: string;
  schema_name: string;
  table_name: string;
  estimated_size?: unknown;
  column_count?: unknown;
}
export interface ColumnRow {
  database_name: string;
  schema_name: string;
  table_name: string;
  column_name: string;
  column_index?: unknown;
  data_type?: string;
  is_nullable?: unknown;
}

export interface CatalogRows {
  databases: DbRow[];
  schemas: SchemaRow[];
  tables: TableRow[];
  columns: ColumnRow[];
}

// Ids are JSON paths, not "a.b.c" joins - a table or column name may contain a dot.
export const dbId = (db: string) => `database:${JSON.stringify([db])}`;
export const schemaId = (db: string, schema: string) => `schema:${JSON.stringify([db, schema])}`;
export const tableId = (db: string, schema: string, table: string) => `table:${JSON.stringify([db, schema, table])}`;
export const columnId = (db: string, schema: string, table: string, col: string) =>
  `column:${JSON.stringify([db, schema, table, col])}`;

/** duckdb returns BIGINT/UBIGINT as bigint, which neither JSON nor the detail panel can show. */
const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * database -> schema -> table -> column, from the rows of duckdb_databases() /
 * duckdb_schemas() / duckdb_tables() / duckdb_columns(). Pure so it can be
 * tested without a database. Anything whose parent is missing is dropped
 * rather than left dangling.
 */
export function buildCatalogGraph(rows: CatalogRows): CatalogGraph {
  const nodes: CatalogNode[] = [];
  const links: CatalogLink[] = [];
  const have = new Set<string>();
  const add = (n: CatalogNode) => {
    if (have.has(n.id)) return false;
    have.add(n.id);
    nodes.push(n);
    return true;
  };
  const contains = (source: string, target: string) => links.push({ source, target, relation: 'contains' });

  for (const d of rows.databases) {
    add({ id: dbId(d.database_name), label: d.database_name, kind: 'database', meta: { name: d.database_name } });
  }
  for (const s of rows.schemas) {
    const parent = dbId(s.database_name);
    if (!have.has(parent)) continue;
    const id = schemaId(s.database_name, s.schema_name);
    if (add({ id, label: s.schema_name, kind: 'schema', meta: { database: s.database_name, name: s.schema_name } })) {
      contains(parent, id);
    }
  }
  for (const t of rows.tables) {
    const parent = schemaId(t.database_name, t.schema_name);
    if (!have.has(parent)) continue;
    const id = tableId(t.database_name, t.schema_name, t.table_name);
    const meta: Record<string, unknown> = { database: t.database_name, schema: t.schema_name, name: t.table_name };
    const cols = num(t.column_count);
    const size = num(t.estimated_size);
    if (cols !== undefined) meta.columns = cols;
    if (size !== undefined) meta.estimatedRows = size;
    if (add({ id, label: t.table_name, kind: 'table', meta })) contains(parent, id);
  }
  for (const c of rows.columns) {
    const parent = tableId(c.database_name, c.schema_name, c.table_name);
    if (!have.has(parent)) continue;
    const id = columnId(c.database_name, c.schema_name, c.table_name, c.column_name);
    const meta: Record<string, unknown> = { table: c.table_name, name: c.column_name };
    if (c.data_type) meta.type = c.data_type;
    if (c.is_nullable !== undefined && c.is_nullable !== null) meta.nullable = Boolean(c.is_nullable);
    const position = num(c.column_index);
    if (position !== undefined) meta.position = position;
    if (add({ id, label: c.column_name, kind: 'column', meta })) contains(parent, id);
  }
  return { nodes, links };
}

/**
 * The catalog queries. Note the schema filter: in duckdb the user's own `main`
 * schema (and every schema in it) is flagged `internal`, so `WHERE NOT internal`
 * would drop every schema - and with them every table and column. Schemas are
 * instead kept by their database not being internal, minus the two catalog
 * schemas duckdb mirrors into each database.
 */
export const CATALOG_QUERIES = {
  databases: 'SELECT database_name FROM duckdb_databases() WHERE NOT internal',
  schemas:
    "SELECT database_name, schema_name FROM duckdb_schemas() " +
    "WHERE database_name IN (SELECT database_name FROM duckdb_databases() WHERE NOT internal) " +
    "AND schema_name NOT IN ('information_schema', 'pg_catalog')",
  tables:
    'SELECT database_name, schema_name, table_name, estimated_size, column_count FROM duckdb_tables() WHERE NOT internal',
  columns:
    'SELECT database_name, schema_name, table_name, column_name, column_index, data_type, is_nullable FROM duckdb_columns() WHERE NOT internal',
} as const;

/**
 * Reference CatalogSource: the shared in-browser duckdb-wasm instance's own
 * catalog. Every table ingested from a Data Table widget shows up here, so it
 * is a working catalog with no backend. Internal objects (the `system` and
 * `temp` databases, information_schema, pg_catalog) are left out.
 */
export class DuckDbCatalogSource implements CatalogSource {
  readonly id = 'duckdb';
  readonly label = 'DuckDB (in-browser)';

  async getGraph(): Promise<CatalogGraph> {
    const db = await getDuckDb();
    const conn = await db.connect();
    try {
      const q = async <T,>(sql: string): Promise<T[]> =>
        (await conn.query(sql)).toArray().map((r) => r.toJSON() as T);
      const [databases, schemas, tables, columns] = await Promise.all([
        q<DbRow>(CATALOG_QUERIES.databases),
        q<SchemaRow>(CATALOG_QUERIES.schemas),
        q<TableRow>(CATALOG_QUERIES.tables),
        q<ColumnRow>(CATALOG_QUERIES.columns),
      ]);
      return buildCatalogGraph({ databases, schemas, tables, columns });
    } finally {
      await conn.close();
    }
  }
}
