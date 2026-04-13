import { defineConfig } from 'rolldown';

const nodeBuiltins = [
  'node:fs',
  'node:path',
  'node:http',
  'node:url',
  'node:process',
  'node:child_process',
];

const external = ['@forge/compiler', '@forge/core', 'rolldown', ...nodeBuiltins];

export default defineConfig([
  // ESM build — includes the bin entrypoint
  {
    input: { index: 'src/index.ts', bin: 'src/bin.ts' },
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].js',
      sourcemap: true,
    },
    external,
  },
  // CJS build — library consumers (index only, not bin)
  {
    input: { index: 'src/index.ts' },
    output: {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      sourcemap: true,
    },
    external,
  },
]);
