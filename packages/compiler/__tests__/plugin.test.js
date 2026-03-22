import { describe, it, expect } from 'vitest';
import { forgePlugin } from '../src/plugin.js';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function transform(code, id) {
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
    it('returns null for .ts files', () => {
        expect(transform('export const x = 1;', 'src/main.ts')).toBeNull();
    });
    it('returns null for .js files', () => {
        expect(transform('export const x = 1;', 'src/utils.js')).toBeNull();
    });
    it('returns null for .vue files', () => {
        expect(transform('<template><div/></template>', 'src/App.vue')).toBeNull();
    });
    it('returns null for .svelte files', () => {
        expect(transform('<div/>', 'src/App.svelte')).toBeNull();
    });
    it('processes .forge files', () => {
        expect(transform(SIMPLE_FORGE, 'src/Counter.forge')).not.toBeNull();
    });
    it('processes .forge files regardless of directory depth', () => {
        const result = transform(SIMPLE_FORGE, 'src/components/deep/Foo.forge');
        expect(result).not.toBeNull();
    });
});
// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------
describe('forgePlugin() — output shape', () => {
    it('returns an object with a code property', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.forge');
        expect(result).toMatchObject({ code: expect.any(String) });
    });
    it('does not include a map property when no source map is produced', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.forge');
        // compileSFC currently never produces a map — the key should be absent.
        expect(result).not.toHaveProperty('map');
    });
    it('generated code is a non-empty string', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.forge');
        expect(result.code.length).toBeGreaterThan(0);
    });
});
// ---------------------------------------------------------------------------
// Generated code correctness
// ---------------------------------------------------------------------------
describe('forgePlugin() — generated code', () => {
    it('emits the compiled header comment with the filename', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.forge');
        expect(result.code).toContain('// Forge compiled component: src/Counter.forge');
    });
    it('emits an import from @forge/core/dom for used DOM functions', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.forge');
        expect(result.code).toContain("from '@forge/core/dom'");
    });
    it('hoists import statements from the <script> block to module scope', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.forge');
        // The signal import should appear before the factory function.
        const importIdx = result.code.indexOf("import { signal } from '@forge/core'");
        const factoryIdx = result.code.indexOf('export default function');
        expect(importIdx).toBeGreaterThan(-1);
        expect(factoryIdx).toBeGreaterThan(-1);
        expect(importIdx).toBeLessThan(factoryIdx);
    });
    it('exports a default factory function', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.forge');
        expect(result.code).toContain('export default function(ctx, props = {})');
    });
    it('emits createElement for the root element', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.forge');
        expect(result.code).toContain("createElement('div')");
    });
    it('emits bindText for an interpolation', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.forge');
        expect(result.code).toContain('bindText(');
    });
    it('handles static attributes', () => {
        const src = `
<template>
  <button class="btn" type="button">Click</button>
</template>`.trim();
        const result = transform(src, 'Btn.forge');
        expect(result.code).toContain("setAttr(_e0, 'class', 'btn')");
        expect(result.code).toContain("setAttr(_e0, 'type', 'button')");
    });
    it('handles reactive attribute binding (:attr)', () => {
        const src = `
<template>
  <a :href={url()}>link</a>
</template>`.trim();
        const result = transform(src, 'Link.forge');
        expect(result.code).toContain("bindAttr(");
        expect(result.code).toContain("'href'");
    });
    it('handles event listeners (@event)', () => {
        const src = `
<template>
  <button @click={handleClick}>go</button>
</template>`.trim();
        const result = transform(src, 'Btn.forge');
        expect(result.code).toContain("listen(");
        expect(result.code).toContain("'click'");
    });
    it('handles :show directive', () => {
        const src = `
<template>
  <span :show={visible()}>hi</span>
</template>`.trim();
        const result = transform(src, 'Span.forge');
        expect(result.code).toContain('bindShow(');
    });
    it('handles class: directives', () => {
        const src = `
<template>
  <div class:active={isActive()}>x</div>
</template>`.trim();
        const result = transform(src, 'Div.forge');
        expect(result.code).toContain('bindClass(');
        expect(result.code).toContain("'active'");
    });
    it('handles .prop directive', () => {
        const src = `
<template>
  <input .value={text()} />
</template>`.trim();
        const result = transform(src, 'Input.forge');
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
    it('inlines CSS injection code into the transform result for .forge files with a <style> block', () => {
        const plugin = forgePlugin();
        const result = plugin.transform(FORGE_WITH_CSS, 'src/Box.forge');
        // Styles are inlined directly — no virtual import generated.
        expect(result.code).not.toContain('forge-style');
        expect(result.code).toContain('document.createElement');
    });
    it('does NOT inject any CSS when there are no <style> blocks', () => {
        const plugin = forgePlugin();
        const result = plugin.transform(SIMPLE_FORGE, 'src/Counter.forge');
        expect(result.code).not.toContain('forge-style');
        expect(result.code).not.toContain('document.createElement(\'style\')');
    });
    it('inlined code contains the raw CSS', () => {
        const plugin = forgePlugin();
        const result = plugin.transform(FORGE_WITH_CSS, 'src/Box.forge');
        expect(result.code).toContain('color: red');
    });
    it('inlined code guards against SSR with typeof document check', () => {
        const plugin = forgePlugin();
        const result = plugin.transform(FORGE_WITH_CSS, 'src/Box.forge');
        expect(result.code).toContain('typeof document');
    });
    it('scoped styles add attribute selector to CSS rules in the inlined code', () => {
        const plugin = forgePlugin();
        const result = plugin.transform(FORGE_WITH_SCOPED_CSS, 'src/Scoped.forge');
        expect(result.code).toMatch(/\[data-v-forge-[0-9a-f]+\]/);
    });
    it('scoped transform stamps data-v attribute on template elements', () => {
        const plugin = forgePlugin();
        const result = plugin.transform(FORGE_WITH_SCOPED_CSS, 'src/Scoped.forge');
        expect(result.code).toMatch(/data-v-forge-[0-9a-f]+/);
    });
    it('unscoped styles do NOT add attribute selectors', () => {
        const plugin = forgePlugin();
        const result = plugin.transform(FORGE_WITH_CSS, 'src/Box.forge');
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
    it('load returns null for unknown IDs', () => {
        const plugin = forgePlugin();
        expect(plugin.load('src/main.ts')).toBeNull();
    });
    it('load returns empty code for a virtual style ID (styles are now inlined, not stored)', () => {
        const plugin = forgePlugin();
        plugin.transform(FORGE_WITH_CSS, 'src/Box.forge');
        // The virtualStyles map is no longer populated for .forge files.
        const mod = plugin.load('\0forge-style:src/Box.forge');
        expect(mod.code).toBe('');
    });
});
// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('forgePlugin() — error handling', () => {
    it('throws when <template> has no root element', () => {
        const src = '<template>   </template>';
        expect(() => transform(src, 'Empty.forge')).toThrow('[Forge Plugin]');
        expect(() => transform(src, 'Empty.forge')).toThrow('Compilation failed');
    });
    it('throws when <script> block is unclosed', () => {
        const src = '<script>const x = 1;';
        expect(() => transform(src, 'Bad.forge')).toThrow('[Forge Parser]');
    });
    it('error message includes the filename', () => {
        const src = '<template></template>'; // no root element
        try {
            transform(src, 'src/Broken.forge');
            expect.fail('should have thrown');
        }
        catch (err) {
            expect(err.message).toContain('src/Broken.forge');
        }
    });
    it('does not throw for a warning-only case (no template)', () => {
        const src = '<script>export const x = 1;</script>';
        // Missing template produces a warning, not an error — should not throw.
        expect(() => transform(src, 'NoTemplate.forge')).not.toThrow();
    });
});
//# sourceMappingURL=plugin.test.js.map