import { defineConfig } from 'rolldown';

const inputs = {
  index: 'src/index.ts',
  control: 'src/control.ts',
  group: 'src/group.ts',
  array: 'src/array.ts',
  validators: 'src/validators.ts',
};

export default defineConfig([
  // ESM build
  {
    input: inputs,
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].js',
      sourcemap: true,
    },
    external: ['@forge/core'],
  },
  // CJS build
  {
    input: inputs,
    output: {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      sourcemap: true,
    },
    external: ['@forge/core'],
  },
]);
