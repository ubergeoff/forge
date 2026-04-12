// @ts-check
import { defineConfig } from '@forge/cli';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  entry: 'src/browser-main.ts',
  outDir: 'dist',
  port: 3000,
  css: './src/tailwind.css',
  postcss: { plugins: [tailwindcss()] },
});
