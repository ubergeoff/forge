import { describe, it, expect } from 'vitest';
import { forgePlugin } from '../src/plugin.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function transform(code: string, id: string) {
  const plugin = forgePlugin();
  return plugin.transform(code, id);
}

const SIMPLE_FORGE = `
<script>
import { signal } from '@forge/core';
const count = signal(0);
</script>
<template>
  <div>{count()}</div>
</template>
`.trim();

// ---------------------------------------------------------------------------
// Plugin identity
// ---------------------------------------------------------------------------

describe('forgePlugin() — identity', () => {
  it('returns a plugin object with name "forge"', () => {
    const plugin = forgePlugin();
    expect(plugin.name).toBe('forge');
  });

  it('exposes a transform function', () => {
    const plugin = forgePlugin();
    expect(typeof plugin.transform).toBe('function');
  });

  it('exposes a resolveId function', () => {
    const plugin = forgePlugin();
    expect(typeof plugin.resolveId).toBe('function');
  });

  it('exposes a load function', () => {
    const plugin = forgePlugin();
    expect(typeof plugin.load).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// File filtering
// ---------------------------------------------------------------------------

describe('forgePlugin() — file filtering', () => {
  it('returns null for .ts files', async () => {
    expect(await transform('export const x = 1;', 'src/main.ts')).toBeNull();
  });

  it('returns null for .js files', async () => {
    expect(await transform('export const x = 1;', 'src/utils.js')).toBeNull();
  });

  it('returns null for .vue files', async () => {
    expect(await transform('<template><div/></template>', 'src/App.vue')).toBeNull();
  });

  it('returns null for .svelte files', async () => {
    expect(await transform('<div/>', 'src/App.svelte')).toBeNull();
  });

  it('processes .forge files', async () => {
    expect(await transform(SIMPLE_FORGE, 'src/Counter.forge')).not.toBeNull();
  });

  it('processes .forge files regardless of directory depth', async () => {
    const result = await transform(SIMPLE_FORGE, 'src/components/deep/Foo.forge');
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

describe('forgePlugin() — output shape', () => {
  it('returns an object with a code property', async () => {
    const result = await transform(SIMPLE_FORGE, 'src/Counter.forge');
    expect(result).toMatchObject({ code: expect.any(String) });
  });

  it('does not include a map property when no source map is produced', async () => {
    const result = await transform(SIMPLE_FORGE, 'src/Counter.forge');
    // compileSFC currently never produces a map — the key should be absent.
    expect(result).not.toHaveProperty('map');
  });

  it('generated code is a non-empty string', async () => {
    const result = await transform(SIMPLE_FORGE, 'src/Counter.forge');
    expect((result as { code: string }).code.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Generated code correctness
// ---------------------------------------------------------------------------

describe('forgePlugin() — generated code', () => {
  it('emits the compiled header comment with the filename', async () => {
    const result = await transform(SIMPLE_FORGE, 'src/Counter.forge') as { code: string };
    expect(result.code).toContain('// Forge compiled component: src/Counter.forge');
  });

  it('emits an import from @forge/core/dom for used DOM functions', async () => {
    const result = await transform(SIMPLE_FORGE, 'src/Counter.forge') as { code: string };
    expect(result.code).toContain("from '@forge/core/dom'");
  });

  it('hoists import statements from the <script> block to module scope', async () => {
    const result = await transform(SIMPLE_FORGE, 'src/Counter.forge') as { code: string };
    // The signal import should appear before the factory function.
    const importIdx = result.code.indexOf("import { signal } from '@forge/core'");
    const factoryIdx = result.code.indexOf('export default function');
    expect(importIdx).toBeGreaterThan(-1);
    expect(factoryIdx).toBeGreaterThan(-1);
    expect(importIdx).toBeLessThan(factoryIdx);
  });

  it('exports a default factory function', async () => {
    const result = await transform(SIMPLE_FORGE, 'src/Counter.forge') as { code: string };
    expect(result.code).toContain('export default function(ctx, props = {})');
  });

  it('emits createElement for the root element', async () => {
    const result = await transform(SIMPLE_FORGE, 'src/Counter.forge') as { code: string };
    expect(result.code).toContain("createElement('div')");
  });

  it('emits bindText for an interpolation', async () => {
    const result = await transform(SIMPLE_FORGE, 'src/Counter.forge') as { code: string };
    expect(result.code).toContain('bindText(');
  });

  it('handles static attributes', async () => {
    const src = `
<template>
  <button class="btn" type="button">Click</button>
</template>`.trim();
    const result = await transform(src, 'Btn.forge') as { code: string };
    expect(result.code).toContain("setAttr(_e0, 'class', 'btn')");
    expect(result.code).toContain("setAttr(_e0, 'type', 'button')");
  });

  it('handles reactive attribute binding (:attr)', async () => {
    const src = `
<template>
  <a :href={url()}>link</a>
</template>`.trim();
    const result = await transform(src, 'Link.forge') as { code: string };
    expect(result.code).toContain("bindAttr(");
    expect(result.code).toContain("'href'");
  });

  it('handles event listeners (@event)', async () => {
    const src = `
<template>
  <button @click={handleClick}>go</button>
</template>`.trim();
    const result = await transform(src, 'Btn.forge') as { code: string };
    expect(result.code).toContain("listen(");
    expect(result.code).toContain("'click'");
  });

  it('handles :show directive', async () => {
    const src = `
<template>
  <span :show={visible()}>hi</span>
</template>`.trim();
    const result = await transform(src, 'Span.forge') as { code: string };
    expect(result.code).toContain('bindShow(');
  });

  it('handles class: directives', async () => {
    const src = `
<template>
  <div class:active={isActive()}>x</div>
</template>`.trim();
    const result = await transform(src, 'Div.forge') as { code: string };
    expect(result.code).toContain('bindClass(');
    expect(result.code).toContain("'active'");
  });

  it('handles .prop directive', async () => {
    const src = `
<template>
  <input .value={text()} />
</template>`.trim();
    const result = await transform(src, 'Input.forge') as { code: string };
    expect(result.code).toContain('bindProp(');
    expect(result.code).toContain("'value'");
  });
});

// ---------------------------------------------------------------------------
// CSS style blocks
// ---------------------------------------------------------------------------

const FORGE_WITH_CSS = `
<template>
  <div class="box">hello</div>
</template>
<style>
.box { color: red; }
</style>
`.trim();

const FORGE_WITH_SCOPED_CSS = `
<template>
  <div class="box">hello</div>
</template>
<style scoped>
.box { color: blue; }
</style>
`.trim();

describe('forgePlugin() — CSS style blocks', () => {
  it('inlines CSS injection code into the transform result for .forge files with a <style> block', async () => {
    const plugin = forgePlugin();
    const result = await plugin.transform(FORGE_WITH_CSS, 'src/Box.forge') as { code: string };
    // Styles are inlined directly — no virtual import generated.
    expect(result.code).not.toContain('forge-style');
    expect(result.code).toContain('document.createElement');
  });

  it('does NOT inject any CSS when there are no <style> blocks', async () => {
    const plugin = forgePlugin();
    const result = await plugin.transform(SIMPLE_FORGE, 'src/Counter.forge') as { code: string };
    expect(result.code).not.toContain('forge-style');
    expect(result.code).not.toContain('document.createElement(\'style\')');
  });

  it('inlined code contains the raw CSS', async () => {
    const plugin = forgePlugin();
    const result = await plugin.transform(FORGE_WITH_CSS, 'src/Box.forge') as { code: string };
    expect(result.code).toContain('color: red');
  });

  it('inlined code guards against SSR with typeof document check', async () => {
    const plugin = forgePlugin();
    const result = await plugin.transform(FORGE_WITH_CSS, 'src/Box.forge') as { code: string };
    expect(result.code).toContain('typeof document');
  });

  it('scoped styles add attribute selector to CSS rules in the inlined code', async () => {
    const plugin = forgePlugin();
    const result = await plugin.transform(FORGE_WITH_SCOPED_CSS, 'src/Scoped.forge') as { code: string };
    expect(result.code).toMatch(/\[data-v-forge-[0-9a-f]+\]/);
  });

  it('scoped transform stamps data-v attribute on template elements', async () => {
    const plugin = forgePlugin();
    const result = await plugin.transform(FORGE_WITH_SCOPED_CSS, 'src/Scoped.forge') as { code: string };
    expect(result.code).toMatch(/data-v-forge-[0-9a-f]+/);
  });

  it('unscoped styles do NOT add attribute selectors', async () => {
    const plugin = forgePlugin();
    const result = await plugin.transform(FORGE_WITH_CSS, 'src/Box.forge') as { code: string };
    expect(result.code).not.toMatch(/\[data-v-/);
  });

  it('resolveId claims virtual style IDs (used for standalone .scss files)', () => {
    const plugin = forgePlugin();
    const id = '\0forge-style:src/Box.forge';
    expect(plugin.resolveId(id)).toBe(id);
  });

  it('resolveId returns null for non-virtual IDs', () => {
    const plugin = forgePlugin();
    expect(plugin.resolveId('src/main.ts')).toBeNull();
    expect(plugin.resolveId('./styles.css')).toBeNull();
  });

  it('load returns null for unknown IDs', async () => {
    const plugin = forgePlugin();
    expect(await plugin.load('src/main.ts')).toBeNull();
  });

  it('load returns empty code for a virtual style ID (styles are now inlined, not stored)', async () => {
    const plugin = forgePlugin();
    await plugin.transform(FORGE_WITH_CSS, 'src/Box.forge');
    // The virtualStyles map is no longer populated for .forge files.
    const mod = await plugin.load('\0forge-style:src/Box.forge') as { code: string };
    expect(mod.code).toBe('');
  });
});

// ---------------------------------------------------------------------------
// .css file handling — new forge:css virtual module approach
// ---------------------------------------------------------------------------

describe('forgePlugin() — .css file handling', () => {
  it('returns null from transform for .css files (Rolldown handles them natively)', async () => {
    const plugin = forgePlugin();
    expect(await plugin.transform('.box { color: red; }', 'src/style.css')).toBeNull();
  });

  it('resolveId maps "forge:css" to the internal virtual ID', () => {
    const plugin = forgePlugin();
    expect(plugin.resolveId('forge:css')).toBe('\0forge:css');
  });

  it('load returns empty code for the CSS virtual module when no css option is set', async () => {
    const plugin = forgePlugin();
    const result = await plugin.load('\0forge:css') as { code: string };
    expect(result).not.toBeNull();
    expect(result.code).toBe('');
  });

  it('still returns null for non-.css, non-.forge files', async () => {
    const plugin = forgePlugin();
    expect(await plugin.transform('export {}', 'src/main.ts')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PostCSS integration
// ---------------------------------------------------------------------------

describe('forgePlugin({ postcss }) — PostCSS integration', () => {
  it('accepts a postcss option without throwing', () => {
    expect(() => forgePlugin({ postcss: { plugins: [] } })).not.toThrow();
  });

  it('does not transform .css files via transform (PostCSS is applied via forge:css virtual module)', async () => {
    const appendComment = {
      postcssPlugin: 'test-append',
      Once(root: { append: (node: object) => void }) {
        root.append({ text: 'processed by test' });
      },
    };
    const plugin = forgePlugin({ postcss: { plugins: [appendComment] } });
    // .css files are no longer handled by transform; Rolldown intercepts them.
    expect(await plugin.transform('.box { color: red; }', 'src/style.css')).toBeNull();
  });

  it('passes <style> block CSS through PostCSS before scoping', async () => {
    const appendComment = {
      postcssPlugin: 'test-append',
      Once(root: { append: (node: object) => void }) {
        root.append({ text: 'postcss-was-here' });
      },
    };
    const plugin = forgePlugin({ postcss: { plugins: [appendComment] } });
    const src = `
<template><div class="box">hi</div></template>
<style scoped>.box { color: red; }</style>
`.trim();
    const result = await plugin.transform(src, 'src/Box.forge') as { code: string };
    expect(result.code).toContain('postcss-was-here');
    // Scoping still applied after PostCSS.
    expect(result.code).toMatch(/\[data-v-forge-[0-9a-f]+\]/);
  });

  it('works without postcss option (default behaviour unchanged)', async () => {
    const plugin = forgePlugin();
    const result = await plugin.transform(FORGE_WITH_CSS, 'src/Box.forge') as { code: string };
    expect(result.code).toContain('color: red');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('forgePlugin() — error handling', () => {
  it('rejects when <template> has no root element', async () => {
    const src = '<template>   </template>';
    await expect(transform(src, 'Empty.forge')).rejects.toThrow('[Forge Plugin]');
    await expect(transform(src, 'Empty.forge')).rejects.toThrow('Compilation failed');
  });

  it('rejects when <script> block is unclosed', async () => {
    const src = '<script>const x = 1;';
    await expect(transform(src, 'Bad.forge')).rejects.toThrow('[Forge Parser]');
  });

  it('error message includes the filename', async () => {
    const src = '<template></template>'; // no root element
    await expect(transform(src, 'src/Broken.forge')).rejects.toThrow('src/Broken.forge');
  });

  it('does not reject for a warning-only case (no template)', async () => {
    const src = '<script>export const x = 1;</script>';
    // Missing template produces a warning, not an error — should not reject.
    await expect(transform(src, 'NoTemplate.forge')).resolves.not.toThrow();
  });
});
