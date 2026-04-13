// =============================================================================
// forge-dedupe-plugin — unit tests
// =============================================================================

import * as path from 'node:path';
import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock createRequire so _require.resolve() returns predictable fake paths
// without needing real dist/ files on disk.
// vi.mock is hoisted before imports by Vitest, so the plugin module picks up
// the mock when it calls createRequire at module initialisation time.
// ---------------------------------------------------------------------------

const FAKE_ROOTS: Record<string, string> = {
  '@forge/core':   '/fake/node_modules/@forge/core/dist/index.cjs',
  '@forge/forms':  '/fake/node_modules/@forge/forms/dist/index.cjs',
  '@forge/router': '/fake/node_modules/@forge/router/dist/index.cjs',
};

vi.mock('node:module', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:module')>();
  return {
    ...original,
    createRequire: () =>
      Object.assign((id: string) => id, {
        resolve: (name: string) => {
          const hit = FAKE_ROOTS[name];
          if (hit) return hit;
          throw new Error(`Cannot find module '${name}'`);
        },
        cache: {},
        extensions: {},
        main: undefined,
      }),
  };
});

const { resolveForgePackage, getForgeAliases, forgeDedupePlugin } =
  await import('../src/utils/forge-dedupe-plugin.js');

// ---------------------------------------------------------------------------
// resolveForgePackage()
// ---------------------------------------------------------------------------

describe('resolveForgePackage()', () => {
  it('returns an absolute path ending with the requested subpath', () => {
    const result = resolveForgePackage('@forge/core');
    expect(path.isAbsolute(result)).toBe(true);
    expect(result.endsWith(path.join('dist', 'index.js'))).toBe(true);
  });

  it('accepts a custom subpath', () => {
    const result = resolveForgePackage('@forge/core', 'dist/dom.js');
    expect(result.endsWith(path.join('dist', 'dom.js'))).toBe(true);
  });

  it('resolves to the same package root for different subpaths', () => {
    const index = resolveForgePackage('@forge/core');
    const dom   = resolveForgePackage('@forge/core', 'dist/dom.js');
    expect(path.dirname(index)).toBe(path.dirname(dom));
  });
});

// ---------------------------------------------------------------------------
// getForgeAliases()
// ---------------------------------------------------------------------------

describe('getForgeAliases()', () => {
  const expectedKeys = [
    '@forge/core',
    '@forge/core/dom',
    '@forge/core/reactivity',
    '@forge/core/di',
    '@forge/forms',
    '@forge/router',
  ];

  it('contains an entry for every expected @forge/* specifier', () => {
    const aliases = getForgeAliases();
    for (const key of expectedKeys) {
      expect(aliases).toHaveProperty(key);
    }
  });

  it('every alias is an absolute path', () => {
    for (const [key, value] of Object.entries(getForgeAliases())) {
      expect(path.isAbsolute(value), `alias for ${key} should be absolute`).toBe(true);
    }
  });

  it('all @forge/core subpath aliases share the same dist directory', () => {
    const aliases = getForgeAliases();
    const coreDir = path.dirname(aliases['@forge/core']!);
    for (const key of ['@forge/core/dom', '@forge/core/reactivity', '@forge/core/di']) {
      expect(path.dirname(aliases[key]!)).toBe(coreDir);
    }
  });
});

// ---------------------------------------------------------------------------
// forgeDedupePlugin — resolveId hook
// ---------------------------------------------------------------------------

describe('forgeDedupePlugin.resolveId()', () => {
  const resolveId = forgeDedupePlugin.resolveId as (id: string) => unknown;

  it('redirects @forge/core to an absolute dist path', () => {
    const result = resolveId('@forge/core') as { id: string; external: boolean };
    expect(result).toBeDefined();
    expect(path.isAbsolute(result.id)).toBe(true);
    expect(result.id).toContain(path.join('dist', 'index.js'));
    expect(result.external).toBe(false);
  });

  it('redirects @forge/core/dom', () => {
    const result = resolveId('@forge/core/dom') as { id: string; external: boolean };
    expect(result.id).toContain(path.join('dist', 'dom.js'));
    expect(result.external).toBe(false);
  });

  it('redirects @forge/forms', () => {
    const result = resolveId('@forge/forms') as { id: string; external: boolean };
    expect(result).toBeDefined();
    expect(path.isAbsolute((result as { id: string }).id)).toBe(true);
  });

  it('returns undefined for non-@forge specifiers', () => {
    expect(resolveId('react')).toBeUndefined();
    expect(resolveId('./local-module')).toBeUndefined();
    expect(resolveId('rolldown')).toBeUndefined();
  });

  it('returns undefined for @forge specifiers not in the alias map', () => {
    expect(resolveId('@forge/unknown-package')).toBeUndefined();
  });
});
