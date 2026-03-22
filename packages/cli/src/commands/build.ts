// =============================================================================
// @forge/cli — forge build
// Runs a one-shot Rolldown production build with the Forge plugin.
// =============================================================================

import * as path from 'node:path';
import { rolldown } from 'rolldown';
import type { RolldownPlugin } from 'rolldown';
import { forgePlugin } from '@forge/compiler';
import { loadConfig } from '../utils/config.js';

/**
 * Runs a production build.
 *
 * CLI flags (override forge.config.js):
 *   --entry <path>   Entry file (default: src/main.ts)
 *   --outDir <path>  Output directory (default: dist)
 */
export async function runBuild(args: string[]): Promise<void> {
  const cwd = process.cwd();
  const config = await loadConfig(cwd);

  // Parse CLI flags — these override forge.config values.
  const entryIdx = args.indexOf('--entry');
  const outDirIdx = args.indexOf('--outDir');

  const entry =
    (entryIdx !== -1 ? args[entryIdx + 1] : undefined) ?? config.entry ?? 'src/main.ts';
  const outDir =
    (outDirIdx !== -1 ? args[outDirIdx + 1] : undefined) ?? config.outDir ?? 'dist';

  const entryAbs = path.join(cwd, entry);
  const outDirAbs = path.join(cwd, outDir);
  const userPlugins = (config.plugins ?? []) as RolldownPlugin[];
  const plugins: RolldownPlugin[] = [forgePlugin() as RolldownPlugin, ...userPlugins];

  console.log(`[forge build] ${entry} → ${outDir}/`);

  const build = await rolldown({
    input: entryAbs,
    plugins,
  });

  await build.write({
    dir: outDirAbs,
    format: 'es',
    sourcemap: true,
    entryFileNames: '[name].js',
    chunkFileNames: '[name]-[hash].js',
  });

  console.log('[forge build] Done.');
}
