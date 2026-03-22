#!/usr/bin/env node
// =============================================================================
// forge CLI — bin entrypoint
// Usage: forge <command> [options]
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
  ⚡ Forge — compiled signal-first framework for enterprise apps

  Usage: forge <command> [options]

  Commands:
    new <name>          Scaffold a new Forge application
    dev                 Start the development server (with live reload)
    build               Build for production
    typecheck           Run TypeScript type checking

  Options:
    --help, -h          Show this help message
    --version, -v       Show the Forge version

  Flags per command:
    dev   --port <n>    Dev server port (default: 3000)
          --entry <p>   Entry file     (default: src/main.ts)
          --outDir <p>  Output dir     (default: dist)
    build --entry <p>   Entry file     (default: src/main.ts)
          --outDir <p>  Output dir     (default: dist)

  Examples:
    forge new my-app
    forge dev --port 4000
    forge build --outDir dist
`;

switch (command) {
  case 'new':
    runNew(commandArgs);
    break;

  case 'dev':
    runDev(commandArgs).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Forge CLI] dev error:', msg);
      process.exit(1);
    });
    break;

  case 'build':
    runBuild(commandArgs).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Forge CLI] build error:', msg);
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
      `[Forge CLI] Unknown command: "${command}". Run "forge --help" for usage.`,
    );
    process.exit(1);
}
