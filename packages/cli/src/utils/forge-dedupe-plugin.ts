// =============================================================================
// forge-dedupe-plugin
// Forces all @forge/* imports to their canonical dist entry points so that
// Rolldown always bundles a single module instance, regardless of whether the
// import comes from TypeScript source (resolved via tsconfig paths → src/) or
// from a pre-built dist file (node_modules resolution → dist/).
//
// Dual-instance @forge/core is the most critical failure mode: two copies of
// the reactivity module produce two independent `activeContext` globals, so
// signals created by one instance are invisible to effects created by the
// other (e.g. form control signals never connecting to template effects).
// =============================================================================

import * as path from 'node:path';
import { createRequire } from 'node:module';
import type { RolldownPlugin } from 'rolldown';

const _require = createRequire(import.meta.url);

/**
 * Resolves an `@forge/*` package to an absolute path inside its `dist/`
 * directory. Uses the CJS main entry as an anchor so we never need to access
 * `pkg/package.json` directly (which would require the package's `exports`
 * field to allow that subpath).
 */
export function resolveForgePackage(name: string, subpath = 'dist/index.js'): string {
  const mainCjs = _require.resolve(name); // → packages/*/dist/index.cjs
  const pkgRoot = path.dirname(path.dirname(mainCjs)); // strip dist/index.cjs
  return path.join(pkgRoot, subpath);
}

export const forgeAliases: Record<string, string> = {
  '@forge/core':            resolveForgePackage('@forge/core'),
  '@forge/core/dom':        resolveForgePackage('@forge/core', 'dist/dom.js'),
  '@forge/core/reactivity': resolveForgePackage('@forge/core', 'dist/reactivity.js'),
  '@forge/core/di':         resolveForgePackage('@forge/core', 'dist/di.js'),
  '@forge/forms':           resolveForgePackage('@forge/forms'),
  '@forge/router':          resolveForgePackage('@forge/router'),
};

/**
 * Rolldown plugin that forces all `@forge/*` imports to their canonical dist
 * entry points. A `resolveId` hook applies unconditionally to every import —
 * including those inside pre-built dist files — unlike `resolve.alias` which
 * Rolldown skips for files it considers already-resolved.
 */
export const forgeDedupePlugin: RolldownPlugin = {
  name: 'forge-dedupe',
  resolveId(id: string) {
    const resolved = forgeAliases[id];
    if (resolved !== undefined) {
      return { id: resolved, external: false };
    }
    return undefined;
  },
};
