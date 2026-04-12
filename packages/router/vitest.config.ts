import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    globals: false,
    environment: 'node',
    environmentMatchGlobs: [
      ['__tests__/router.test.ts', 'happy-dom'],
      ['__tests__/link.test.ts', 'happy-dom'],
      ['__tests__/outlet.test.ts', 'happy-dom'],
      ['__tests__/components.test.ts', 'happy-dom'],
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        statements: 90,
        branches: 87,
        functions: 85,
        lines: 90,
      },
    },
    isolate: true,
  },
});
