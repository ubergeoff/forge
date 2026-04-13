import { defineConfig } from 'rolldown';

export default defineConfig({
  input: {
    index: 'src/index.ts',
    parser: 'src/parser.ts',
    'compiler-shared': 'src/compiler-shared.ts',
    compiler: 'src/compiler.ts',
    plugin: 'src/plugin.ts',
    browser: 'src/browser.ts',
  },
  output: { dir: 'dist', format: 'esm', entryFileNames: '[name].js', sourcemap: true },
  external: ['@vorra/core', 'oxc-transform', /^node:/],
});
