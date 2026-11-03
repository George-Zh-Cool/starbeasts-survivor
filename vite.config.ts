import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages project site: https://george-zh-cool.github.io/starbeasts-survivor/
  base: '/starbeasts-survivor/',
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
