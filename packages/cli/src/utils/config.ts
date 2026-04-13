// =============================================================================
// @vorra/cli — Config loader
// Loads vorra.config.js / .mjs / .cjs from the project root.
// TypeScript configs require a TS loader (tsx, ts-node) to be active.
// =============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import type { VorraConfig } from '../index.js';

const CONFIG_CANDIDATES = [
  'vorra.config.js',
  'vorra.config.mjs',
  'vorra.config.cjs',
];

/**
 * Loads vorra.config.{js,mjs,cjs} from `cwd` and returns the config object.
 * Returns an empty object if no config file is found.
 *
 * Note: `.ts` configs are not supported at CLI runtime without a TS loader.
 * Compile `vorra.config.ts` to `.js` first, or run with `tsx`:
 *   npx tsx node_modules/.bin/forge dev
 */
export async function loadConfig(cwd: string): Promise<VorraConfig> {
  for (const candidate of CONFIG_CANDIDATES) {
    const configPath = path.join(cwd, candidate);
    if (fs.existsSync(configPath)) {
      const fileUrl = url.pathToFileURL(configPath).href;
      // Dynamic import — works for ESM and CJS configs alike.
      const mod = (await import(fileUrl)) as { default?: unknown };
      if (mod.default !== null && mod.default !== undefined && typeof mod.default === 'object') {
        return mod.default as VorraConfig;
      }
      return {};
    }
  }

  // Warn if a TS config exists but cannot be loaded.
  const tsConfigPath = path.join(cwd, 'vorra.config.ts');
  if (fs.existsSync(tsConfigPath)) {
    console.warn(
      '[Vorra CLI] vorra.config.ts found but cannot be loaded without a TS loader.\n' +
        '  Tip: Compile it first (tsc vorra.config.ts) or run via: npx tsx .../bin.js dev',
    );
  }

  return {};
}
