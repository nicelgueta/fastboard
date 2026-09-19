/**
 * Running editor text against a synchronous qpl `Repl`. Pure (no wasm import),
 * so it is tested with a fake; the worker (qpl.worker.ts) is what calls it with
 * the real interpreter.
 */

/** The slice of the wasm `Repl` (qpl.d.ts) that runs queries. */
export interface SyncRepl {
    evalArrow(line: string): { output: string; error: string | null; ipc: Uint8Array | null };
    registerTable(name: string, ipc: Uint8Array): void;
    rowCount(name: string): number;
    wantsMore(src: string): boolean;
}

export interface QplResult {
    /** Text output (scalars, lists, plans). Empty when the statement produced a table. */
    output: string;
    error: string | null;
    /** The whole result table as an Arrow IPC stream, if the statement produced one. */
    ipc: Uint8Array | null;
}

/**
 * Split editor text into statements the way the terminal REPL does: a line
 * that leaves a statement unfinished (open bracket, trailing comma, ...) keeps
 * accumulating; a blank line force-submits it. Whole-line `/` comments and
 * blank lines between statements are skipped.
 */
export function splitStatements(src: string, wantsMore: (s: string) => boolean): string[] {
    const out: string[] = [];
    let buf: string[] = [];
    const flush = () => {
        if (buf.length) out.push(buf.join('\n'));
        buf = [];
    };
    for (const line of src.split(/\r?\n/)) {
        const blank = line.trim() === '';
        if (buf.length === 0 && (blank || line.trimStart().startsWith('/'))) continue;
        if (blank) {
            flush();
            continue;
        }
        buf.push(line);
        if (!wantsMore(buf.join('\n'))) flush();
    }
    flush();
    return out;
}

/**
 * Run editor text: one or more statements, in order. Stops at the first
 * error. The result is that of the last statement that produced a table (or
 * the last text output if none did), with output from earlier statements
 * kept, like the REPL would print it.
 */
export function runStatements(repl: SyncRepl, src: string): QplResult {
    const statements = splitStatements(src, (s) => {
        try {
            return repl.wantsMore(s);
        } catch {
            return false;
        }
    });
    let output = '';
    let ipc: Uint8Array | null = null;
    for (const stmt of statements) {
        const r = repl.evalArrow(stmt);
        output += r.output;
        if (r.error) return { output, error: r.error, ipc: null };
        // a later statement's table replaces an earlier one; a later text
        // result means the last thing the user asked for wasn't a table
        ipc = r.ipc ?? (r.output ? null : ipc);
    }
    return { output, error: null, ipc };
}
