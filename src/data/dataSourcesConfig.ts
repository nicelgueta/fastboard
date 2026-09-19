import { useAppSettings } from '../store/appSettings';

/**
 * Catalogue of data sources the table widget can offer to bind against.
 *
 * duckdb (see DuckDbDataSource) and qpl (QplDataSource) are the kinds with a
 * working DataSource implementation today - the others are here so a host app
 * can describe a Snowflake / ClickHouse / REST warehouse in
 * `/app/table/dataSources` ahead of this app having a client for it. The table
 * widget shows those sources and their configured tables, but binding one
 * surfaces a "not supported yet" message rather than pretending to query it -
 * see src/data/engines.ts. Add a kind here, plus a DataSource implementation,
 * plus an entry in engines.ts, to actually wire one up.
 */
export type DataSourceKind = 'duckdb' | 'qpl' | 'snowflake' | 'clickhouse' | 'rest' | (string & {});

export interface DataSourceTableConfig {
    name: string;
    label?: string;
}

export interface DataSourceConfig {
    id: string;
    kind: DataSourceKind;
    label: string;
    /**
     * Known/queryable tables for this source. Often empty for duckdb, whose
     * tables are mostly created at runtime (CSV/JSON/Parquet upload, or ad-hoc
     * SQL) rather than known up front - the table widget falls back to a
     * free-text table name in that case.
     */
    tables: DataSourceTableConfig[];
}

export interface DataSourcesConfig {
    dataSources: DataSourceConfig[];
}

/** Used whenever `/app/table/dataSources` isn't implemented or fails to load. */
export const DEFAULT_DATA_SOURCES_CONFIG: DataSourcesConfig = {
    dataSources: [
        {
            id: 'duckdb',
            kind: 'duckdb',
            label: 'DuckDB (in-browser)',
            tables: [],
        },
        {
            id: 'qpl',
            kind: 'qpl',
            label: 'qpl (in-browser)',
            tables: [],
        },
    ],
};

function isDataSourcesConfig(body: unknown): body is DataSourcesConfig {
    return (
        !!body &&
        typeof body === 'object' &&
        Array.isArray((body as DataSourcesConfig).dataSources) &&
        (body as DataSourcesConfig).dataSources.every(
            (d) => d && typeof d.id === 'string' && typeof d.kind === 'string' && typeof d.label === 'string',
        )
    );
}

async function fetchDataSourcesConfig(): Promise<DataSourcesConfig> {
    const { remoteBaseUrl } = useAppSettings.getState();
    const base = remoteBaseUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/table/dataSources`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const body = await res.json();
    if (!isDataSourcesConfig(body)) throw new Error('Malformed data sources config');
    return body;
}

let cached: Promise<DataSourcesConfig> | null = null;

/**
 * Always resolves - falls back to DEFAULT_DATA_SOURCES_CONFIG (the in-browser
 * engines) when the endpoint isn't implemented, is unreachable, or returns something
 * that doesn't match the expected shape. Same degrade-gracefully approach as
 * src/store/storage.ts's remote adapter.
 */
export function getDataSourcesConfig(force = false): Promise<DataSourcesConfig> {
    if (!cached || force) {
        cached = fetchDataSourcesConfig().catch((e) => {
            console.warn('Data sources config unavailable, falling back to default:', e);
            return DEFAULT_DATA_SOURCES_CONFIG;
        });
    }
    return cached;
}
