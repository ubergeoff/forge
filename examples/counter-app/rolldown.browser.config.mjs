import { defineConfig } from 'rolldown';
import { forgePlugin } from '@forge/compiler';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  input: 'src/browser-main.ts',
  output: {
    dir: path.join(__dirname, 'dist'),
    entryFileNames: 'browser.js',
    format: 'esm',
    sourcemap: true,
  },
  plugins: [
    forgePlugin({
      css: path.join(__dirname, 'src/tailwind.css'),
      postcss: { plugins: [tailwindcss()] },
    }),
  ],
});
