import { describe, expect, it } from 'vitest';
import { QplSession } from './session';
import { QplCrashed, type QplEngine } from './WorkerEngine';
import type { QplResult } from './runner';

const ok = (n = 1): QplResult => ({ output: '', error: null, ipc: new Uint8Array([n]) });

class FakeEngine implements QplEngine {
    static all: FakeEngine[] = [];
    registered: string[] = [];
    disposed = false;
    constructor(readonly behaviour: { crashOn?: string; failRegister?: string } = {}) {
        FakeEngine.all.push(this);
    }
    async registerTable(name: string) {
        if (this.behaviour.failRegister === name) throw new Error('bad table');
        this.registered.push(name);
    }
    async rowCount() {
        return 3;
    }
    async evalStatement(line: string) {
        if (line === this.behaviour.crashOn) throw new QplCrashed('unreachable');
        return ok();
    }
    async run(src: string) {
        return this.evalStatement(src);
    }
    async langConfig() {
        return { id: 'qpl' };
    }
    async symbols() {
        return { tables: [], variables: [], functions: [] };
    }
    dispose() {
        this.disposed = true;
    }
}

const newSession = (first: FakeEngine['behaviour'], later: FakeEngine['behaviour'] = {}) => {
    FakeEngine.all = [];
    let n = 0;
    return new QplSession(() => new FakeEngine(n++ === 0 ? first : later));
};

describe('QplSession', () => {
    it('passes calls through to the engine', async () => {
        const s = newSession({});
        await s.registerTable('t', new Uint8Array([1]));
        expect(FakeEngine.all[0].registered).toEqual(['t']);
        expect(await s.rowCount('t')).toBe(3);
        expect((await s.run('q')).ipc).toEqual(new Uint8Array([1]));
        expect(await s.langConfig()).toEqual({ id: 'qpl' });
    });

    it('replaces a crashed engine, re-registers tables, and reports the crash', async () => {
        const s = newSession({ crashOn: 'boom' });
        await s.registerTable('trades', new Uint8Array([1]));
        await s.registerTable('quotes', new Uint8Array([2]));

        const r = await s.run('boom');
        expect(r.error).toMatch(/crashed and was restarted/);
        expect(r.error).toMatch(/unreachable/);
        expect(r.ipc).toBeNull();
        expect(FakeEngine.all).toHaveLength(2);
        expect(FakeEngine.all[0].disposed).toBe(true);
        expect(FakeEngine.all[1].registered).toEqual(['trades', 'quotes']);

        // and the replacement is usable
        expect((await s.run('boom')).error).toBeNull();
    });

    it('concurrent callers that all hit one crash restart only once', async () => {
        const s = newSession({ crashOn: 'boom' });
        const results = await Promise.all([s.evalStatement('boom'), s.evalStatement('boom'), s.evalStatement('boom')]);
        expect(results.every((r) => /restarted/.test(r.error ?? ''))).toBe(true);
        expect(FakeEngine.all).toHaveLength(2);
    });

    it('retries a non-query call once on the replacement engine', async () => {
        FakeEngine.all = [];
        let n = 0;
        const s = new QplSession(() => {
            const e = new FakeEngine();
            if (n++ === 0) e.rowCount = async () => { throw new QplCrashed('gone'); };
            return e;
        });
        expect(await s.rowCount('t')).toBe(3);
        expect(FakeEngine.all).toHaveLength(2);
    });

    it('an ordinary error is not a crash: no restart, and it propagates', async () => {
        const s = newSession({ failRegister: 'bad' });
        await expect(s.registerTable('bad', new Uint8Array([1]))).rejects.toThrow('bad table');
        expect(FakeEngine.all).toHaveLength(1);
    });

    it('a table that fails to re-register is dropped without failing the restart', async () => {
        const s = newSession({ crashOn: 'boom' }, { failRegister: 'a' });
        await s.registerTable('a', new Uint8Array([1]));
        await s.registerTable('b', new Uint8Array([2]));
        await s.run('boom');
        expect(FakeEngine.all[1].registered).toEqual(['b']);
    });
});
