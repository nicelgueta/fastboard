import { QplSession } from './session';
import { WorkerEngine } from './WorkerEngine';
import QplWorker from './qpl.worker.ts?worker';

let session: QplSession | null = null;

/**
 * The shared qpl interpreter, running in its own worker (qpl.worker.ts). Like
 * getDuckDb(), never call this at module load: creating the session starts the
 * worker, which fetches the ~20 MB wasm module.
 */
export function getQplSession(): Promise<QplSession> {
    session ??= new QplSession(() => new WorkerEngine(new QplWorker()));
    return Promise.resolve(session);
}

/** Names bound in the shared interpreter right now, for editor completion. */
export async function getQplSymbols() {
    return (await getQplSession()).symbols();
}

/** Monaco language setup for qpl - see qplLangConfig in qpl.d.ts. */
export async function getQplLangConfig() {
    return (await getQplSession()).langConfig() as Promise<any>;
}
