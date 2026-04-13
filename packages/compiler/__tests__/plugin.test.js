import { describe, it, expect } from 'vitest';
import { vorraPlugin } from '../src/plugin.js';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function transform(code, id) {
    const plugin = vorraPlugin();
    return plugin.transform(code, id);
}
const SIMPLE_FORGE = `
<script>
import { signal } from '@vorra/core';
const count = signal(0);
</script>
<template>
  <div>{count()}</div>
</template>
`.trim();
// ---------------------------------------------------------------------------
// Plugin identity
// ---------------------------------------------------------------------------
describe('vorraPlugin() — identity', () => {
    it('returns a plugin object with name "vorra"', () => {
        const plugin = vorraPlugin();
        expect(plugin.name).toBe('vorra');
    });
    it('exposes a transform function', () => {
        const plugin = vorraPlugin();
        expect(typeof plugin.transform).toBe('function');
    });
    it('exposes a resolveId function', () => {
        const plugin = vorraPlugin();
        expect(typeof plugin.resolveId).toBe('function');
    });
    it('exposes a load function', () => {
        const plugin = vorraPlugin();
        expect(typeof plugin.load).toBe('function');
    });
});
// ---------------------------------------------------------------------------
// File filtering
// ---------------------------------------------------------------------------
describe('vorraPlugin() — file filtering', () => {
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
    it('processes .vorra files', () => {
        expect(transform(SIMPLE_FORGE, 'src/Counter.vorra')).not.toBeNull();
    });
    it('processes .vorra files regardless of directory depth', () => {
        const result = transform(SIMPLE_FORGE, 'src/components/deep/Foo.vorra');
        expect(result).not.toBeNull();
    });
});
// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------
describe('vorraPlugin() — output shape', () => {
    it('returns an object with a code property', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.vorra');
        expect(result).toMatchObject({ code: expect.any(String) });
    });
    it('does not include a map property when no source map is produced', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.vorra');
        // compileSFC currently never produces a map — the key should be absent.
        expect(result).not.toHaveProperty('map');
    });
    it('generated code is a non-empty string', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.vorra');
        expect(result.code.length).toBeGreaterThan(0);
    });
});
// ---------------------------------------------------------------------------
// Generated code correctness
// ---------------------------------------------------------------------------
describe('vorraPlugin() — generated code', () => {
    it('emits the compiled header comment with the filename', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.vorra');
        expect(result.code).toContain('// Vorra compiled component: src/Counter.vorra');
    });
    it('emits an import from @vorra/core/dom for used DOM functions', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.vorra');
        expect(result.code).toContain("from '@vorra/core/dom'");
    });
    it('hoists import statements from the <script> block to module scope', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.vorra');
        // The signal import should appear before the factory function.
        const importIdx = result.code.indexOf("import { signal } from '@vorra/core'");
        const factoryIdx = result.code.indexOf('export default function');
        expect(importIdx).toBeGreaterThan(-1);
        expect(factoryIdx).toBeGreaterThan(-1);
        expect(importIdx).toBeLessThan(factoryIdx);
    });
    it('exports a default factory function', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.vorra');
        expect(result.code).toContain('export default function(ctx, props = {})');
    });
    it('emits createElement for the root element', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.vorra');
        expect(result.code).toContain("createElement('div')");
    });
    it('emits bindText for an interpolation', () => {
        const result = transform(SIMPLE_FORGE, 'src/Counter.vorra');
        expect(result.code).toContain('bindText(');
    });
    it('handles static attributes', () => {
        const src = `
<template>
  <button class="btn" type="button">Click</button>
</template>`.trim();
        const result = transform(src, 'Btn.vorra');
        expect(result.code).toContain("setAttr(_e0, 'class', 'btn')");
        expect(result.code).toContain("setAttr(_e0, 'type', 'button')");
    });
    it('handles reactive attribute binding (:attr)', () => {
        const src = `
<template>
  <a :href={url()}>link</a>
</template>`.trim();
        const result = transform(src, 'Link.vorra');
        expect(result.code).toContain("bindAttr(");
        expect(result.code).toContain("'href'");
    });
    it('handles event listeners (@event)', () => {
        const src = `
<template>
  <button @click={handleClick}>go</button>
</template>`.trim();
        const result = transform(src, 'Btn.vorra');
        expect(result.code).toContain("listen(");
        expect(result.code).toContain("'click'");
    });
    it('handles :show directive', () => {
        const src = `
<template>
  <span :show={visible()}>hi</span>
</template>`.trim();
        const result = transform(src, 'Span.vorra');
        expect(result.code).toContain('bindShow(');
    });
    it('handles class: directives', () => {
        const src = `
<template>
  <div class:active={isActive()}>x</div>
</template>`.trim();
        const result = transform(src, 'Div.vorra');
        expect(result.code).toContain('bindClass(');
        expect(result.code).toContain("'active'");
    });
    it('handles .prop directive', () => {
        const src = `
<template>
  <input .value={text()} />
</template>`.trim();
        const result = transform(src, 'Input.vorra');
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
describe('vorraPlugin() — CSS style blocks', () => {
    it('inlines CSS injection code into the transform result for .vorra files with a <style> block', () => {
        const plugin = vorraPlugin();
        const result = plugin.transform(FORGE_WITH_CSS, 'src/Box.vorra');
        // Styles are inlined directly — no virtual import generated.
        expect(result.code).not.toContain('vorra-style');
        expect(result.code).toContain('document.createElement');
    });
    it('does NOT inject any CSS when there are no <style> blocks', () => {
        const plugin = vorraPlugin();
        const result = plugin.transform(SIMPLE_FORGE, 'src/Counter.vorra');
        expect(result.code).not.toContain('vorra-style');
        expect(result.code).not.toContain('document.createElement(\'style\')');
    });
    it('inlined code contains the raw CSS', () => {
        const plugin = vorraPlugin();
        const result = plugin.transform(FORGE_WITH_CSS, 'src/Box.vorra');
        expect(result.code).toContain('color: red');
    });
    it('inlined code guards against SSR with typeof document check', () => {
        const plugin = vorraPlugin();
        const result = plugin.transform(FORGE_WITH_CSS, 'src/Box.vorra');
        expect(result.code).toContain('typeof document');
    });
    it('scoped styles add attribute selector to CSS rules in the inlined code', () => {
        const plugin = vorraPlugin();
        const result = plugin.transform(FORGE_WITH_SCOPED_CSS, 'src/Scoped.vorra');
        expect(result.code).toMatch(/\[data-v-vorra-[0-9a-f]+\]/);
    });
    it('scoped transform stamps data-v attribute on template elements', () => {
        const plugin = vorraPlugin();
        const result = plugin.transform(FORGE_WITH_SCOPED_CSS, 'src/Scoped.vorra');
        expect(result.code).toMatch(/data-v-vorra-[0-9a-f]+/);
    });
    it('unscoped styles do NOT add attribute selectors', () => {
        const plugin = vorraPlugin();
        const result = plugin.transform(FORGE_WITH_CSS, 'src/Box.vorra');
        expect(result.code).not.toMatch(/\[data-v-/);
    });
    it('resolveId claims virtual style IDs (used for standalone .scss files)', () => {
        const plugin = vorraPlugin();
        const id = '\0vorra-style:src/Box.vorra';
        expect(plugin.resolveId(id)).toBe(id);
    });
    it('resolveId returns null for non-virtual IDs', () => {
        const plugin = vorraPlugin();
        expect(plugin.resolveId('src/main.ts')).toBeNull();
        expect(plugin.resolveId('./styles.css')).toBeNull();
    });
    it('load returns null for unknown IDs', () => {
        const plugin = vorraPlugin();
        expect(plugin.load('src/main.ts')).toBeNull();
    });
    it('load returns empty code for a virtual style ID (styles are now inlined, not stored)', () => {
        const plugin = vorraPlugin();
        plugin.transform(FORGE_WITH_CSS, 'src/Box.vorra');
        // The virtualStyles map is no longer populated for .vorra files.
        const mod = plugin.load('\0vorra-style:src/Box.vorra');
        expect(mod.code).toBe('');
    });
});
// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('vorraPlugin() — error handling', () => {
    it('throws when <template> has no root element', () => {
        const src = '<template>   </template>';
        expect(() => transform(src, 'Empty.vorra')).toThrow('[Forge Plugin]');
        expect(() => transform(src, 'Empty.vorra')).toThrow('Compilation failed');
    });
    it('throws when <script> block is unclosed', () => {
        const src = '<script>const x = 1;';
        expect(() => transform(src, 'Bad.vorra')).toThrow('[Vorra Parser]');
    });
    it('error message includes the filename', () => {
        const src = '<template></template>'; // no root element
        try {
            transform(src, 'src/Broken.vorra');
            expect.fail('should have thrown');
        }
        catch (err) {
            expect(err.message).toContain('src/Broken.vorra');
        }
    });
    it('does not throw for a warning-only case (no template)', () => {
        const src = '<script>export const x = 1;</script>';
        // Missing template produces a warning, not an error — should not throw.
        expect(() => transform(src, 'NoTemplate.vorra')).not.toThrow();
    });
});
//# sourceMappingURL=plugin.test.js.map