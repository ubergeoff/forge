// =============================================================================
// @forge/cli — forge typecheck
// Delegates to `tsc --build` in the project root.
// =============================================================================

import { spawnSync } from 'node:child_process';

/**
 * Runs TypeScript type checking via `tsc --build`.
 * Passes `--noEmit` unless the project tsconfig already disables emit.
 * Exits with the same code as tsc.
 */
export function runTypecheck(args: string[]): void {
  const noEmit = args.includes('--emit') ? [] : ['--noEmit'];

  console.log('[forge typecheck] Running tsc --build...');

  const result = spawnSync('tsc', ['--build', ...noEmit], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  });

  if (result.error !== undefined) {
    console.error('[Forge CLI] Failed to run tsc:', result.error.message);
    process.exit(1);
    return;
  }

  process.exit(result.status ?? 0);
}
