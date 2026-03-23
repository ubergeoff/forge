/**
 * Bundles @forge/core, @forge/core/dom and @forge/forms into standalone
 * ESM files in docs/public/forge/. These are served as static assets by
 * VitePress and referenced via import maps in the playground iframe.
 *
 * Run before `vitepress build` or `vitepress dev` via the prebuild script.
 */

import { rolldown } from 'rolldown'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../public/forge')

await fs.mkdir(outDir, { recursive: true })

// Bundle everything into ONE file. This is critical: @forge/core and
// @forge/core/dom both import from reactivity.js. If they're separate bundles
// they each get their own copy of the scheduler, breaking signal→effect wiring.
// Mapping both import-map entries to the same file fixes this.
// forge.js — single bundle containing ALL of @forge/core (reactivity + di + dom).
// Both "@forge/core" and "@forge/core/dom" map to this file in the import map
// so signals and effects share one scheduler instance.
console.log('Bundling forge…')
const forgeBundle = await rolldown({
  input: path.resolve(__dirname, '../../packages/core/dist/index.js'),
  treeshake: true,
})
await forgeBundle.write({
  format: 'esm',
  file: path.join(outDir, 'forge.js'),
  inlineDynamicImports: true,
})

// forms.js — externals @forge/core so it shares the same forge.js instance.
// The `paths` option rewrites "@forge/core" imports to the correct browser URL.
console.log('Bundling forms…')
const formsBundle = await rolldown({
  input: path.resolve(__dirname, '../../packages/forms/dist/index.js'),
  treeshake: true,
  external: ['@forge/core'],
})
await formsBundle.write({
  format: 'esm',
  file: path.join(outDir, 'forms.js'),
  inlineDynamicImports: true,
  paths: { '@forge/core': '/forge/forge.js' },
})

console.log('Forge runtime bundles written to docs/public/forge/')
