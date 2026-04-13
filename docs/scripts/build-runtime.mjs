/**
 * Bundles @vorra/core, @vorra/core/dom and @vorra/forms into standalone
 * ESM files in docs/public/vorra/. These are served as static assets by
 * VitePress and referenced via import maps in the playground iframe.
 *
 * Run before `vitepress build` or `vitepress dev` via the prebuild script.
 */

import { rolldown } from 'rolldown'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../public/vorra')')

await fs.mkdir(outDir, { recursive: true })

// Bundle everything into ONE file. This is critical: @vorra/core and
// @vorra/core/dom both import from reactivity.js. If they're separate bundles
// they each get their own copy of the scheduler, breaking signal→effect wiring.
// Mapping both import-map entries to the same file fixes this.
// vorra.js — single bundle containing ALL of @vorra/core (reactivity + di + dom).
// Both "@vorra/core" and "@vorra/core/dom" map to this file in the import map
// so signals and effects share one scheduler instance.
console.log('Bundling vorra…')
const vorraBundle = await rolldown({
  input: path.resolve(__dirname, '../../packages/core/dist/index.js'),
  treeshake: true,
})
await vorraBundle.write({
  format: 'esm',
  file: path.join(outDir, 'vorra.js'),
  inlineDynamicImports: true,
})

// forms.js — externals @vorra/core so it shares the same vorra.js instance.
// The `paths` option rewrites "@vorra/core" imports to the correct browser URL.
console.log('Bundling forms…')
const formsBundle = await rolldown({
  input: path.resolve(__dirname, '../../packages/forms/dist/index.js'),
  treeshake: true,
  external: ['@vorra/core'],
})
await formsBundle.write({
  format: 'esm',
  file: path.join(outDir, 'forms.js'),
  inlineDynamicImports: true,
  paths: { '@vorra/core': '/vorra/vorra.js' },
})

console.log('Forge runtime bundles written to docs/public/vorra/')
