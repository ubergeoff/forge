// =============================================================================
// vorra-dedupe-plugin — unit tests
// =============================================================================

import * as path from 'node:path';
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Inject a fake resolver before any module code runs so that
// resolveVorraPackage() gets predictable paths without needing real dist/
// files on disk.
// ---------------------------------------------------------------------------

const FAKE_ROOTS: Record<string, string> = {
  '@vorra/core':   '/fake/node_modules/@vorra/core/dist/index.js',
  '@vorra/forms':  '/fake/node_modules/@vorra/forms/dist/index.js',
  '@vorra/router': '/fake/node_modules/@vorra/router/dist/index.js',
};

const fakeResolver = (name: string): string => {
  const hit = FAKE_ROOTS[name];
  if (hit) return hit;
  throw new Error(`Cannot find module '${name}'`);
};

const { setResolverForTesting, resolveVorraPackage, getVorraAliases, vorraDedupePlugin } =
  await import('../src/utils/vorra-dedupe-plugin.js');

setResolverForTesting(fakeResolver);

// ---------------------------------------------------------------------------
// resolveVorraPackage()
// ---------------------------------------------------------------------------

describe('resolveVorraPackage()', () => {
  it('returns an absolute path ending with the requested subpath', () => {
    const result = resolveVorraPackage('@vorra/core');
    expect(path.isAbsolute(result)).toBe(true);
    expect(result.endsWith(path.join('dist', 'index.js'))).toBe(true);
  });

  it('accepts a custom subpath', () => {
    const result = resolveVorraPackage('@vorra/core', 'dist/dom.js');
    expect(result.endsWith(path.join('dist', 'dom.js'))).toBe(true);
  });

  it('resolves to the same package root for different subpaths', () => {
    const index = resolveVorraPackage('@vorra/core');
    const dom   = resolveVorraPackage('@vorra/core', 'dist/dom.js');
    expect(path.dirname(index)).toBe(path.dirname(dom));
  });
});

// ---------------------------------------------------------------------------
// getVorraAliases()
// ---------------------------------------------------------------------------

describe('getVorraAliases()', () => {
  const expectedKeys = [
    '@vorra/core',
    '@vorra/core/dom',
    '@vorra/core/reactivity',
    '@vorra/core/di',
    '@vorra/forms',
    '@vorra/router',
  ];

  it('contains an entry for every expected @vorra/* specifier', () => {
    const aliases = getVorraAliases();
    for (const key of expectedKeys) {
      expect(aliases).toHaveProperty(key);
    }
  });

  it('every alias is an absolute path', () => {
    for (const [key, value] of Object.entries(getVorraAliases())) {
      expect(path.isAbsolute(value), `alias for ${key} should be absolute`).toBe(true);
    }
  });

  it('all @vorra/core subpath aliases share the same dist directory', () => {
    const aliases = getVorraAliases();
    const coreDir = path.dirname(aliases['@vorra/core']!);
    for (const key of ['@vorra/core/dom', '@vorra/core/reactivity', '@vorra/core/di']) {
      expect(path.dirname(aliases[key]!)).toBe(coreDir);
    }
  });
});

// ---------------------------------------------------------------------------
// vorraDedupePlugin — resolveId hook
// ---------------------------------------------------------------------------

describe('vorraDedupePlugin.resolveId()', () => {
  const resolveId = vorraDedupePlugin.resolveId as (id: string) => unknown;

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
