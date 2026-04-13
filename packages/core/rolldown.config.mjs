import { defineConfig } from 'rolldown';

export default defineConfig({
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
});
