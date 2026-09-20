import { describe, expect, it } from 'vitest';
import { runStatements, splitStatements, type SyncRepl } from './runner';

// crude stand-in for the interpreter's own rule: unbalanced brackets = unfinished
const wantsMore = (s: string) => (s.match(/[([{]/g)?.length ?? 0) > (s.match(/[)\]}]/g)?.length ?? 0);

describe('splitStatements', () => {
    it('splits on lines, skipping blanks and whole-line comments', () => {
        expect(splitStatements('a\n\n/ note\nb\n', wantsMore)).toEqual(['a', 'b']);
    });

    it('keeps an unfinished statement together until it closes', () => {
        expect(splitStatements('select a,\n  b from t\nx: (1;\n 2)\ny', (s) => /,$|\($|;$/.test(s.trimEnd()) || wantsMore(s)))
            .toEqual(['select a,\n  b from t', 'x: (1;\n 2)', 'y']);
    });

    it('a blank line force-submits an unfinished statement', () => {
        expect(splitStatements('f: {[x\n\nnext', wantsMore)).toEqual(['f: {[x', 'next']);
    });

    it('handles CRLF and an empty document', () => {
        expect(splitStatements('a\r\nb', wantsMore)).toEqual(['a', 'b']);
        expect(splitStatements('  \n\n', wantsMore)).toEqual([]);
    });
});

const table = (n: number) => ({ output: '', error: null, ipc: new Uint8Array([n]) });
const text = (s: string) => ({ output: s + '\n', error: null, ipc: null });
const nothing = { output: '', error: null, ipc: null };

const fake = (script: (line: string) => ReturnType<SyncRepl['evalArrow']>): SyncRepl => ({
    evalArrow: script,
    registerTable: () => {},
    rowCount: () => 0,
    wantsMore,
    symbols: () => ({ tables: [], variables: [], functions: [] }),
});

describe('runStatements', () => {
    it('returns the last table produced', () => {
        const r = fake((l) => (l === 'a' ? table(1) : table(2)));
        expect(runStatements(r, 'a\nb').ipc).toEqual(new Uint8Array([2]));
    });

    it('keeps an earlier table across a later assignment', () => {
        const r = fake((l) => (l === 'q' ? table(7) : nothing));
        expect(runStatements(r, 'q\nx: 1').ipc).toEqual(new Uint8Array([7]));
    });

    it('a trailing text result means there is no table to show', () => {
        const r = fake((l) => (l === 'q' ? table(7) : text('i64: 3')));
        const out = runStatements(r, 'q\ncount q');
        expect(out.ipc).toBeNull();
        expect(out.output).toBe('i64: 3\n');
    });

    it('stops at the first error and reports it', () => {
        const calls: string[] = [];
        const r = fake((l) => {
            calls.push(l);
            return l === 'bad' ? { output: '', error: 'boom', ipc: null } : table(1);
        });
        const out = runStatements(r, 'a\nbad\nc');
        expect(out.error).toBe('boom');
        expect(out.ipc).toBeNull();
        expect(calls).toEqual(['a', 'bad']);
    });

    it('an empty document is a no-op', () => {
        expect(runStatements(fake(() => table(1)), '  \n')).toEqual(nothing);
    });
});
