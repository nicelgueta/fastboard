import type { QplRequest, QplResponse } from './protocol';
import type { SyncRepl } from './runner';
import { runStatements } from './runner';

/** What the worker needs from the loaded wasm module. */
export interface LoadedQpl {
    repl: SyncRepl;
    langConfig: () => unknown;
}

/**
 * The worker's request handler, with wasm loading injected so it can run (and
 * be tested) outside a Worker. qpl.worker.ts is the thin shell around it.
 *
 * Requests are handled strictly in order. A wasm trap (WebAssembly.RuntimeError,
 * e.g. from a Rust panic - the build aborts on panic) poisons the whole module
 * instance, not just the Repl, so it is reported as `crashed` and every later
 * request is refused the same way until the worker is replaced.
 */
export function createHandler(load: () => Promise<LoadedQpl>) {
    let loaded: Promise<LoadedQpl> | null = null;
    let crash: string | null = null;
    let queue: Promise<unknown> = Promise.resolve();

    async function handle(req: QplRequest): Promise<QplResponse> {
        if (crash) return { id: req.id, ok: false, crashed: true, message: crash };
        try {
            // a failed load (e.g. a network error fetching the wasm) is not cached: the next request retries
            loaded ??= load().catch((e) => {
                loaded = null;
                throw e;
            });
            const { repl, langConfig } = await loaded;
            switch (req.method) {
                case 'registerTable':
                    repl.registerTable(req.name, req.ipc);
                    return { id: req.id, ok: true, value: undefined };
                case 'rowCount':
                    return { id: req.id, ok: true, value: repl.rowCount(req.name) };
                case 'evalStatement':
                    return { id: req.id, ok: true, value: repl.evalArrow(req.line) };
                case 'run':
                    return { id: req.id, ok: true, value: runStatements(repl, req.src) };
                case 'langConfig':
                    return { id: req.id, ok: true, value: langConfig() };
                case 'symbols':
                    return { id: req.id, ok: true, value: repl.symbols() };
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            if (e instanceof WebAssembly.RuntimeError) {
                crash = message;
                return { id: req.id, ok: false, crashed: true, message };
            }
            return { id: req.id, ok: false, crashed: false, message };
        }
    }

    /** Serialised: responses come back in request order. */
    return (req: QplRequest): Promise<QplResponse> => {
        const result = queue.then(() => handle(req));
        queue = result.catch(() => undefined);
        return result;
    };
}

/** Transferables in a response: hand result bytes over rather than copying them. */
export function transferablesOf(res: QplResponse): Transferable[] {
    if (!res.ok || typeof res.value !== 'object' || res.value === null) return [];
    const ipc = (res.value as { ipc?: unknown }).ipc;
    return ipc instanceof Uint8Array ? [ipc.buffer] : [];
}
