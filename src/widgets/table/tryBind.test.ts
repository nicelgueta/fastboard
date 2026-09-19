import { describe, expect, it } from 'vitest';
import type { Engine } from '../../data/engines';
import type { DataSource, TableSchema } from '../../data/types';
import { tryBind } from './tryBind';

const schema: TableSchema = { name: 't', fields: [], rowCount: 0 };
const source = (getSchema: () => Promise<TableSchema>): DataSource => ({
    id: 't', label: 't', getSchema, query: async () => { throw new Error('unused'); },
});
const engine = (create: (name: string) => DataSource): Engine => ({
    kind: 'qpl', uploadExtensions: [], createSource: create, ingestFile: async () => schema,
});

describe('tryBind', () => {
    it('binds to a table that exists', async () => {
        const r = await tryBind('qpl', 't', () => engine(() => source(async () => schema)));
        expect(r).toMatchObject({ ok: true, schema });
    });

    it('a table that is not there (a reloaded board) is a reason, not a throw', async () => {
        const r = await tryBind('qpl', 'gone', () => engine(() => source(async () => { throw new Error("'unknown table 'gone'"); })));
        expect(r).toEqual({ ok: false, why: "'unknown table 'gone'" });
    });

    it('an invalid table name thrown when creating the source is a reason too', async () => {
        const r = await tryBind('duckdb', '1bad', () => engine(() => { throw new Error('Invalid table name "1bad"'); }));
        expect(r).toEqual({ ok: false, why: 'Invalid table name "1bad"' });
    });

    it('a kind with no client is a reason', async () => {
        const r = await tryBind('snowflake', 't', () => undefined);
        expect(r).toEqual({ ok: false, why: 'no client for data source kind "snowflake"' });
    });
});
