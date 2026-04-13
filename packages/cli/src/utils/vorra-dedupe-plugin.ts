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
import { fileURLToPath } from 'node:url';
import type { RolldownPlugin } from 'rolldown';

// The resolver defaults to import.meta.resolve (stable since Node 20).
// Tests can swap this out via setResolverForTesting() before importing
// the module under test.
let _metaResolve: (id: string) => string = (id) => import.meta.resolve(id);

/** @internal — for test use only */
export function setResolverForTesting(r: (id: string) => string): void {
  _metaResolve = r;
  _aliases = undefined; // bust the alias cache so new paths are computed
}

/**
 * Resolves an `@vorra/*` package to an absolute path inside its `dist/`
 * directory. Uses import.meta.resolve() (stable since Node 20) to locate
 * the package's ESM main entry, then walks up to the package root.
 */
export function resolveVorraPackage(name: string, subpath = 'dist/index.js'): string {
  const resolved = _metaResolve(name); // → file:///…/dist/index.js (or plain path in tests)
  const mainPath = resolved.startsWith('file://') ? fileURLToPath(resolved) : resolved;
  const pkgRoot = path.dirname(path.dirname(mainPath)); // strip dist/index.js
  return path.join(pkgRoot, subpath);
}

/**
 * Lazily-built alias map. Populated on first use inside `resolveId` so that
 * importing this module never triggers resolution at load time.
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
