import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/main.ts',
  output: {
    file: 'dist/main.js',
    format: 'esm',
    sourcemap: true,
  },
});
