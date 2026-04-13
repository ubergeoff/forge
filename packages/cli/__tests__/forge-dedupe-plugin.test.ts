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
  '@vorra/core':   '/fake/node_modules/@vorra/core/dist/index.cjs',
  '@vorra/forms':  '/fake/node_modules/@vorra/forms/dist/index.cjs',
  '@vorra/router': '/fake/node_modules/@vorra/router/dist/index.cjs',
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
    const result = resolveForgePackage('@vorra/core');
    expect(path.isAbsolute(result)).toBe(true);
    expect(result.endsWith(path.join('dist', 'index.js'))).toBe(true);
  });

  it('accepts a custom subpath', () => {
    const result = resolveForgePackage('@vorra/core', 'dist/dom.js');
    expect(result.endsWith(path.join('dist', 'dom.js'))).toBe(true);
  });

  it('resolves to the same package root for different subpaths', () => {
    const index = resolveForgePackage('@vorra/core');
    const dom   = resolveForgePackage('@vorra/core', 'dist/dom.js');
    expect(path.dirname(index)).toBe(path.dirname(dom));
  });
});

// ---------------------------------------------------------------------------
// getForgeAliases()
// ---------------------------------------------------------------------------

describe('getForgeAliases()', () => {
  const expectedKeys = [
    '@vorra/core',
    '@vorra/core/dom',
    '@vorra/core/reactivity',
    '@vorra/core/di',
    '@vorra/forms',
    '@vorra/router',
  ];

  it('contains an entry for every expected @vorra/* specifier', () => {
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

  it('all @vorra/core subpath aliases share the same dist directory', () => {
    const aliases = getForgeAliases();
    const coreDir = path.dirname(aliases['@vorra/core']!);
    for (const key of ['@vorra/core/dom', '@vorra/core/reactivity', '@vorra/core/di']) {
      expect(path.dirname(aliases[key]!)).toBe(coreDir);
    }
  });
});

// ---------------------------------------------------------------------------
// forgeDedupePlugin — resolveId hook
// ---------------------------------------------------------------------------

describe('forgeDedupePlugin.resolveId()', () => {
  const resolveId = forgeDedupePlugin.resolveId as (id: string) => unknown;

  it('redirects @vorra/core to an absolute dist path', () => {
    const result = resolveId('@vorra/core') as { id: string; external: boolean };
    expect(result).toBeDefined();
    expect(path.isAbsolute(result.id)).toBe(true);
    expect(result.id).toContain(path.join('dist', 'index.js'));
    expect(result.external).toBe(false);
  });

  it('redirects @vorra/core/dom', () => {
    const result = resolveId('@vorra/core/dom') as { id: string; external: boolean };
    expect(result.id).toContain(path.join('dist', 'dom.js'));
    expect(result.external).toBe(false);
  });

  it('redirects @vorra/forms', () => {
    const result = resolveId('@vorra/forms') as { id: string; external: boolean };
    expect(result).toBeDefined();
    expect(path.isAbsolute((result as { id: string }).id)).toBe(true);
  });

  it('returns undefined for non-@vorra specifiers', () => {
    expect(resolveId('react')).toBeUndefined();
    expect(resolveId('./local-module')).toBeUndefined();
    expect(resolveId('rolldown')).toBeUndefined();
  });

  it('returns undefined for @vorra specifiers not in the alias map', () => {
    expect(resolveId('@vorra/unknown-package')).toBeUndefined();
  });
});
