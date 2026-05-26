import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload.ts') },
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [react()],
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer.html') },
      },
    },
  },
});
