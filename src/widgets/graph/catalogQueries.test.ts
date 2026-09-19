import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG_QUERIES, buildCatalogGraph, type CatalogRows } from './DuckDbCatalogSource';

// Runs the catalog queries on the real duckdb-wasm engine (its node build), because the
// first version of the schema query was wrong in a way only the real engine shows:
// duckdb flags the user's own `main` schema as internal.
const require = createRequire(import.meta.url);
// the package's `exports` map hides package.json, so locate dist/ from the project root (vitest's cwd)
const dist = path.resolve(process.cwd(), 'node_modules/@duckdb/duckdb-wasm/dist');

async function loadCatalog(setup: string[]): Promise<CatalogRows> {
  const duckdb = require(path.join(dist, 'duckdb-node-blocking.cjs'));
  const db = await duckdb.createDuckDB(
    {
      mvp: { mainModule: path.join(dist, 'duckdb-mvp.wasm'), mainWorker: path.join(dist, 'duckdb-node-mvp.worker.cjs') },
      eh: { mainModule: path.join(dist, 'duckdb-eh.wasm'), mainWorker: path.join(dist, 'duckdb-node-eh.worker.cjs') },
    },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  );
  await db.instantiate(() => {});
  const conn = db.connect();
  for (const sql of setup) conn.query(sql);
  const q = (sql: string) => conn.query(sql).toArray().map((r: any) => r.toJSON());
  const rows = {
    databases: q(CATALOG_QUERIES.databases),
    schemas: q(CATALOG_QUERIES.schemas),
    tables: q(CATALOG_QUERIES.tables),
    columns: q(CATALOG_QUERIES.columns),
  } as CatalogRows;
  conn.close();
  return rows;
}

describe('catalog queries on real duckdb', () => {
  it('yields database -> schema -> table -> column for user tables, and nothing internal', async () => {
    const rows = await loadCatalog([
      'CREATE TABLE orders(order_id INTEGER, amount DOUBLE, note VARCHAR)',
      'CREATE SCHEMA extra',
      'CREATE TABLE extra.t(x INTEGER NOT NULL)',
      'CREATE VIEW v AS SELECT * FROM orders',
    ]);
    const graph = buildCatalogGraph(rows);
    const byKind = (k: string) => graph.nodes.filter((n) => n.kind === k).map((n) => n.label).sort();
    expect(byKind('database')).toEqual(['memory']);
    expect(byKind('schema')).toEqual(['extra', 'main']);
    expect(byKind('table')).toEqual(['orders', 't']);
    expect(byKind('column')).toEqual(['amount', 'note', 'order_id', 'x']);
    // every node except the database is reachable through a contains link
    expect(graph.links).toHaveLength(graph.nodes.length - 1);
    const x = graph.nodes.find((n) => n.label === 'x')!;
    expect(x.meta).toMatchObject({ type: 'INTEGER', nullable: false });
  }, 60000);

  it('an empty database still shows database and its default schema', async () => {
    const graph = buildCatalogGraph(await loadCatalog([]));
    expect(graph.nodes.map((n) => n.kind)).toEqual(['database', 'schema']);
  }, 60000);
});
