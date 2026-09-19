import type { QplResult } from './runner';

/**
 * Messages between the main thread (WorkerEngine) and the qpl worker. Every
 * payload is structured-clone safe: bytes, strings and plain objects only.
 */
export type QplRequest = { id: number } & (
    | { method: 'registerTable'; name: string; ipc: Uint8Array }
    | { method: 'rowCount'; name: string }
    | { method: 'evalStatement'; line: string }
    | { method: 'run'; src: string }
    | { method: 'langConfig' }
);

export type QplResponse = { id: number } & (
    | { ok: true; value: unknown }
    // `crashed`: the wasm trapped, so that instance is unusable and the worker must be replaced
    | { ok: false; message: string; crashed: boolean }
);

/** Return type of each method, for typing WorkerEngine.call. */
export interface QplMethods {
    registerTable: void;
    rowCount: number;
    evalStatement: QplResult;
    run: QplResult;
    langConfig: unknown;
}
