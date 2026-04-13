// =============================================================================
// @vorra/cli — Test Suite (Vitest)
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineConfig } from '../src/index.js';

// ---------------------------------------------------------------------------
// defineConfig()
// ---------------------------------------------------------------------------

describe('defineConfig()', () => {
  it('returns the config object unchanged', () => {
    const config = { entry: 'src/main.ts', outDir: 'dist', port: 3000 };
    expect(defineConfig(config)).toBe(config);
  });

  it('accepts a partial config', () => {
    const config = defineConfig({ port: 4000 });
    expect(config.port).toBe(4000);
    expect(config.entry).toBeUndefined();
    expect(config.outDir).toBeUndefined();
  });

  it('accepts an empty config', () => {
    const config = defineConfig({});
    expect(config).toEqual({});
  });

  it('preserves extra plugins array', () => {
    const plugin = { name: 'my-plugin' };
    const config = defineConfig({ plugins: [plugin] });
    expect(config.plugins).toEqual([plugin]);
  });
});

// ---------------------------------------------------------------------------
// runNew() — validation logic
// ---------------------------------------------------------------------------

describe('runNew()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits with error when no project name is given', async () => {
    const { runNew } = await import('../src/commands/new.js');
    runNew([]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: forge new'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with error for invalid project name (uppercase)', async () => {
    const { runNew } = await import('../src/commands/new.js');
    runNew(['MyApp']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('lowercase'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with error for invalid project name (starts with digit)', async () => {
    const { runNew } = await import('../src/commands/new.js');
    runNew(['1app']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('lowercase'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with error for invalid project name (contains spaces)', async () => {
    const { runNew } = await import('../src/commands/new.js');
    runNew(['my app']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('lowercase'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
