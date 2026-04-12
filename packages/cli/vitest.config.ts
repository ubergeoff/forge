import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/cli',
      include: ['src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        statements: 6,
        branches: 42,
        functions: 7,
        lines: 6,
      },
    },
    isolate: true,
  },
});
