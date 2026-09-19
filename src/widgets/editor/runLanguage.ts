import type { DataSourceKind } from '../../data/dataSourcesConfig';

/**
 * The editor language that runs on a table engine: SQL for DuckDB, qpl for qpl.
 * Undefined for an engine with no editor language.
 *
 * A linked table lives in one engine and only that engine's language works on
 * it - running `select from t` as SQL against a qpl table just fails with a
 * DuckDB parser error - so linking a table switches the editor to this.
 */
export function languageForEngine(engine: DataSourceKind | undefined): 'sql' | 'qpl' | undefined {
    if (engine === 'qpl') return 'qpl';
    if (engine === 'duckdb') return 'sql';
    return undefined;
}

/** Whether the editor can run its text (and so shows the target table picker). */
export function isRunnableLanguage(language: string): boolean {
    return language === 'sql' || language === 'qpl';
}
