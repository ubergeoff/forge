#!/usr/bin/env node
// Entrypoint for the Vorra LSP server. Run with: vorra-lsp --stdio
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const server = join(__dirname, '..', 'dist', 'server.js');
const result = spawnSync(process.execPath, [server, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 0);
