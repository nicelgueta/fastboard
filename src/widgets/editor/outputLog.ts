/**
 * The editor's run log: what each run printed and how it ended. Pure (no React),
 * so the formatting and the size limits are unit-tested.
 */
export interface OutputEntry {
    id: number;
    /** epoch ms */
    at: number;
    language: string;
    status: 'ok' | 'error';
    /** One line: "3 rows in 12 ms", or the error message's first line. */
    summary: string;
    /** What the code printed (qpl stdout), or the full error text. May be empty. */
    text: string;
}

export const MAX_ENTRIES = 200;
export const MAX_TEXT = 50_000;

/** Bound one entry's text so a runaway print can't stall the pane. */
export function clip(text: string): string {
    if (text.length <= MAX_TEXT) return text;
    return `${text.slice(0, MAX_TEXT)}\n… (${text.length - MAX_TEXT} more characters not shown)`;
}

export type RunResult =
    /** `rows` is undefined when the run produced no table (a scalar, an assignment). */
    | { ok: true; rows?: number; elapsedMs: number; output?: string }
    | { ok: false; message: string; output?: string };

export function makeEntry(id: number, at: number, language: string, r: RunResult): OutputEntry {
    if (r.ok) {
        const took = `${r.elapsedMs.toFixed(0)} ms`;
        const summary = r.rows === undefined ? `done in ${took}` : `${r.rows} ${r.rows === 1 ? 'row' : 'rows'} in ${took}`;
        return { id, at, language, status: 'ok', summary, text: clip((r.output ?? '').trimEnd()) };
    }
    // anything printed before the failure is kept, above the error itself
    const printed = (r.output ?? '').trimEnd();
    const text = printed ? `${printed}\n${r.message}` : r.message;
    return { id, at, language, status: 'error', summary: r.message.split('\n')[0], text: clip(text) };
}

/** Append, dropping the oldest entries past the cap. */
export function appendEntry(log: OutputEntry[], entry: OutputEntry): OutputEntry[] {
    const next = [...log, entry];
    return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
}

export function formatTime(at: number): string {
    const d = new Date(at);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
