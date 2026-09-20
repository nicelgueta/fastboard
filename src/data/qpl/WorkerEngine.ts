import type { QplMethods, QplRequest, QplResponse } from './protocol';
import type { QplResult, QplSymbols } from './runner';

/** The bit of a DOM `Worker` this uses, so tests can supply a stand-in. */
export interface WorkerLike {
    postMessage(message: unknown, options?: { transfer?: Transferable[] }): void;
    terminate(): void;
    onmessage: ((e: MessageEvent<QplResponse>) => void) | null;
    onerror: ((e: ErrorEvent) => void) | null;
    onmessageerror: ((e: MessageEvent) => void) | null;
}

/** The worker's wasm trapped or the worker itself died: replace it, its state is gone. */
export class QplCrashed extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'QplCrashed';
    }
}

/**
 * One qpl interpreter running in its own worker. Everything is a promise; a
 * request the interpreter answers with an error rejects with a plain Error, and
 * one that finds the instance dead rejects with QplCrashed.
 */
export interface QplEngine {
    registerTable(name: string, ipc: Uint8Array): Promise<void>;
    rowCount(name: string): Promise<number>;
    evalStatement(line: string): Promise<QplResult>;
    run(src: string): Promise<QplResult>;
    langConfig(): Promise<unknown>;
    symbols(): Promise<QplSymbols>;
    dispose(): void;
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
type Call<M extends keyof QplMethods> = Extract<QplRequest, { method: M }> extends infer R
    ? Omit<R, 'id' | 'method'>
    : never;

export class WorkerEngine implements QplEngine {
    private nextId = 1;
    private readonly pending = new Map<number, Pending>();
    private dead: QplCrashed | null = null;

    constructor(private readonly worker: WorkerLike) {
        worker.onmessage = (e) => this.onResponse(e.data);
        worker.onerror = (e) => this.die(new QplCrashed(`The qpl worker failed: ${e.message || 'unknown error'}`));
        worker.onmessageerror = () => this.die(new QplCrashed('The qpl worker sent a message that could not be read.'));
    }

    private onResponse(res: QplResponse): void {
        const p = this.pending.get(res.id);
        if (!p) return;
        this.pending.delete(res.id);
        if (res.ok) p.resolve(res.value);
        else p.reject(res.crashed ? new QplCrashed(res.message) : new Error(res.message));
    }

    /** Fail everything in flight; later calls fail immediately. */
    private die(err: QplCrashed): void {
        this.dead ??= err;
        for (const p of this.pending.values()) p.reject(err);
        this.pending.clear();
    }

    private call<M extends keyof QplMethods>(method: M, args: Call<M>): Promise<QplMethods[M]> {
        if (this.dead) return Promise.reject(this.dead);
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
            // copied, not transferred: the caller keeps its bytes (the session re-registers them after a crash)
            this.worker.postMessage({ id, method, ...args });
        });
    }

    registerTable(name: string, ipc: Uint8Array) {
        return this.call('registerTable', { name, ipc });
    }
    rowCount(name: string) {
        return this.call('rowCount', { name });
    }
    evalStatement(line: string) {
        return this.call('evalStatement', { line });
    }
    run(src: string) {
        return this.call('run', { src });
    }
    langConfig() {
        return this.call('langConfig', {});
    }
    symbols() {
        return this.call('symbols', {});
    }

    dispose(): void {
        this.die(new QplCrashed('The qpl engine was shut down.'));
        this.worker.terminate();
    }
}
