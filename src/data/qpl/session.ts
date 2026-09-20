import { QplCrashed, type QplEngine } from './WorkerEngine';
import type { QplResult, QplSymbols } from './runner';

export type { QplResult, QplSymbols } from './runner';

const RESTART_NOTE =
    'The qpl engine crashed and was restarted. Tables you uploaded are back; variables defined in queries are gone.';

/**
 * The app's handle on the qpl interpreter: an engine (a worker) plus the
 * bookkeeping needed to survive it crashing. A Rust panic aborts the wasm and
 * poisons the whole module instance, so the only recovery is a new worker: the
 * session keeps the bytes of every table it was given and loads them into the
 * replacement.
 */
export class QplSession {
    private engine: QplEngine;
    /** Bumped on each restart, so concurrent callers that all saw one crash restart once. */
    private generation = 0;
    private restarting: Promise<void> | null = null;
    /** What was registered, kept so a replacement engine can be filled. */
    private readonly registered = new Map<string, Uint8Array>();

    constructor(private readonly makeEngine: () => QplEngine) {
        this.engine = makeEngine();
    }

    /** Bind `name` to the Arrow IPC table in `ipc`, replacing any earlier binding. */
    async registerTable(name: string, ipc: Uint8Array): Promise<void> {
        await this.guard((e) => e.registerTable(name, ipc));
        this.registered.set(name, ipc);
    }

    /** Rows in the table bound to `name` (rejects if it isn't one). */
    rowCount(name: string): Promise<number> {
        return this.guard((e) => e.rowCount(name));
    }

    /** Run one statement. Never rejects on a qpl or crash error: it is in `error`. */
    evalStatement(line: string): Promise<QplResult> {
        return this.result((e) => e.evalStatement(line));
    }

    /** Run editor text: one or more statements, see runStatements. Same error handling. */
    run(src: string): Promise<QplResult> {
        return this.result((e) => e.run(src));
    }

    /** Monaco language setup - see qplLangConfig in qpl.d.ts. */
    langConfig(): Promise<unknown> {
        return this.guard((e) => e.langConfig());
    }

    /** Tables, variables and functions bound right now - what completion offers. */
    symbols(): Promise<QplSymbols> {
        return this.guard((e) => e.symbols());
    }

    /** Run against the engine; on a crash, replace it and try once more. */
    private async guard<T>(fn: (e: QplEngine) => Promise<T>): Promise<T> {
        const gen = this.generation;
        try {
            return await fn(this.engine);
        } catch (e) {
            if (!(e instanceof QplCrashed)) throw e;
            await this.restart(gen);
            return fn(this.engine);
        }
    }

    /** For queries: a crash is reported (the query may be what crashed it), not retried. */
    private async result(fn: (e: QplEngine) => Promise<QplResult>): Promise<QplResult> {
        const gen = this.generation;
        try {
            return await fn(this.engine);
        } catch (e) {
            if (!(e instanceof QplCrashed)) throw e;
            await this.restart(gen);
            return { output: '', error: `${RESTART_NOTE} (${e.message})`, ipc: null };
        }
    }

    private restart(seen: number): Promise<void> {
        // someone else already replaced the engine this caller saw crash
        if (seen !== this.generation) return this.restarting ?? Promise.resolve();
        this.generation++;
        this.engine.dispose();
        this.engine = this.makeEngine();
        const engine = this.engine;
        this.restarting = (async () => {
            for (const [name, ipc] of this.registered) {
                try {
                    await engine.registerTable(name, ipc);
                } catch {
                    /* drop a table that no longer registers rather than failing the restart */
                }
            }
        })();
        return this.restarting;
    }
}
