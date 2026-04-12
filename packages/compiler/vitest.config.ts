import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        statements: 89,
        branches: 86,
        functions: 81,
        lines: 89,
      },
    },
    isolate: true,
  },
});
