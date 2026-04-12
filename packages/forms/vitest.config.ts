import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/forms',
      include: ['src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        statements: 97,
        branches: 97,
        functions: 83,
        lines: 97,
      },
    },
    isolate: true,
  },
});
