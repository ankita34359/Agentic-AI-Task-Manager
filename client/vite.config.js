import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Read PORT from the project-root .env so the dev proxy follows the API port.
  const env = loadEnv(mode, path.resolve(here, '..'), '');
  const apiPort = process.env.PORT || env.PORT || 3000;
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true } },
    },
    build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  };
});
