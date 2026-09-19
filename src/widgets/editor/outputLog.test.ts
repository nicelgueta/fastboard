import { describe, expect, it } from 'vitest';
import { MAX_ENTRIES, MAX_TEXT, appendEntry, clip, formatTime, makeEntry } from './outputLog';

describe('makeEntry', () => {
    it('summarises a table result', () => {
        const e = makeEntry(1, 0, 'sql', { ok: true, rows: 3, elapsedMs: 12.4 });
        expect(e).toMatchObject({ status: 'ok', summary: '3 rows in 12 ms', text: '' });
        expect(makeEntry(2, 0, 'sql', { ok: true, rows: 1, elapsedMs: 1 }).summary).toBe('1 row in 1 ms');
    });

    it('a run with no table says so and keeps what it printed', () => {
        const e = makeEntry(1, 0, 'qpl', { ok: true, elapsedMs: 3, output: 'i64: 4\n\n' });
        expect(e.summary).toBe('done in 3 ms');
        expect(e.text).toBe('i64: 4');
    });

    it('keeps output that came before an error, above the error', () => {
        const e = makeEntry(1, 0, 'qpl', { ok: false, message: "'unknown table 'nope'", output: 'partial\n' });
        expect(e.status).toBe('error');
        expect(e.text).toBe("partial\n'unknown table 'nope'");
        expect(e.summary).toBe("'unknown table 'nope'");
    });

    it('the summary of a multi-line error is its first line; the text has all of it', () => {
        const e = makeEntry(1, 0, 'sql', { ok: false, message: 'Parser Error: x\nLINE 1: select' });
        expect(e.summary).toBe('Parser Error: x');
        expect(e.text).toBe('Parser Error: x\nLINE 1: select');
    });
});

describe('limits', () => {
    it('clips long text and says how much was dropped', () => {
        const long = 'x'.repeat(MAX_TEXT + 10);
        const out = clip(long);
        expect(out.startsWith('x'.repeat(MAX_TEXT))).toBe(true);
        expect(out).toMatch(/10 more characters/);
        expect(clip('short')).toBe('short');
    });

    it('keeps only the newest entries', () => {
        let log = [] as ReturnType<typeof makeEntry>[];
        for (let i = 0; i < MAX_ENTRIES + 5; i++) log = appendEntry(log, makeEntry(i, 0, 'sql', { ok: true, rows: 0, elapsedMs: 0 }));
        expect(log).toHaveLength(MAX_ENTRIES);
        expect(log[0].id).toBe(5);
        expect(log[log.length - 1].id).toBe(MAX_ENTRIES + 4);
    });
});

describe('formatTime', () => {
    it('is HH:MM:SS', () => {
        expect(formatTime(new Date(2024, 0, 1, 9, 5, 7).getTime())).toBe('09:05:07');
    });
});
