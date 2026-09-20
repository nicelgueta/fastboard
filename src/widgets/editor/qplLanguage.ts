import type * as Monaco from 'monaco-editor';
import { getQplLangConfig, getQplSymbols } from '../../data/qpl/runtime';
import type { QplSymbols } from '../../data/qpl/runner';

/**
 * Registers qpl with Monaco: tokenizer, language configuration and
 * completions, all built by the qpl wasm from the same vocabulary the VS Code
 * extension uses (see qplLangConfig in qpl's tools/wasm README).
 *
 * Idempotent and shared: Monaco languages are global, so this runs once per
 * page no matter how many editor widgets there are. Loading the config
 * instantiates the qpl wasm, so it is only called when a qpl editor mounts.
 */
let registered: Promise<void> | null = null;

export function ensureQplLanguage(monaco: typeof Monaco): Promise<void> {
    if (!registered) {
        registered = (async () => {
            const cfg = await getQplLangConfig();
            monaco.languages.register({ id: cfg.id, extensions: cfg.extensions, aliases: cfg.aliases });
            monaco.languages.setLanguageConfiguration(cfg.id, cfg.configuration);
            monaco.languages.setMonarchTokensProvider(cfg.id, cfg.monarch);
            monaco.languages.registerCompletionItemProvider(cfg.id, {
                async provideCompletionItems(model, position) {
                    const word = model.getWordUntilPosition(position);
                    const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn,
                    };
                    // what the interpreter has bound right now; keywords still work if it can't be asked
                    const live = symbolCompletions(await getQplSymbols().catch(() => null));
                    return {
                        suggestions: [...live, ...cfg.completions].map((c: QplCompletion) => ({
                            ...c,
                            range,
                            kind: monaco.languages.CompletionItemKind[c.kind],
                            insertText: c.insertText ?? c.label,
                            insertTextRules: c.insertTextRules
                                ? monaco.languages.CompletionItemInsertTextRule[c.insertTextRules]
                                : undefined,
                        })),
                    };
                },
            });
        })().catch((e) => {
            registered = null; // let the next mount retry
            throw e;
        });
    }
    return registered;
}

/** Completion items for what the VM has bound: tables (with their columns), variables and functions. */
export function symbolCompletions(symbols: QplSymbols | null): QplCompletion[] {
    if (!symbols) return [];
    const items: QplCompletion[] = [];
    for (const t of symbols.tables) {
        items.push({ label: t.name, kind: 'Struct', detail: t.rows === undefined ? 'table' : `table, ${t.rows} rows` });
    }
    for (const name of symbols.variables) items.push({ label: name, kind: 'Variable', detail: 'variable' });
    for (const name of symbols.functions) items.push({ label: name, kind: 'Function', detail: 'function' });
    const seen = new Set<string>();
    for (const t of symbols.tables) {
        for (const col of t.columns ?? []) {
            if (seen.has(col)) continue;
            seen.add(col);
            items.push({ label: col, kind: 'Field', detail: `column of ${t.name}` });
        }
    }
    return items;
}

// kind / insertTextRules come back as enum *names* (they differ between Monaco versions)
export interface QplCompletion {
    label: string;
    kind: keyof typeof Monaco.languages.CompletionItemKind;
    detail?: string;
    insertText?: string;
    insertTextRules?: keyof typeof Monaco.languages.CompletionItemInsertTextRule;
}
