import { defineConfig } from 'rolldown';

const nodeBuiltins = [
  'node:fs',
  'node:path',
  'node:http',
  'node:url',
  'node:process',
  'node:child_process',
];

const external = ['@vorra/compiler', '@vorra/core', 'rolldown', ...nodeBuiltins];

export default defineConfig({
  input: { index: 'src/index.ts', bin: 'src/bin.ts' },
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: '[name].js',
    sourcemap: true,
  },
  external,
});
