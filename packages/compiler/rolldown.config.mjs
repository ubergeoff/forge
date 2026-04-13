import { defineConfig } from 'rolldown';

export default defineConfig([
  // Node.js + browser build (ESM) — all entries including browser-safe variants
  {
    input: {
      index: 'src/index.ts',
      parser: 'src/parser.ts',
      'compiler-shared': 'src/compiler-shared.ts',
      compiler: 'src/compiler.ts',
      plugin: 'src/plugin.ts',
      browser: 'src/browser.ts',
    },
    output: { dir: 'dist', format: 'esm', entryFileNames: '[name].js', sourcemap: true },
    external: ['@forge/core', 'oxc-transform', /^node:/],
  },
  // CJS build — Node.js only (no browser entry needed for CJS)
  {
    input: {
      index: 'src/index.ts',
      parser: 'src/parser.ts',
      compiler: 'src/compiler.ts',
      plugin: 'src/plugin.ts',
    },
    output: { dir: 'dist', format: 'cjs', entryFileNames: '[name].cjs', sourcemap: true },
    external: ['@forge/core', 'oxc-transform', /^node:/],
  },
]);
