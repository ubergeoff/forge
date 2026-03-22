import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run all test files across all packages
    include: ['packages/*/__tests__/**/*.test.ts'],
    globals: false,
    environment: 'node',
    environmentMatchGlobs: [
      // DOM tests run in happy-dom
      ['packages/core/__tests__/dom.test.ts', 'happy-dom'],
      ['packages/router/__tests__/router.test.ts', 'happy-dom'],
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      reporter: ['text', 'lcov', 'html'],
    },
    // Each test file gets its own isolated module scope
    isolate: true,
  },
});
