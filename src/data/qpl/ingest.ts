import * as arrow from 'apache-arrow';
import { arrowSchemaToTableSchema } from '../decode';
import { sanitizeTableName } from '../tableName';
import type { TableSchema } from '../types';
import { csvToArrow } from './csv';
import { parquetToArrow } from './parquet';
import { getQplSession } from './runtime';

/**
 * Loading files into the qpl engine. Its wasm build has no file readers and no
 * filesystem, so a file is decoded to Arrow in JS (parquet.ts / csv.ts) and
 * handed over as Arrow IPC - the one format qpl's registerTable takes.
 */
async function register(tableName: string, table: arrow.Table): Promise<TableSchema> {
    const name = sanitizeTableName(tableName);
    const session = await getQplSession();
    await session.registerTable(name, arrow.tableToIPC(table, 'stream'));
    return arrowSchemaToTableSchema(table, name);
}

export async function registerParquet(file: File, tableName: string): Promise<TableSchema> {
    sanitizeTableName(tableName);
    return register(tableName, await parquetToArrow(await file.arrayBuffer()));
}

export async function registerCsv(file: File, tableName: string): Promise<TableSchema> {
    sanitizeTableName(tableName);
    return register(tableName, csvToArrow(await file.text()));
}
