import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    globals: false,
    environment: 'node',
    environmentMatchGlobs: [
      ['__tests__/router.test.ts', 'happy-dom'],
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        statements: 39,
        branches: 82,
        functions: 52,
        lines: 39,
      },
    },
    isolate: true,
  },
});
