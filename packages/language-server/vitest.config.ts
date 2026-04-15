import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/language-server',
      include: ['src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      reporter: ['text', 'lcov', 'html'],
    },
    isolate: true,
  },
});
