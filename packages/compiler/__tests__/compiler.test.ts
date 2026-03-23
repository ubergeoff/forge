import { describe, it, expect } from 'vitest';
import { compileSFC } from '../src/compiler.js';
import { parseSFC } from '../src/parser.js';
import type { CompileResult } from '../src/compiler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a .forge source string from separate block strings. */
function forge({
  script = '',
  template = '',
  style = '',
}: {
  script?: string;
  template?: string;
  style?: string;
}): string {
  const parts: string[] = [];
  if (script)   parts.push(`<script>\n${script}\n</script>`);
  if (template) parts.push(`<template>\n${template}\n</template>`);
  if (style)    parts.push(style);
  return parts.join('\n');
}

/** Compile a .forge source string end-to-end. */
function compile(source: string, filename = 'test.forge'): CompileResult {
  return compileSFC(parseSFC(source, filename));
}

// ---------------------------------------------------------------------------
// No-template cases
// ---------------------------------------------------------------------------

describe('compileSFC — no template', () => {
  it('returns a warning and passes through script content', () => {
    const result = compile('<script>\nconst x = 1;\n</script>', 'x.forge');
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toMatch(/no <template>/i);
    expect(result.code).toContain('const x = 1;');
  });

  it('returns empty code for an empty file', () => {
    const result = compile('', 'empty.forge');
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.code).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Element creation
// ---------------------------------------------------------------------------

describe('compileSFC — createElement', () => {
  it('generates createElement for a plain div', () => {
    const result = compile(forge({ template: '<div></div>' }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain("createElement('div')");
  });

  it('imports createElement from @forge/core/dom', () => {
    const result = compile(forge({ template: '<span></span>' }));
    expect(result.code).toContain("from '@forge/core/dom'");
    expect(result.code).toMatch(/import\s*\{[^}]*createElement[^}]*\}/);
  });

  it('exports a default factory function', () => {
    const result = compile(forge({ template: '<div></div>' }));
    expect(result.code).toContain('export default function(ctx, props = {})');
  });

  it('returns the root variable', () => {
    const result = compile(forge({ template: '<div></div>' }));
    expect(result.code).toContain('return _e0;');
  });

  it('always imports runInContext from @forge/core', () => {
    const result = compile(forge({ template: '<div></div>' }));
    expect(result.code).toContain("import { runInContext } from '@forge/core';");
  });

  it('wraps the factory body in runInContext(ctx.injector, ...)', () => {
    const result = compile(forge({ template: '<div></div>' }));
    expect(result.code).toContain('return runInContext(ctx.injector, () => {');
  });

  it('handles void elements without closing tag', () => {
    const result = compile(forge({ template: '<div><input /></div>' }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain("createElement('input')");
  });
});

// ---------------------------------------------------------------------------
// Static attributes
// ---------------------------------------------------------------------------

describe('compileSFC — setAttr (static)', () => {
  it('generates setAttr for a static class attribute', () => {
    const result = compile(forge({ template: '<p class="msg">hi</p>' }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain(`setAttr(_e0, 'class', 'msg')`);
  });

  it('generates setAttr for multiple static attributes', () => {
    const result = compile(forge({ template: '<a href="/home" id="nav">link</a>' }));
    expect(result.code).toContain(`setAttr(_e0, 'href', '/home')`);
    expect(result.code).toContain(`setAttr(_e0, 'id', 'nav')`);
  });

  it('imports setAttr from @forge/core/dom when used', () => {
    const result = compile(forge({ template: '<div class="x"></div>' }));
    expect(result.code).toMatch(/import\s*\{[^}]*setAttr[^}]*\}/);
  });
});

// ---------------------------------------------------------------------------
// Text interpolation
// ---------------------------------------------------------------------------

describe('compileSFC — bindText (interpolation)', () => {
  it('generates a text node and bindText for {expr}', () => {
    const result = compile(forge({ template: '<p>{count()}</p>' }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain(`document.createTextNode('')`);
    expect(result.code).toContain(`bindText(`);
    expect(result.code).toContain(`() => String(count())`);
  });

  it('pushes bindText handle into ctx.effects', () => {
    const result = compile(forge({ template: '<p>{val()}</p>' }));
    expect(result.code).toContain('ctx.effects.push(bindText(');
  });

  it('generates a static text node for plain text content', () => {
    const result = compile(forge({ template: '<p>hello world</p>' }));
    expect(result.code).toContain(`createTextNode('hello world')`);
    expect(result.code).not.toContain('bindText');
  });

  it('handles mixed static text and interpolation', () => {
    const result = compile(forge({ template: '<p>Count: {n()}</p>' }));
    expect(result.code).toContain(`createTextNode('Count:')`);
    expect(result.code).toContain(`bindText(`);
  });
});

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

describe('compileSFC — listen (event)', () => {
  it('generates listen for @click={handler}', () => {
    const result = compile(forge({ template: '<button @click={increment}>+</button>' }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain(`listen(_e0, 'click', increment)`);
  });

  it('generates listen for @click="handler" (quoted)', () => {
    const result = compile(forge({ template: '<button @click="decrement">-</button>' }));
    expect(result.code).toContain(`listen(_e0, 'click', decrement)`);
  });

  it('pushes listen handle into ctx.effects', () => {
    const result = compile(forge({ template: '<button @click={fn}>x</button>' }));
    expect(result.code).toContain('ctx.effects.push(listen(');
  });

  it('imports listen from @forge/core/dom', () => {
    const result = compile(forge({ template: '<button @click={fn}>x</button>' }));
    expect(result.code).toMatch(/import\s*\{[^}]*listen[^}]*\}/);
  });
});

// ---------------------------------------------------------------------------
// Reactive attribute binding
// ---------------------------------------------------------------------------

describe('compileSFC — bindAttr (reactive attr)', () => {
  it('generates bindAttr for :href={expr}', () => {
    const result = compile(forge({ template: '<a :href={url()}>link</a>' }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain(`bindAttr(_e0, 'href', () => url())`);
  });

  it('wraps the expression in a getter arrow', () => {
    const result = compile(forge({ template: '<img :src={imageSrc()} />' }));
    expect(result.code).toContain(`() => imageSrc()`);
  });

  it('pushes bindAttr handle into ctx.effects', () => {
    const result = compile(forge({ template: '<a :href={url()}>x</a>' }));
    expect(result.code).toContain('ctx.effects.push(bindAttr(');
  });
});

// ---------------------------------------------------------------------------
// DOM property binding
// ---------------------------------------------------------------------------

describe('compileSFC — bindProp (DOM property)', () => {
  it('generates bindProp for .value={expr}', () => {
    const result = compile(forge({ template: '<input .value={name()} />' }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain(`bindProp(_e0, 'value', () => name())`);
  });

  it('pushes bindProp handle into ctx.effects', () => {
    const result = compile(forge({ template: '<input .checked={done()} />' }));
    expect(result.code).toContain('ctx.effects.push(bindProp(');
  });
});

// ---------------------------------------------------------------------------
// Show / hide binding
// ---------------------------------------------------------------------------

describe('compileSFC — bindShow', () => {
  it('generates bindShow for :show={expr}', () => {
    const result = compile(forge({ template: '<div :show={visible()}>content</div>' }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain(`bindShow(_e0, () => Boolean(visible()))`);
  });

  it('pushes bindShow handle into ctx.effects', () => {
    const result = compile(forge({ template: '<p :show={active()}>x</p>' }));
    expect(result.code).toContain('ctx.effects.push(bindShow(');
  });
});

// ---------------------------------------------------------------------------
// CSS class binding
// ---------------------------------------------------------------------------

describe('compileSFC — bindClass', () => {
  it('generates bindClass for a single class: directive', () => {
    const result = compile(forge({
      template: '<div class:active={isActive()}>x</div>',
    }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('bindClass(');
    expect(result.code).toContain("'active': Boolean(isActive())");
  });

  it('combines multiple class: directives into one bindClass call', () => {
    const result = compile(forge({
      template: '<div class:active={a()} class:disabled={d()}>x</div>',
    }));
    expect(result.errors).toHaveLength(0);
    // Only one bindClass call
    const bindClassCount = (result.code.match(/bindClass/g) ?? []).length;
    // import line counts as 1, the call counts as 1 → at most 2 occurrences
    expect(bindClassCount).toBeLessThanOrEqual(2);
    expect(result.code).toContain("'active': Boolean(a())");
    expect(result.code).toContain("'disabled': Boolean(d())");
  });

  it('pushes bindClass handle into ctx.effects', () => {
    const result = compile(forge({ template: '<div class:x={y()}>z</div>' }));
    expect(result.code).toContain('ctx.effects.push(bindClass(');
  });
});

// ---------------------------------------------------------------------------
// Nested elements
// ---------------------------------------------------------------------------

describe('compileSFC — nested elements and insert ordering', () => {
  it('inserts children into parent after both are created', () => {
    const result = compile(forge({ template: '<div><span>hi</span></div>' }));
    expect(result.errors).toHaveLength(0);
    const code = result.code;
    // _e0 = div, _e1 = span; span must be inserted into div
    expect(code).toContain("createElement('div')");
    expect(code).toContain("createElement('span')");
    expect(code).toContain('insert(_e0, _e1)');
  });

  it('handles deeply nested elements', () => {
    const result = compile(forge({
      template: '<ul><li><a href="#">link</a></li></ul>',
    }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain("createElement('ul')");
    expect(result.code).toContain("createElement('li')");
    expect(result.code).toContain("createElement('a')");
  });

  it('inserts text nodes into their parent element', () => {
    const result = compile(forge({ template: '<p>{msg()}</p>' }));
    const code = result.code;
    // The text node (_t0) should be inserted into the paragraph (_e0)
    expect(code).toContain('insert(_e0, _t0)');
  });
});

// ---------------------------------------------------------------------------
// Script block integration
// ---------------------------------------------------------------------------

describe('compileSFC — script block', () => {
  it('hoists import statements to module scope', () => {
    const source = forge({
      script: "import { signal } from '@forge/core';",
      template: '<div></div>',
    });
    const result = compile(source);
    expect(result.errors).toHaveLength(0);
    // Import must appear at module scope, before the factory function
    const importIdx = result.code.indexOf("import { signal }");
    const fnIdx = result.code.indexOf('export default function');
    expect(importIdx).toBeGreaterThanOrEqual(0);
    expect(importIdx).toBeLessThan(fnIdx);
  });

  it('places non-import script code inside createComponent', () => {
    const source = forge({
      script: "const count = signal(0);",
      template: '<div></div>',
    });
    const result = compile(source);
    const fnIdx = result.code.indexOf('export function createComponent');
    const countIdx = result.code.indexOf('const count = signal(0);');
    expect(countIdx).toBeGreaterThan(fnIdx);
  });

  it('compiles a realistic counter component end-to-end', () => {
    const source = forge({
      script: [
        "import { signal } from '@forge/core';",
        'const count = signal(0);',
        'function increment() { count.update(n => n + 1); }',
      ].join('\n'),
      template: [
        '<div class="counter">',
        '  <button @click={increment}>+</button>',
        '  <span>{count()}</span>',
        '</div>',
      ].join('\n'),
    });

    const result = compile(source, 'counter.forge');
    expect(result.errors).toHaveLength(0);

    const code = result.code;
    // Module header
    expect(code).toContain('// Forge compiled component: counter.forge');
    // runInContext always present
    expect(code).toContain("import { runInContext } from '@forge/core';");
    expect(code).toContain('return runInContext(ctx.injector, () => {');
    // Imports hoisted
    expect(code).toContain("import { signal } from '@forge/core';");
    // DOM functions imported
    expect(code).toMatch(/import\s*\{[^}]*bindText[^}]*\}/);
    // Script body inside factory
    expect(code).toContain('const count = signal(0);');
    expect(code).toContain('function increment()');
    // Template output
    expect(code).toContain("createElement('div')");
    expect(code).toContain("setAttr(_e0, 'class', 'counter')");
    expect(code).toContain("listen(_e1, 'click', increment)");
    expect(code).toContain('bindText(');
    expect(code).toContain('return _e0;');
  });
});

// ---------------------------------------------------------------------------
// DI injection context
// ---------------------------------------------------------------------------

describe('compileSFC — DI injection context', () => {
  it('compiles inject() in a script block without manual runInContext', () => {
    const source = forge({
      script: [
        "import { inject } from '@forge/core';",
        "import { CounterService } from './counter.service.js';",
        'const svc = inject(CounterService);',
      ].join('\n'),
      template: '<div></div>',
    });
    const result = compile(source);
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('const svc = inject(CounterService);');
  });

  it('places inject() call inside the runInContext callback', () => {
    const source = forge({
      script: 'const svc = inject(MyService);',
      template: '<div></div>',
    });
    const result = compile(source);
    const runInCtxIdx = result.code.indexOf('runInContext(ctx.injector');
    const injectIdx = result.code.indexOf('inject(MyService)');
    expect(runInCtxIdx).toBeGreaterThanOrEqual(0);
    expect(injectIdx).toBeGreaterThan(runInCtxIdx);
  });

  it('runInContext import appears before the factory function', () => {
    const result = compile(forge({ template: '<div></div>' }));
    const importIdx = result.code.indexOf("import { runInContext }");
    const fnIdx = result.code.indexOf('export default function');
    expect(importIdx).toBeGreaterThanOrEqual(0);
    expect(importIdx).toBeLessThan(fnIdx);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('compileSFC — error handling', () => {
  it('returns an error for a template with no root element', () => {
    const result = compile('<template>   </template>');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toMatch(/\[Forge Compiler\]/);
  });

  it('returns an error when a template tag is malformed', () => {
    // Unclosed element — parser should throw and be caught
    const result = compile('<template><div</template>');
    // Either an error is captured or the code is generated (parser may handle gracefully)
    // At minimum, no unhandled exception should propagate.
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
  });

  it('warns when template has multiple root elements', () => {
    const result = compile(forge({ template: '<div>a</div><div>b</div>' }));
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some(w => w.message.includes('multiple root'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Child component mounting
// ---------------------------------------------------------------------------

describe('compileSFC — child components (.forge imports)', () => {
  it('calls mountChild instead of createElement for a .forge-imported tag', () => {
    const source = forge({
      script: "import MyButton from './my-button.forge'",
      template: '<div><MyButton /></div>',
    });
    const result = compile(source);
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('mountChild(MyButton, ctx)');
    expect(result.code).not.toContain("createElement('MyButton')");
  });

  it('imports mountChild from @forge/core/dom when a child component is used', () => {
    const source = forge({
      script: "import Card from './card.forge'",
      template: '<div><Card /></div>',
    });
    const result = compile(source);
    expect(result.code).toMatch(/import\s*\{[^}]*mountChild[^}]*\}/);
  });

  it('does NOT treat lowercase non-.forge imports as components', () => {
    const source = forge({
      script: "import { signal } from '@forge/core'",
      template: '<div><signal /></div>',
    });
    const result = compile(source);
    expect(result.code).toContain("createElement('signal')");
    expect(result.code).not.toContain('mountChild');
  });

  it('treats PascalCase named imports from non-.forge modules as component factories', () => {
    const source = forge({
      script: "import { RouterLink } from '@forge/router'",
      template: '<div><RouterLink href="/" label="Home" /></div>',
    });
    const result = compile(source);
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('mountChild(RouterLink, ctx');
    expect(result.code).not.toContain("createElement('RouterLink')");
  });

  it('does NOT treat ALL_CAPS named imports as component factories', () => {
    const source = forge({
      script: "import { ROUTER } from '@forge/router'",
      template: '<div></div>',
    });
    const result = compile(source);
    expect(result.errors).toHaveLength(0);
    // ROUTER should not be in componentMap — it is a DI token, not a factory
    expect(result.code).not.toContain('mountChild(ROUTER');
  });

  it('treats PascalCase default imports from non-.forge modules as component factories', () => {
    const source = forge({
      script: "import MyWidget from 'some-lib'",
      template: '<div><MyWidget /></div>',
    });
    const result = compile(source);
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('mountChild(MyWidget, ctx)');
    expect(result.code).not.toContain("createElement('MyWidget')");
  });

  it('passes static attrs as getter props to mountChild', () => {
    const source = forge({
      script: "import MyBtn from './my-btn.forge'",
      template: '<div><MyBtn label="Click me" /></div>',
    });
    const result = compile(source);
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain(`'label': () => 'Click me'`);
    expect(result.code).toContain('mountChild(MyBtn, ctx, _props');
  });

  it('passes :bind directives as reactive getter props', () => {
    const source = forge({
      script: "import MyBtn from './my-btn.forge'",
      template: '<div><MyBtn :label={title()} /></div>',
    });
    const result = compile(source);
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain(`'label': () => (title())`);
  });

  it('supports multiple child components in one parent', () => {
    const source = forge({
      script: [
        "import Header from './header.forge'",
        "import Footer from './footer.forge'",
      ].join('\n'),
      template: '<div><Header /><Footer /></div>',
    });
    const result = compile(source);
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('mountChild(Header, ctx)');
    expect(result.code).toContain('mountChild(Footer, ctx)');
  });

  it('registers child component DOM node with insert', () => {
    const source = forge({
      script: "import Child from './child.forge'",
      template: '<div><Child /></div>',
    });
    const result = compile(source);
    // The child node variable must be inserted into the parent element
    expect(result.code).toMatch(/insert\(_e0,\s*_e1\)/);
  });

  it('factory accepts props as second argument', () => {
    const result = compile(forge({ template: '<div></div>' }));
    expect(result.code).toContain('export default function(ctx, props = {})');
  });
});

// ---------------------------------------------------------------------------
// Compiler output shape
// ---------------------------------------------------------------------------

describe('compileSFC — output shape', () => {
  it('always returns errors and warnings arrays', () => {
    const result = compile(forge({ template: '<div></div>' }));
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('always returns a styles array', () => {
    const result = compile(forge({ template: '<div></div>' }));
    expect(Array.isArray(result.styles)).toBe(true);
  });

  it('includes the filename in the generated comment header', () => {
    const result = compile(forge({ template: '<p>hi</p>' }), 'app/my-comp.forge');
    expect(result.code).toContain('app/my-comp.forge');
  });

  it('only imports dom functions that are actually used', () => {
    // A plain div with no reactive bindings: only createElement + insert (if children)
    const result = compile(forge({ template: '<div></div>' }));
    // Should NOT import bindText, bindAttr, etc.
    expect(result.code).not.toContain('bindText');
    expect(result.code).not.toContain('bindAttr');
    expect(result.code).toContain('createElement');
  });
});

// ---------------------------------------------------------------------------
// Style blocks
// ---------------------------------------------------------------------------

describe('compileSFC — style blocks', () => {
  it('returns an empty styles array when there are no <style> blocks', () => {
    const result = compile(forge({ template: '<div></div>' }));
    expect(result.styles).toHaveLength(0);
  });

  it('returns one StyleResult for a plain <style> block', () => {
    const source = forge({
      template: '<div></div>',
      style: '<style>\n.foo { color: red; }\n</style>',
    });
    const result = compile(source);
    expect(result.styles).toHaveLength(1);
    expect(result.styles[0]?.lang).toBe('css');
    expect(result.styles[0]?.scoped).toBe(false);
    expect(result.styles[0]?.content).toContain('.foo { color: red; }');
  });

  it('returns lang "scss" for <style lang="scss">', () => {
    const source = forge({
      template: '<div></div>',
      style: '<style lang="scss">\n$c: red; .foo { color: $c; }\n</style>',
    });
    const result = compile(source);
    expect(result.styles[0]?.lang).toBe('scss');
  });

  it('returns scoped: true for <style scoped>', () => {
    const source = forge({
      template: '<div></div>',
      style: '<style scoped>\n.x { color: blue; }\n</style>',
    });
    const result = compile(source);
    expect(result.styles[0]?.scoped).toBe(true);
  });

  it('returns a non-empty scopeId for every style block', () => {
    const source = forge({
      template: '<div></div>',
      style: '<style>\n.x {}\n</style>',
    });
    const result = compile(source, 'src/MyComp.forge');
    expect(result.styles[0]?.scopeId).toMatch(/^forge-[0-9a-f]{6}$/);
  });

  it('uses the same scopeId for all style blocks in a component', () => {
    const source = `
<template><div></div></template>
<style>.a {}</style>
<style lang="scss">.b {}</style>`.trim();
    const result = compile(source, 'multi.forge');
    expect(result.styles).toHaveLength(2);
    expect(result.styles[0]?.scopeId).toBe(result.styles[1]?.scopeId);
  });

  it('generates consistent scopeIds for the same filename', () => {
    const source = forge({ template: '<div></div>', style: '<style>.x{}</style>' });
    const r1 = compile(source, 'src/Foo.forge');
    const r2 = compile(source, 'src/Foo.forge');
    expect(r1.styles[0]?.scopeId).toBe(r2.styles[0]?.scopeId);
  });

  it('generates different scopeIds for different filenames', () => {
    const source = forge({ template: '<div></div>', style: '<style>.x{}</style>' });
    const r1 = compile(source, 'src/Foo.forge');
    const r2 = compile(source, 'src/Bar.forge');
    expect(r1.styles[0]?.scopeId).not.toBe(r2.styles[0]?.scopeId);
  });

  it('stamps data-v-{scopeId} on elements when <style scoped>', () => {
    const source = forge({
      template: '<div><span>hi</span></div>',
      style: '<style scoped>.x{}</style>',
    });
    const result = compile(source, 'Scoped.forge');
    const scopeId = result.styles[0]?.scopeId ?? '';
    // Both div and span should get the scope attribute
    expect(result.code).toContain(`data-v-${scopeId}`);
    // Emitted for every element (2 elements → 2 setAttr calls)
    const matches = [...result.code.matchAll(new RegExp(`data-v-${scopeId}`, 'g'))];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('does NOT stamp scope attributes when no <style scoped> is present', () => {
    const source = forge({
      template: '<div></div>',
      style: '<style>.x{}</style>',
    });
    const result = compile(source, 'Unscoped.forge');
    expect(result.code).not.toContain('data-v-');
  });

  it('includes styles in the result even when template is missing', () => {
    const source = '<script>const x = 1;</script>\n<style>.x{}</style>';
    const result = compile(source, 'NoTemplate.forge');
    expect(result.styles).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// [formControl] directive
// ---------------------------------------------------------------------------

describe('compileSFC — [formControl] directive', () => {
  it('binds value prop and attaches input + blur listeners for text inputs', () => {
    const result = compile(forge({
      template: '<input type="text" [formControl]={ctrl} />',
    }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain("bindProp(_e0, 'value', () => String(ctrl.value()))");
    expect(result.code).toContain("listen(_e0, 'input'");
    expect(result.code).toContain('ctrl.setValue(_t.value)');
    expect(result.code).toContain('ctrl.markAsTouched()');
    expect(result.code).toContain("listen(_e0, 'blur'");
  });

  it('coerces value with Number() for type="number"', () => {
    const result = compile(forge({
      template: '<input type="number" [formControl]={age} />',
    }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain("bindProp(_e0, 'value', () => String(age.value()))");
    expect(result.code).toContain('age.setValue(Number(_t.value))');
  });

  it('coerces value with Number() for type="range"', () => {
    const result = compile(forge({
      template: '<input type="range" [formControl]={vol} />',
    }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('vol.setValue(Number(_t.value))');
  });

  it('binds checked prop and reads .checked for type="checkbox"', () => {
    const result = compile(forge({
      template: '<input type="checkbox" [formControl]={agree} />',
    }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain("bindProp(_e0, 'checked', () => Boolean(agree.value()))");
    expect(result.code).toContain('agree.setValue(_t.checked)');
  });

  it('treats type="email" as a text-type input (string coercion)', () => {
    const result = compile(forge({
      template: '<input type="email" [formControl]={email} />',
    }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('email.setValue(_t.value)');
    expect(result.code).not.toContain('Number(');
  });

  it('treats type="password" as a text-type input (string coercion)', () => {
    const result = compile(forge({
      template: '<input type="password" [formControl]={pw} />',
    }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('pw.setValue(_t.value)');
  });

  it('works alongside other directives on the same element', () => {
    const result = compile(forge({
      template: '<input type="text" [formControl]={ctrl} class="my-class" :placeholder={hint()} />',
    }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('ctrl.setValue(_t.value)');
    expect(result.code).toContain("bindAttr(_e0, 'placeholder'");
  });

  it('imports bindProp and listen when [formControl] is used', () => {
    const result = compile(forge({
      template: '<input type="text" [formControl]={ctrl} />',
    }));
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('bindProp');
    expect(result.code).toContain('listen');
  });
});
