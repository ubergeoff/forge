import { describe, it, expect } from 'vitest';
import { parseSFC } from '../src/parser.js';
import type { SFCDescriptor } from '../src/parser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function src(...lines: string[]): string {
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseSFC — basic block detection', () => {
  it('returns null script and template when source is empty', () => {
    const d = parseSFC('', 'empty.forge');
    expect(d.script).toBeNull();
    expect(d.template).toBeNull();
    expect(d.styles).toHaveLength(0);
    expect(d.filename).toBe('empty.forge');
  });

  it('parses a file with all three block types', () => {
    const source = src(
      '<script>',
      "const x = 1;",
      '</script>',
      '<template>',
      '  <div>hello</div>',
      '</template>',
      '<style>',
      '  div { color: red; }',
      '</style>',
    );
    const d = parseSFC(source, 'all.forge');
    expect(d.script).not.toBeNull();
    expect(d.template).not.toBeNull();
    expect(d.styles).toHaveLength(1);
  });

  it('parses a file with only a script block', () => {
    const source = '<script>\nconst a = 1;\n</script>';
    const d = parseSFC(source, 'only-script.forge');
    expect(d.script).not.toBeNull();
    expect(d.template).toBeNull();
    expect(d.styles).toHaveLength(0);
  });

  it('parses a file with only a template block', () => {
    const source = '<template>\n<div />\n</template>';
    const d = parseSFC(source, 'only-template.forge');
    expect(d.script).toBeNull();
    expect(d.template).not.toBeNull();
  });

  it('stores the filename on the descriptor', () => {
    const d = parseSFC('<template></template>', 'src/app.forge');
    expect(d.filename).toBe('src/app.forge');
  });
});

describe('parseSFC — content extraction', () => {
  it('extracts script content verbatim', () => {
    const inner = "\nimport { signal } from '@forge/core';\nexport const count = signal(0);\n";
    const d = parseSFC(`<script>${inner}</script>`, 'x.forge');
    expect(d.script?.content).toBe(inner);
  });

  it('extracts template content verbatim including inner tags', () => {
    const inner = '\n  <div class="app"><span>{count()}</span></div>\n';
    const d = parseSFC(`<template>${inner}</template>`, 'x.forge');
    expect(d.template?.content).toBe(inner);
  });

  it('extracts style content verbatim', () => {
    const inner = '\n  .app { display: flex; }\n';
    const d = parseSFC(`<style>${inner}</style>`, 'x.forge');
    expect(d.styles[0]?.content).toBe(inner);
  });

  it('handles multiline blocks with blank lines', () => {
    const source = src(
      '<script>',
      '',
      'const x = 1;',
      '',
      'const y = 2;',
      '</script>',
    );
    const d = parseSFC(source, 'x.forge');
    expect(d.script?.content).toContain('const x = 1;');
    expect(d.script?.content).toContain('const y = 2;');
  });
});

describe('parseSFC — source positions', () => {
  it('records start as the index after the opening tag', () => {
    const source = '<script>const x = 1;</script>';
    const d = parseSFC(source, 'x.forge');
    expect(d.script?.start).toBe('<script>'.length);
  });

  it('records end as the index of the closing tag', () => {
    const source = '<script>const x = 1;</script>';
    const inner = 'const x = 1;';
    const d = parseSFC(source, 'x.forge');
    expect(d.script?.end).toBe('<script>'.length + inner.length);
  });

  it('start/end span the exact content slice', () => {
    const inner = '\nimport { x } from "./x.js";\n';
    const source = `<script>${inner}</script>`;
    const d = parseSFC(source, 'x.forge');
    const { start, end } = d.script!;
    expect(source.slice(start, end)).toBe(inner);
  });

  it('positions are correct with blocks in order: template then script', () => {
    const source = '<template><p>hi</p></template><script>const x=1;</script>';
    const d = parseSFC(source, 'x.forge');
    // template block starts right after '<template>'
    expect(d.template?.start).toBe('<template>'.length);
    // script block starts after entire template block + '<script>'
    const afterTemplate = '<template><p>hi</p></template>'.length;
    expect(d.script?.start).toBe(afterTemplate + '<script>'.length);
  });
});

