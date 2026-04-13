#!/usr/bin/env node
// =============================================================================
// vorra CLI — bin entrypoint
// Usage: vorra <command> [options]
// =============================================================================

import { runBuild } from './commands/build.js';
import { runDev } from './commands/dev.js';
import { runNew } from './commands/new.js';
import { runTypecheck } from './commands/typecheck.js';

const args = process.argv.slice(2);
const command = args[0];
const commandArgs = args.slice(1);

const VERSION = '0.1.0';

const HELP = `
  ⚡ Vorra — compiled signal-first framework for enterprise apps

  Usage: vorra <command> [options]

  Commands:
    new <name>          Scaffold a new Vorra application
    dev                 Start the development server (with live reload)
    build               Build for production
    typecheck           Run TypeScript type checking

  Options:
    --help, -h          Show this help message
    --version, -v       Show the Vorra version

  Flags per command:
    dev   --port <n>    Dev server port (default: 3000)
          --entry <p>   Entry file     (default: src/main.ts)
          --outDir <p>  Output dir     (default: dist)
    build --entry <p>   Entry file     (default: src/main.ts)
          --outDir <p>  Output dir     (default: dist)

  Examples:
    vorra new my-app
    vorra dev --port 4000
    vorra build --outDir dist
`;

switch (command) {
  case 'new':
    runNew(commandArgs);
    break;

  case 'dev':
    runDev(commandArgs).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Vorra CLI] dev error:', msg);
      process.exit(1);
    });
    break;

  case 'build':
    runBuild(commandArgs).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Vorra CLI] build error:', msg);
      process.exit(1);
    });
    break;

  case 'typecheck':
    runTypecheck(commandArgs);
    break;

  case '--version':
  case '-v':
    console.log(VERSION);
    break;

  case '--help':
  case '-h':
  case undefined:
    console.log(HELP);
    break;

  default:
    console.error(
      `[Vorra CLI] Unknown command: "${command}". Run "vorra --help" for usage.`,
    );
    process.exit(1);
}
