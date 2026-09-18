import * as duckdb from '@duckdb/duckdb-wasm';
// eslint-disable-next-line import/no-unresolved
import duckdb_mvp_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
// eslint-disable-next-line import/no-unresolved
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
// eslint-disable-next-line import/no-unresolved
import duckdb_eh_wasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
// eslint-disable-next-line import/no-unresolved
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: duckdb_mvp_wasm, mainWorker: mvp_worker },
  eh: { mainModule: duckdb_eh_wasm, mainWorker: eh_worker },
};

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

/**
 * Lazily instantiated, shared duckdb-wasm instance. Never call this at
 * module load time — it must only be reached when something actually needs
 * the database (a data source query, ingestion, or the SQL editor), so
 * duckdb stays out of the app's initial bundle chunk.
 */
export function getDuckDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const bundle = await duckdb.selectBundle(BUNDLES);
      const worker = new Worker(bundle.mainWorker!, { type: 'module' });
      const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      return db;
    })();
  }
  return dbPromise;
}

/** Convenience: get a fresh connection off the shared instance. */
export async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  const db = await getDuckDb();
  return db.connect();
}
