// =============================================================================
// vorra-dedupe-plugin
// Forces all @vorra/* imports to their canonical dist entry points so that
// Rolldown always bundles a single module instance, regardless of whether the
// import comes from TypeScript source (resolved via tsconfig paths → src/) or
// from a pre-built dist file (node_modules resolution → dist/).
//
// Dual-instance @vorra/core is the most critical failure mode: two copies of
// the reactivity module produce two independent `activeContext` globals, so
// signals created by one instance are invisible to effects created by the
// other (e.g. form control signals never connecting to template effects).
// =============================================================================

import * as path from 'node:path';
import { createRequire } from 'node:module';
import type { RolldownPlugin } from 'rolldown';

const _require = createRequire(import.meta.url);

/**
 * Resolves an `@vorra/*` package to an absolute path inside its `dist/`
 * directory. Uses the CJS main entry as an anchor so we never need to access
 * `pkg/package.json` directly (which would require the package's `exports`
 * field to allow that subpath).
 */
export function resolveVorraPackage(name: string, subpath = 'dist/index.js'): string {
  const mainCjs = _require.resolve(name); // → packages/*/dist/index.cjs
  const pkgRoot = path.dirname(path.dirname(mainCjs)); // strip dist/index.cjs
  return path.join(pkgRoot, subpath);
}

/**
 * Lazily-built alias map. Populated on first use inside `resolveId` so that
 * importing this module never triggers `_require.resolve()` at load time.
 * This keeps the module safe to import in test environments where `dist/`
 * files may not exist yet.
 */
let _aliases: Record<string, string> | undefined;

export function getVorraAliases(): Record<string, string> {
  if (_aliases === undefined) {
    _aliases = {
      '@vorra/core':            resolveVorraPackage('@vorra/core'),
      '@vorra/core/dom':        resolveVorraPackage('@vorra/core', 'dist/dom.js'),
      '@vorra/core/reactivity': resolveVorraPackage('@vorra/core', 'dist/reactivity.js'),
      '@vorra/core/di':         resolveVorraPackage('@vorra/core', 'dist/di.js'),
      '@vorra/forms':           resolveVorraPackage('@vorra/forms'),
      '@vorra/router':          resolveVorraPackage('@vorra/router'),
    };
  }
  return _aliases;
}

/**
 * Rolldown plugin that forces all `@vorra/*` imports to their canonical dist
 * entry points. A `resolveId` hook applies unconditionally to every import —
 * including those inside pre-built dist files — unlike `resolve.alias` which
 * Rolldown skips for files it considers already-resolved.
 */
export const vorraDedupePlugin: RolldownPlugin = {
  name: 'vorra-dedupe',
  resolveId(id: string) {
    const resolved = getVorraAliases()[id];
    if (resolved !== undefined) {
      return { id: resolved, external: false };
    }
    return undefined;
  },
};
