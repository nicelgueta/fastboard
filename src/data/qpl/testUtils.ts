import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { QplRequest, QplResponse } from './protocol';
import { transferablesOf } from './workerCore';
import type { WorkerLike } from './WorkerEngine';

/**
 * A Worker stand-in that runs the request handler in-process, asynchronously,
 * with a structured clone in each direction - what a real worker does to its
 * messages - so anything that isn't clone-safe fails in tests, not in a browser.
 * Test-only: nothing in the app imports this.
 */
export class LoopbackWorker implements WorkerLike {
    onmessage: WorkerLike['onmessage'] = null;
    onerror: WorkerLike['onerror'] = null;
    onmessageerror: WorkerLike['onmessageerror'] = null;
    terminated = false;

    constructor(private readonly handle: (req: QplRequest) => Promise<QplResponse>) {}

    postMessage(message: unknown, options?: { transfer?: Transferable[] }): void {
        const req = structuredClone(message, { transfer: options?.transfer }) as QplRequest;
        setTimeout(async () => {
            if (this.terminated) return;
            const res = await this.handle(req);
            if (this.terminated) return;
            const data = structuredClone(res, { transfer: transferablesOf(res) });
            this.onmessage?.({ data } as MessageEvent<QplResponse>);
        }, 0);
    }

    terminate(): void {
        this.terminated = true;
    }
}

/**
 * The real qpl wasm build (../qpl/tools/wasm, linked as node_modules/qpl), if it
 * has been built (`make wasm` in the qpl repo) and is recent enough to have this
 * app's API. Tests that need the interpreter skip themselves when it isn't.
 */
function locateQplWasm(): string | null {
    try {
        const path = createRequire(import.meta.url).resolve('qpl/qpl_bg.wasm');
        return existsSync(path) && readFileSync(path).includes(Buffer.from('registerTable')) ? path : null;
    } catch {
        return null;
    }
}
export const qplWasmPath = locateQplWasm();
