import { defineConfig } from 'rolldown';

export default defineConfig([
  // ESM build
  {
    input: {
      index: 'src/index.ts',
      reactivity: 'src/reactivity.ts',
      di: 'src/di.ts',
      dom: 'src/dom.ts',
    },
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].js',
      sourcemap: true,
    },
    external: [],
  },
  // CJS build (for Node.js / Jest / older tooling)
  {
    input: {
      index: 'src/index.ts',
      reactivity: 'src/reactivity.ts',
      di: 'src/di.ts',
      dom: 'src/dom.ts',
    },
    output: {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      sourcemap: true,
    },
    external: [],
  },
]);