describe('parseSFC — attribute parsing', () => {
  it('parses double-quoted attributes', () => {
    const d = parseSFC('<script lang="ts"></script>', 'x.forge');
    expect(d.script?.attrs).toEqual({ lang: 'ts' });
  });

  it('parses single-quoted attributes', () => {
    const d = parseSFC("<script lang='ts'></script>", 'x.forge');
    expect(d.script?.attrs).toEqual({ lang: 'ts' });
  });

  it('parses boolean (value-less) attributes', () => {
    const d = parseSFC('<style scoped></style>', 'x.forge');
    expect(d.styles[0]?.attrs).toEqual({ scoped: true });
  });

  it('parses multiple attributes', () => {
    const d = parseSFC('<style lang="scss" scoped></style>', 'x.forge');
    expect(d.styles[0]?.attrs).toEqual({ lang: 'scss', scoped: true });
  });

  it('returns empty attrs object when no attributes present', () => {
    const d = parseSFC('<template></template>', 'x.forge');
    expect(d.template?.attrs).toEqual({});
  });

  it('records the block type correctly', () => {
    const source = '<script lang="ts"></script><template></template><style scoped></style>';
    const d = parseSFC(source, 'x.forge');
    expect(d.script?.type).toBe('script');
    expect(d.template?.type).toBe('template');
    expect(d.styles[0]?.type).toBe('style');
  });
});

describe('parseSFC — multiple style blocks', () => {
  it('collects all style blocks in order', () => {
    const source = src(
      '<style>.a { color: red; }</style>',
      '<style scoped>.b { color: blue; }</style>',
    );
    const d = parseSFC(source, 'x.forge');
    expect(d.styles).toHaveLength(2);
    expect(d.styles[0]?.content).toContain('.a');
    expect(d.styles[1]?.content).toContain('.b');
    expect(d.styles[1]?.attrs).toEqual({ scoped: true });
  });
});

describe('parseSFC — block ordering independence', () => {
  it('handles template before script', () => {
    const source = '<template><p /></template><script>const x=1;</script>';
    const d = parseSFC(source, 'x.forge');
    expect(d.script).not.toBeNull();
    expect(d.template).not.toBeNull();
  });

  it('handles style before template before script', () => {
    const source = '<style>.x{}</style><template><p/></template><script>const x=1;</script>';
    const d = parseSFC(source, 'x.forge');
    expect(d.script).not.toBeNull();
    expect(d.template).not.toBeNull();
    expect(d.styles).toHaveLength(1);
  });
});

describe('parseSFC — template with HTML tags', () => {
  it('does not confuse inner div tags for block boundaries', () => {
    const inner = '\n  <div><span>text</span></div>\n';
    const source = `<template>${inner}</template>`;
    const d = parseSFC(source, 'x.forge');
    expect(d.template?.content).toBe(inner);
  });

  it('handles deeply nested HTML inside template', () => {
    const source = '<template><ul><li><a href="#">link</a></li></ul></template>';
    const d = parseSFC(source, 'x.forge');
    expect(d.template?.content).toBe('<ul><li><a href="#">link</a></li></ul>');
  });
});

describe('parseSFC — error handling', () => {
  it('throws a descriptive error for an unclosed script block', () => {
    expect(() => parseSFC('<script>const x = 1;', 'bad.forge')).toThrow(
      '[Forge Parser]',
    );
    expect(() => parseSFC('<script>const x = 1;', 'bad.forge')).toThrow(
      'bad.forge',
    );
  });

  it('throws for an unclosed template block', () => {
    expect(() => parseSFC('<template><div>', 'bad.forge')).toThrow(
      /Unclosed <template>/,
    );
  });

  it('throws for an unclosed style block', () => {
    expect(() => parseSFC('<style>.a{}', 'bad.forge')).toThrow(
      /Unclosed <style>/,
    );
  });
});

describe('parseSFC — real-world fixture', () => {
  it('parses a realistic counter component', () => {
    const source = src(
      '<script lang="ts">',
      "  import { signal } from '@forge/core';",
      '  const count = signal(0);',
      "  function increment() { count.update(n => n + 1); }",
      '</script>',
      '',
      '<template>',
      '  <div class="counter">',
      '    <button @click="increment">+</button>',
      '    <span>{count()}</span>',
      '  </div>',
      '</template>',
      '',
      '<style scoped>',
      '  .counter { display: flex; gap: 8px; }',
      '</style>',
    );

    const d: SFCDescriptor = parseSFC(source, 'counter.forge');

    expect(d.filename).toBe('counter.forge');
    expect(d.script?.attrs).toEqual({ lang: 'ts' });
    expect(d.script?.content).toContain("import { signal }");
    expect(d.template?.content).toContain('{count()}');
    expect(d.styles).toHaveLength(1);
    expect(d.styles[0]?.attrs).toEqual({ scoped: true });
    expect(d.styles[0]?.content).toContain('display: flex');
  });
});
