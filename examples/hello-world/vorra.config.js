// @ts-check
import { defineConfig } from '@vorra/cli';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  entry: 'src/main.ts',
  outDir: 'dist',
  port: 3000,
  css: './src/tailwind.css',
  postcss: { plugins: [tailwindcss()] },
});
