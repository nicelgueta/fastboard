import { describe, expect, it } from 'vitest';
import { createHandler, type LoadedQpl } from './workerCore';
import { LoopbackWorker } from './testUtils';
import { QplCrashed, WorkerEngine } from './WorkerEngine';
import { QplSession } from './session';
import type { SyncRepl } from './runner';

const fakeRepl = (over: Partial<SyncRepl> = {}): SyncRepl => ({
    evalArrow: (line) => ({ output: '', error: null, ipc: new Uint8Array([line.length]) }),
    registerTable: () => {},
    rowCount: () => 7,
    wantsMore: () => false,
    ...over,
});
const loader = (repl: SyncRepl): (() => Promise<LoadedQpl>) => async () => ({ repl, langConfig: () => ({ id: 'qpl', re: /x/ }) });
const engine = (repl: SyncRepl) => new WorkerEngine(new LoopbackWorker(createHandler(loader(repl))));

describe('WorkerEngine over the worker protocol', () => {
    it('round-trips each method', async () => {
        const e = engine(fakeRepl());
        await e.registerTable('t', new Uint8Array([1, 2, 3]));
        expect(await e.rowCount('t')).toBe(7);
        expect((await e.evalStatement('abc')).ipc).toEqual(new Uint8Array([3]));
        expect((await e.run('ab')).ipc).toEqual(new Uint8Array([2]));
        // a RegExp in the language config must survive structured cloning
        expect(await e.langConfig()).toEqual({ id: 'qpl', re: /x/ });
    });

    it('does not detach the bytes the caller passed in', async () => {
        const e = engine(fakeRepl());
        const bytes = new Uint8Array([1, 2, 3]);
        await e.registerTable('t', bytes);
        expect(bytes.byteLength).toBe(3);
    });

    it('answers concurrent requests in order', async () => {
        const seen: string[] = [];
        const e = engine(fakeRepl({ evalArrow: (l) => (seen.push(l), { output: l, error: null, ipc: null }) }));
        const out = await Promise.all(['a', 'b', 'c'].map((l) => e.evalStatement(l)));
        expect(out.map((r) => r.output)).toEqual(['a', 'b', 'c']);
        expect(seen).toEqual(['a', 'b', 'c']);
    });

    it('an ordinary error rejects with a plain Error and leaves the worker usable', async () => {
        let fail = true;
        const e = engine(fakeRepl({ registerTable: () => { if (fail) throw new Error('invalid table name'); } }));
        const err = await e.registerTable('2bad', new Uint8Array()).catch((x) => x);
        expect(err).toBeInstanceOf(Error);
        expect(err).not.toBeInstanceOf(QplCrashed);
        expect(err.message).toBe('invalid table name');
        fail = false;
        await expect(e.registerTable('ok', new Uint8Array())).resolves.toBeUndefined();
    });

    it('a wasm trap is a crash, and refuses everything after it', async () => {
        const e = engine(fakeRepl({ evalArrow: () => { throw new WebAssembly.RuntimeError('unreachable'); } }));
        await expect(e.evalStatement('x')).rejects.toBeInstanceOf(QplCrashed);
        // the poisoned instance is never used again, even for calls that would have worked
        await expect(e.rowCount('t')).rejects.toBeInstanceOf(QplCrashed);
    });

    it('a failed wasm load is reported as an error', async () => {
        const e = new WorkerEngine(new LoopbackWorker(createHandler(async () => { throw new Error('404 qpl_bg.wasm'); })));
        await expect(e.rowCount('t')).rejects.toThrow('404 qpl_bg.wasm');
    });

    it('retries the wasm load on the next request after a failure', async () => {
        let attempts = 0;
        const e = new WorkerEngine(new LoopbackWorker(createHandler(async () => {
            if (attempts++ === 0) throw new Error('network down');
            return { repl: fakeRepl(), langConfig: () => ({}) };
        })));
        await expect(e.rowCount('t')).rejects.toThrow('network down');
        expect(await e.rowCount('t')).toBe(7);
    });

    it('worker-level failure rejects in-flight and later calls as a crash', async () => {
        const w = new LoopbackWorker(() => new Promise(() => {})); // never answers
        const e = new WorkerEngine(w);
        const inflight = e.rowCount('t');
        w.onerror?.({ message: 'out of memory' } as ErrorEvent);
        await expect(inflight).rejects.toBeInstanceOf(QplCrashed);
        await expect(e.rowCount('t')).rejects.toBeInstanceOf(QplCrashed);
    });

    it('dispose terminates the worker and fails pending calls', async () => {
        const w = new LoopbackWorker(() => new Promise(() => {}));
        const e = new WorkerEngine(w);
        const inflight = e.rowCount('t');
        e.dispose();
        expect(w.terminated).toBe(true);
        await expect(inflight).rejects.toBeInstanceOf(QplCrashed);
    });
});

describe('QplSession over real worker plumbing', () => {
    it('recovers from a trap with a new worker and the tables it was given', async () => {
        const registered: string[][] = [];
        let boom = true;
        const session = new QplSession(() => {
            const names: string[] = [];
            registered.push(names);
            return engine(fakeRepl({
                registerTable: (n) => { names.push(n); },
                evalArrow: (l) => {
                    if (boom && l === 'boom') throw new WebAssembly.RuntimeError('unreachable');
                    return { output: 'fine', error: null, ipc: null };
                },
            }));
        });
        await session.registerTable('trades', new Uint8Array([1]));

        const r = await session.run('boom');
        expect(r.error).toMatch(/restarted/);
        expect(registered).toEqual([['trades'], ['trades']]);

        boom = false;
        expect((await session.evalStatement('boom')).output).toBe('fine');
    });
});
