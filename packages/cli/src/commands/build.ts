// =============================================================================
// @forge/cli — forge build
// Runs a one-shot Rolldown production build with the Forge plugin.
// =============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { rolldown } from 'rolldown';
import type { RolldownPlugin } from 'rolldown';
import { forgePlugin } from '@forge/compiler';
import { loadConfig } from '../utils/config.js';
import { forgeDedupePlugin } from '../utils/forge-dedupe-plugin.js';

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
  const entryName = path.basename(entry, path.extname(entry));
  const userPlugins = (config.plugins ?? []) as RolldownPlugin[];
  const plugins: RolldownPlugin[] = [
    forgeDedupePlugin as RolldownPlugin,
    forgePlugin({
      ...(config.css ? { css: path.join(cwd, config.css) } : {}),
      ...(config.postcss ? { postcss: config.postcss } : {}),
    }) as RolldownPlugin,
    ...userPlugins,
  ];

  console.log(`[forge build] ${entry} → ${outDir}/`);

  const build = await rolldown({
    input: entryAbs,
    plugins,
  });

  const sourcemap = config.sourcemap ?? false;

  await build.write({
    dir: outDirAbs,
    format: 'es',
    sourcemap,
    entryFileNames: '[name].js',
    chunkFileNames: '[name]-[hash].js',
  });

  // -------------------------------------------------------------------------
  // Copy index.html into dist/, rewriting script/link src paths that reference
  // the output directory so the dist/ folder is fully self-contained.
  // -------------------------------------------------------------------------
  const htmlSrc = path.join(cwd, 'index.html');
  if (fs.existsSync(htmlSrc)) {
    const outDirRel = path.relative(cwd, outDirAbs).replace(/\\/g, '/');
    // Match src/href attribute values that start with the outDir prefix
    // (with or without a leading ./), e.g. "./dist/main.js" or "dist/main.js".
    const outDirPattern = new RegExp(
      `((?:src|href)=["'])(?:\\./)?(${escapeRegExp(outDirRel)}/)`,
      'g',
    );
    let html = fs.readFileSync(htmlSrc, 'utf8');
    // Rewrite any existing script/link paths that reference the outDir prefix.
    html = html.replace(outDirPattern, '$1');
    // Auto-inject the entry module script if the HTML has no module script tag.
    if (!/<script\s[^>]*type=["']module["']/i.test(html)) {
      const tag = `  <script type="module" src="./${entryName}.js"></script>`;
      html = html.includes('</body>') ? html.replace('</body>', `${tag}\n</body>`) : html + tag;
    }
    fs.writeFileSync(path.join(outDirAbs, 'index.html'), html, 'utf8');
    console.log(`[forge build] Copied index.html → ${outDir}/index.html`);
  } else {
    console.warn('[forge build] No index.html found in project root — skipping HTML copy.');
  }

  console.log('[forge build] Done.');
}

/** Escapes special regex characters in a literal string. */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
