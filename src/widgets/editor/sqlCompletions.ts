import type * as Monaco from 'monaco-editor';
import type { TableWidgetExports } from '../types';

export interface CompletionSource {
  tableName: string;
  columns: string[];
}

/**
 * Pure transform from a set of live table widgets' published exports to the
 * shape the SQL completion provider needs. Split out from the provider so it
 * can be unit tested without a monaco/DOM environment.
 */
export function tableWidgetsToCompletionSources(
  entries: Array<Pick<TableWidgetExports, 'tableName' | 'schema'> | undefined>
): CompletionSource[] {
  const sources: CompletionSource[] = [];
  for (const e of entries) {
    if (!e || !e.tableName) continue;
    sources.push({
      tableName: e.tableName,
      columns: e.schema?.fields.map((f) => f.name) ?? [],
    });
  }
  return sources;
}

/**
 * Registers a completion provider for the `sql` language that suggests known
 * table names and, once a table name is typed, its column names. `getSources`
 * is called on every completion request so callers can keep the provider
 * live against a ref without re-registering it.
 *
 * Caller owns the returned disposable and must dispose it on unmount -
 * otherwise repeated widget mounts stack duplicate suggestions.
 */
export function registerSqlCompletions(
  monacoInstance: typeof Monaco,
  getSources: () => CompletionSource[]
): Monaco.IDisposable {
  return monacoInstance.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' '],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const suggestions: Monaco.languages.CompletionItem[] = [];
      for (const src of getSources()) {
        suggestions.push({
          label: src.tableName,
          kind: monacoInstance.languages.CompletionItemKind.Struct,
          insertText: src.tableName,
          detail: 'table',
          range,
        });
        for (const col of src.columns) {
          suggestions.push({
            label: col,
            kind: monacoInstance.languages.CompletionItemKind.Field,
            insertText: col,
            detail: src.tableName,
            range,
          });
        }
      }
      return { suggestions };
    },
  });
}
