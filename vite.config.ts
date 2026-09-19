import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // duckdb-wasm ships pre-bundled ESM workers; excluding it stops esbuild
  // from mangling the worker entry points during dep optimization. qpl's wasm
  // bundle is loaded by explicit URL (src/data/qpl/runtime.ts), which the
  // optimizer would likewise break.
  optimizeDeps: { exclude: ['@duckdb/duckdb-wasm', 'qpl'] },
  // node_modules/qpl is a link to the qpl repo's wasm build, outside this root.
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../qpl/tools/wasm/pkg'] },
    // The Reddit widget's stream comes from server/ (fastboard-server, port 8080).
    proxy: { '/sse': 'http://127.0.0.1:8080' },
  },
  worker: { format: 'es' },
});
