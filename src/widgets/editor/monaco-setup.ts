/**
 * Self-hosts Monaco under Vite instead of letting @monaco-editor/react pull it
 * from a CDN. Import this module once, from the editor widget only (never
 * from config.ts, which must stay dependency-free so the Add tool menu can
 * list every widget without loading Monaco).
 *
 * The worker entry points are imported by relative path into node_modules
 * rather than via the `monaco-editor` package specifier
 * (`monaco-editor/esm/vs/.../*.worker.js`). monaco-editor's package.json
 * exports map declares both `"./*.js"` and `"./*"` pointing at the same
 * `./esm/vs/*.js` target; Vite 8's rolldown resolver rejects that as an
 * unresolvable subpath for any deep monaco-editor import (verified: even a
 * plain `import 'monaco-editor/esm/vs/editor/editor.api.js'` fails the same
 * way), so the package-specifier form can't be used for `?worker` imports
 * here. The relative path reaches the same file without going through the
 * package's exports map at all.
 */
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
// eslint-disable-next-line import/no-relative-packages
import editorWorker from '../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker';
// eslint-disable-next-line import/no-relative-packages
import jsonWorker from '../../../node_modules/monaco-editor/esm/vs/language/json/json.worker.js?worker';
// eslint-disable-next-line import/no-relative-packages
import tsWorker from '../../../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js?worker';

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new jsonWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};

loader.config({ monaco });
