import { defineConfig } from 'rolldown';

export default defineConfig([
  {
    input: {
      index: 'src/index.ts',
      parser: 'src/parser.ts',
      compiler: 'src/compiler.ts',
      plugin: 'src/plugin.ts',
    },
    output: { dir: 'dist', format: 'esm', entryFileNames: '[name].js', sourcemap: true },
    external: ['@forge/core', 'oxc-transform'],
  },
  {
    input: {
      index: 'src/index.ts',
      parser: 'src/parser.ts',
      compiler: 'src/compiler.ts',
      plugin: 'src/plugin.ts',
    },
    output: { dir: 'dist', format: 'cjs', entryFileNames: '[name].cjs', sourcemap: true },
    external: ['@forge/core', 'oxc-transform'],
  },
]);
