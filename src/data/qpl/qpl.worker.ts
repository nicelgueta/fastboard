import init, { Repl, qplLangConfig } from 'qpl';
import wasmUrl from 'qpl/qpl_bg.wasm?url';
import type { QplRequest } from './protocol';
import type { SyncRepl } from './runner';
import { createHandler, transferablesOf } from './workerCore';

/**
 * The qpl interpreter's own thread (see WorkerEngine on the other end). Keeping
 * the wasm here means a long query does not freeze the UI, and a crashed
 * interpreter can be replaced by terminating this worker.
 */
const handle = createHandler(async () => {
    await init({ module_or_path: wasmUrl });
    return { repl: new Repl() as unknown as SyncRepl, langConfig: qplLangConfig };
});

self.onmessage = async (e: MessageEvent<QplRequest>) => {
    const res = await handle(e.data);
    self.postMessage(res, { transfer: transferablesOf(res) });
};
