import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    // Several test files each migrate a fresh in-memory PGlite; under the
    // default parallelism that can stretch past the default 5s test and 10s hook
    // timeouts on slower runs (migrations run in beforeAll).
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
