import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // duckdb-wasm ships pre-bundled ESM workers; excluding it stops esbuild
  // from mangling the worker entry points during dep optimization.
  optimizeDeps: { exclude: ['@duckdb/duckdb-wasm'] },
  worker: { format: 'es' },
});
