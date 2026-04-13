import { defineConfig } from 'rolldown';

const inputs = {
  index: 'src/index.ts',
  control: 'src/control.ts',
  group: 'src/group.ts',
  array: 'src/array.ts',
  validators: 'src/validators.ts',
};

export default defineConfig({
  input: inputs,
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: '[name].js',
    sourcemap: true,
  },
  external: ['@vorra/core'],
});
