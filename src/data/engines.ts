import type { DataSourceKind } from './dataSourcesConfig';
import type { DataSource, TableSchema } from './types';
import { DuckDbDataSource } from './duckdb/DuckDbDataSource';
import * as duckdbIngest from './duckdb/ingest';
import { QplDataSource } from './qpl/QplDataSource';
import * as qplIngest from './qpl/ingest';

/**
 * The in-browser query engines a table can be backed by. A table widget
 * persists which one it is bound to (see TableWidget), and everything that
 * differs between them lives here so the widget itself stays engine-agnostic.
 */
export interface Engine {
    kind: DataSourceKind;
    /** File extensions this engine can ingest, lower-case, without the dot. */
    uploadExtensions: string[];
    /** Bind to a table that already exists in the engine. Throws on an invalid name. */
    createSource(tableName: string): DataSource;
    /** Load an uploaded file as a table and return its schema. */
    ingestFile(file: File, ext: string, tableName: string): Promise<TableSchema>;
}

const duckdb: Engine = {
    kind: 'duckdb',
    uploadExtensions: ['csv', 'json', 'parquet'],
    createSource: (name) => new DuckDbDataSource(name),
    ingestFile: (file, ext, name) => {
        if (ext === 'csv') return duckdbIngest.registerCsv(file, name);
        if (ext === 'json') return duckdbIngest.registerJson(file, name);
        return duckdbIngest.registerParquet(file, name);
    },
};

const qpl: Engine = {
    kind: 'qpl',
    // qpl's wasm build has no file readers: parquet (hyparquet) and CSV
    // (papaparse) are decoded in JS. JSON isn't supported here yet.
    uploadExtensions: ['csv', 'parquet'],
    createSource: (name) => new QplDataSource(name),
    ingestFile: (file, ext, name) =>
        ext === 'csv' ? qplIngest.registerCsv(file, name) : qplIngest.registerParquet(file, name),
};

const ENGINES: Record<string, Engine> = { duckdb, qpl };

/** The engine for a data source kind, or undefined for kinds with no client yet (snowflake, rest, ...). */
export function getEngine(kind: DataSourceKind | undefined): Engine | undefined {
    return kind ? ENGINES[kind] : undefined;
}

export const DEFAULT_ENGINE_KIND: DataSourceKind = 'duckdb';
