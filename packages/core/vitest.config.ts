import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    globals: false,
    environment: 'node',
    environmentMatchGlobs: [
      ['__tests__/dom.test.ts', 'happy-dom'],
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/core',
      include: ['src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        statements: 93,
        branches: 89,
        functions: 96,
        lines: 93,
      },
    },
    isolate: true,
  },
});
