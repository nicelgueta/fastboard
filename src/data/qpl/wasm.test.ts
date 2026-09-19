import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeAll, vi } from 'vitest';
import * as arrow from 'apache-arrow';
import { parquetToIpc } from './parquet';
import { csvToArrow } from './csv';
import { QplSession } from './session';
import { WorkerEngine } from './WorkerEngine';
import { LoopbackWorker, qplWasmPath } from './testUtils';
import { createHandler } from './workerCore';
import type { SyncRepl } from './runner';
import { QplDataSource } from './QplDataSource';
import { tryBind } from '../../widgets/table/tryBind';
import { resultToRows } from '../decode';

// QplDataSource reaches the interpreter through runtime.ts, which loads the wasm
// with a browser-only `?url` import. Hand it the node-loaded session instead.
const shared = vi.hoisted(() => ({ session: null as unknown as import('./session').QplSession }));
vi.mock('./runtime', () => ({ getQplSession: async () => shared.session }));

/**
 * End to end against the real qpl wasm build, through the real worker protocol
 * (in-process, see testUtils.ts): file -> Arrow IPC -> qpl -> Arrow IPC.
 */
const wasmPath = qplWasmPath;
const built = !!wasmPath;

const fixture = (name: string): ArrayBuffer => {
    const buf = readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

describe.skipIf(!built)('qpl wasm', () => {
    let session: QplSession;

    beforeAll(async () => {
        const qpl = await import('qpl');
        qpl.initSync({ module: readFileSync(wasmPath!) });
        session = new QplSession(
            () => new WorkerEngine(new LoopbackWorker(createHandler(async () => ({
                repl: new qpl.Repl() as unknown as SyncRepl,
                langConfig: qpl.qplLangConfig,
            })))),
        );
        shared.session = session;
        await session.registerTable('mixed', await parquetToIpc(fixture('mixed.snappy.parquet')));
    });

    const table = async (src: string) => {
        const r = await session.run(src);
        expect(r.error).toBeNull();
        expect(r.ipc).not.toBeNull();
        return arrow.tableFromIPC(r.ipc!);
    };

    it('returns a registered table untruncated, with its types', async () => {
        const t = await table('select from mixed');
        expect(t.numRows).toBe(4);
        expect(t.schema.fields.map((f) => f.name)).toEqual([
            'sym', 'price', 'qty32', 'size', 'big', 'u8', 'ok', 'day', 'ts_us', 'ts_ms', 'dec', 'tags',
        ]);
        expect([...t.getChild('big')!][0]).toBe(2n ** 62n);
        expect([...t.getChild('sym')!]).toEqual(['AAPL', 'MSFT', null, 'GOOG']);
    });

    it('filters and sorts', async () => {
        const t = await table('select sym, price from mixed where price > 150 order price desc');
        expect([...t.getChild('sym')!]).toEqual(['MSFT', 'AAPL']);
    });

    it('limit takes the first n rows', async () => {
        expect((await table('2 limit select from mixed')).numRows).toBe(2);
    });

    it('runs several statements and returns the last table', async () => {
        const t = await table('big: select from mixed where qty32 > 2\nselect sym from big');
        expect(t.numRows).toBe(2);
    });

    it('reports a scalar as text and a bad query as an error', async () => {
        const scalar = await session.run('count select from mixed');
        expect(scalar.ipc).toBeNull();
        expect(scalar.output).toMatch(/4/);
        expect((await session.run('select from nope')).error).toMatch(/nope/);
    });

    it('keeps what a run printed, alongside a table and ahead of an error', async () => {
        const both = await session.run('log "hello"\nselect from mixed');
        expect(both.error).toBeNull();
        expect(both.output).toBe('hello\n');
        expect(arrow.tableFromIPC(both.ipc!).numRows).toBe(4);

        const failed = await session.run('log "before"\nselect from nope');
        expect(failed.output).toBe('before\n');
        expect(failed.error).toMatch(/nope/);
    });

    it('rejects an invalid table name without treating it as a crash', async () => {
        await expect(session.registerTable('2bad', new Uint8Array([1]))).rejects.toThrow(/invalid table name/);
        expect((await session.run('select from mixed')).error).toBeNull();
    });

    it('queries a table loaded from CSV, with inferred types', async () => {
        const csv = [
            'sym,price,qty,ok,day,ts,zip',
            'AAPL,182.3,100,true,2024-03-15,2024-03-15 09:30:00.123456,02134',
            'MSFT,415,250,false,2024-03-16,2024-03-15T09:31:00Z,90210',
            'GOOG,,80,true,2024-03-17,2024-03-15T09:32:00Z,10001',
        ].join('\n');
        await session.registerTable('csvt', arrow.tableToIPC(csvToArrow(csv), 'stream'));

        const all = await table('select from csvt');
        expect(all.numRows).toBe(3);
        expect(all.schema.fields.map((f) => f.name)).toEqual(['sym', 'price', 'qty', 'ok', 'day', 'ts', 'zip']);
        expect([...all.getChild('zip')!]).toEqual(['02134', '90210', '10001']);
        expect([...all.getChild('price')!]).toEqual([182.3, 415, null]);

        // the temporal columns are usable as temporal, not just carried along
        expect((await table('select from csvt where day > 2024.03.15')).numRows).toBe(2);
        expect((await table('select from csvt where ts > 2024.03.15D09:30:30')).numRows).toBe(2);
        const t = await table('select sym from csvt where qty > 90');
        expect([...t.getChild('sym')!]).toEqual(['AAPL', 'MSFT']);
        expect((await table('select from csvt where ok')).numRows).toBe(2);
        expect(await session.rowCount('csvt')).toBe(3);
    });

    it('the built-in demo tables load', async () => {
        const qpl = await import('qpl');
        const repl = new qpl.Repl();
        repl.loadDemo();
        expect(repl.eval('count select from trades').output).toMatch(/8/);
    });

    describe('QplDataSource', () => {
        const ds = () => new QplDataSource('mixed');

        it('reports the schema and row count', async () => {
            const schema = await ds().getSchema();
            expect(schema.rowCount).toBe(4);
            expect(Object.fromEntries(schema.fields.map((f) => [f.name, f.type]))).toMatchObject({
                sym: 'string', price: 'number', size: 'integer', ok: 'boolean', day: 'date', ts_us: 'timestamp',
            });
        });

        it('pages with offset and limit', async () => {
            const page = await ds().query({ offset: 1, limit: 2 });
            expect(page.totalRows).toBe(4);
            const rows = await resultToRows(page);
            expect(rows.map((r) => r.qty32)).toEqual([2, 3]);
        });

        it('sorts before paging', async () => {
            const page = await ds().query({ offset: 0, limit: 2, sort: [{ field: 'qty32', direction: 'desc' }] });
            expect((await resultToRows(page)).map((r) => r.qty32)).toEqual([4, 3]);
        });

        it('paging past the end returns what is left', async () => {
            const page = await ds().query({ offset: 3, limit: 25 });
            expect((await resultToRows(page)).map((r) => r.qty32)).toEqual([4]);
        });

        it('refuses a filter and an unusable sort column', async () => {
            const filter = { kind: 'group' as const, id: 'g', combinator: 'and' as const, children: [] };
            await expect(ds().query({ offset: 0, limit: 5, filter })).rejects.toThrow(/filter/);
            await expect(ds().query({ offset: 0, limit: 5, sort: [{ field: 'a b', direction: 'asc' }] })).rejects.toThrow(/identifier/);
        });

        it('binding a table that is not loaded (a reloaded board) fails with a reason, so the widget can reset', async () => {
            const r = await tryBind('qpl', 'not_loaded');
            expect(r).toMatchObject({ ok: false });
            expect(!r.ok && r.why).toMatch(/not_loaded/);
            expect(await tryBind('qpl', 'mixed')).toMatchObject({ ok: true });
        });

        it('an unknown table is an error', async () => {
            await expect(new QplDataSource('nope').getSchema()).rejects.toThrow(/nope/);
        });
    });
});
