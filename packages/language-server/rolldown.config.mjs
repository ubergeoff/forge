import { defineConfig } from 'rolldown';

export default defineConfig({
  input: {
    server: 'src/server.ts',
  },
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: '[name].js',
    sourcemap: true,
    banner: '#!/usr/bin/env node',
    // Remap specifiers to the .js paths that Node.js ESM requires at runtime.
    paths: {
      'vscode-languageserver/node': 'vscode-languageserver/node.js',
    },
  },
  treeshake: false,
  external: [
    '@vorra/compiler',
    'vscode-languageserver',
    /^vscode-languageserver\//,
    'vscode-languageserver-textdocument',
    /^node:/,
  ],
});
