import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.tsx', 'src/**/*.{test,spec}.ts'],
    exclude: ['tests/perf/**', 'node_modules/**', 'src-tauri/**'],
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
