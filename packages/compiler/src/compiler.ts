// =============================================================================
// @forge/compiler — Template Compiler (Step 5)
// Compiles a parsed SFCDescriptor into executable JavaScript module code.
// =============================================================================

import { createRequire } from 'node:module';
import type { SFCDescriptor } from './parser.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CompileResult {
  /** The generated JavaScript module source. */
  code: string;
  /** Optional source map (not yet implemented). */
  map?: string;
  /** Fatal errors — compilation failed. */
  errors: CompileError[];
  /** Non-fatal warnings — compilation succeeded with caveats. */
  warnings: CompileError[];
  /** Extracted style blocks, ready for the plugin to emit as CSS. */
  styles: StyleResult[];
}

export interface StyleResult {
  /** Raw CSS source (or SCSS source — the plugin compiles it). */
  content: string;
  /** Source language declared via <style lang="scss"> (default: 'css'). */
  lang: 'css' | 'scss';
  /** Whether the <style scoped> attribute was present. */
  scoped: boolean;
  /** Deterministic scope ID derived from the component filename. */
  scopeId: string;
}

export interface CompileError {
  message: string;
  line?: number;
  column?: number;
}

// ---------------------------------------------------------------------------
// TypeScript stripping (via oxc-transform)
// ---------------------------------------------------------------------------

type OxcErrorLabel = { span: { start: number; end: number }; message: string };
type OxcError = { message: string; severity?: string; labels?: OxcErrorLabel[]; helpMessage?: string };
type OxcTransformResult = { code: string; errors: Array<OxcError> };
type OxcTransformFn = (filename: string, source: string, options: object) => OxcTransformResult;
type OxcTransformModule = { transformSync: OxcTransformFn };

let _oxc: OxcTransformModule | undefined;

/**
 * Lazily loads oxc-transform via CJS require. Throws a descriptive error if
 * the package is not installed.
 */
function getOxcTransform(): OxcTransformModule {
  if (_oxc !== undefined) return _oxc;
  const _require = createRequire(import.meta.url);
  try {
    _oxc = _require('oxc-transform') as OxcTransformModule;
    return _oxc;
  } catch {
    throw new Error(
      `[Forge Compiler] TypeScript stripping requires the 'oxc-transform' package.\n` +
      `Run: npm install oxc-transform`,
    );
  }
}

/**
 * Converts a byte offset in `source` to a 1-based line and column number.
 * Used to attach human-readable location info to oxc parse errors.
 */
function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  const clamped = Math.min(offset, source.length);
  const before = source.slice(0, clamped);
  const line = (before.match(/\n/g)?.length ?? 0) + 1;
  const column = clamped - before.lastIndexOf('\n');
  return { line, column };
}

/**
 * Strips TypeScript type annotations from a script block's source using
 * oxc-transform. The source is treated as a `.ts` file so oxc enables
 * TypeScript mode. Returns the plain JavaScript and any transform errors.
 *
 * Errors are enriched with line/column info derived from the oxc span labels
 * so the user knows exactly which line in the <script> block is broken.
 */
function stripTypeScript(
  source: string,
  filename: string,
): { code: string; errors: CompileError[] } {
  const oxc = getOxcTransform();
  // Give oxc a .ts filename so it activates TypeScript parsing mode.
  const tsFilename = filename.replace(/\.forge$/i, '') + '.ts';
  const result = oxc.transformSync(tsFilename, source, {
    typescript: { onlyRemoveTypeImports: true },
  });

  const errors: CompileError[] = result.errors.map(e => {
    // Try to extract a span from the first label so we can report a line/col.
    const span = e.labels?.[0]?.span;
    if (span !== undefined) {
      const { line, column } = offsetToLineCol(source, span.start);
      const hint = e.helpMessage ? `\n  Hint: ${e.helpMessage}` : '';
      return {
        message: `[Script] Line ${line}:${column} — ${e.message}${hint}`,
        line,
        column,
      };
    }
    return { message: `[Script] ${e.message}` };
  });

  return { code: result.code ?? source, errors };
}

// ---------------------------------------------------------------------------
// Template AST types
// ---------------------------------------------------------------------------

type TemplateNode = ElementNode | TextNode | InterpolationNode;

interface ElementNode {
  type: 'element';
  tag: string;
  staticAttrs: StaticAttr[];
  directives: DirectiveNode[];
  children: TemplateNode[];
}

interface StaticAttr {
  name: string;
  value: string;
}

interface TextNode {
  type: 'text';
  content: string;
}

interface InterpolationNode {
  type: 'interpolation';
  expression: string;
}

type DirectiveKind = 'bind' | 'prop' | 'event' | 'show' | 'class' | 'formControl';

interface DirectiveNode {
  kind: DirectiveKind;
  /** Attribute name, property name, event name, or CSS class name. */
  name: string;
  /** Raw expression string extracted from the template. */
  expression: string;
}

// ---------------------------------------------------------------------------
// Void elements — never have a closing tag
// ---------------------------------------------------------------------------

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// ---------------------------------------------------------------------------
// Scope ID generation
// ---------------------------------------------------------------------------

/**
 * Generates a short, deterministic hex ID for a component file. Used to
 * attribute-scope CSS when `<style scoped>` is present.
 *
 * Uses djb2 hashing so the same filename always produces the same ID.
 */
function generateScopeId(filename: string): string {
  let h = 5381;
  for (let i = 0; i < filename.length; i++) {
    h = Math.imul(33, h) ^ filename.charCodeAt(i);
  }
  return `forge-${(h >>> 0).toString(16).padStart(8, '0').slice(-6)}`;
}

// ---------------------------------------------------------------------------
// Template Parser
// ---------------------------------------------------------------------------

/**
 * Recursive-descent HTML parser for the restricted subset of HTML used in
 * Forge templates. Parses elements, text nodes, `{expr}` interpolations, and
 * Forge directives (`@event`, `:attr`, `.prop`, `class:name`, `:show`).
 */
class TemplateParser {
  private pos = 0;

  constructor(
    private readonly src: string,
    private readonly filename: string,
  ) {}

  /** Entry point — returns the top-level nodes in the template. */
  parse(): TemplateNode[] {
    return this.parseDescendants(undefined);
  }

  // -------------------------------------------------------------------------
  // Core parsing loop
  // -------------------------------------------------------------------------

  private parseDescendants(parentTag: string | undefined): TemplateNode[] {
    const nodes: TemplateNode[] = [];

    while (this.pos < this.src.length) {
      // Check for closing tag before anything else.
      if (parentTag !== undefined) {
        const closeTag = `</${parentTag}`;
        if (this.src.startsWith(closeTag, this.pos)) {
          const closeEnd = this.src.indexOf('>', this.pos);
          this.pos = closeEnd === -1 ? this.src.length : closeEnd + 1;
          break;
        }
      }

      const ch = this.src[this.pos];
      if (ch === '<') {
        if (this.src.startsWith('<!--', this.pos)) {
          this.skipComment();
        } else {
          nodes.push(this.parseElement());
        }
      } else {
        const textNodes = this.parseTextContent();
        nodes.push(...textNodes);
      }
    }

    return nodes;
  }

  // -------------------------------------------------------------------------
  // Element parsing
  // -------------------------------------------------------------------------

  private parseElement(): ElementNode {
    this.expect('<');
    const tag = this.parseWhile(/[\w-]/);

    if (!tag) {
      throw new Error(
        `[Forge Compiler] Expected tag name at position ${this.pos} in "${this.filename}"`,
      );
    }

    const { staticAttrs, directives } = this.parseAttributes();
    this.skipWhitespace();

    // Self-closing: <br /> or <input />
    if (this.src[this.pos] === '/') {
      this.pos++;
      this.expect('>');
      return { type: 'element', tag, staticAttrs, directives, children: [] };
    }

    this.expect('>');

    // Void elements never have children.
    if (VOID_TAGS.has(tag.toLowerCase())) {
      return { type: 'element', tag, staticAttrs, directives, children: [] };
    }

    const children = this.parseDescendants(tag);
    return { type: 'element', tag, staticAttrs, directives, children };
  }

  // -------------------------------------------------------------------------
  // Attribute parsing
  // -------------------------------------------------------------------------

  private parseAttributes(): { staticAttrs: StaticAttr[]; directives: DirectiveNode[] } {
    const staticAttrs: StaticAttr[] = [];
    const directives: DirectiveNode[] = [];

    while (this.pos < this.src.length) {
      this.skipWhitespace();
      const ch = this.src[this.pos];
      if (ch === '>' || ch === '/') break;

      // Attr name includes directive sigils: @, :, ., class:name
      const name = this.parseWhile(/[^\s=>/]/);
      if (!name) break;

      this.skipWhitespace();

      let value = '';
      if (this.src[this.pos] === '=') {
        this.pos++;
        this.skipWhitespace();
        value = this.parseAttrValue();
      }

      // Classify by sigil prefix.
      if (name.startsWith('@')) {
        // Event listener: @click={handler} or @click="handler"
        directives.push({ kind: 'event', name: name.slice(1), expression: value });
      } else if (name.startsWith(':')) {
        const attrName = name.slice(1);
        if (attrName === 'show') {
          // Visibility directive: :show={expr}
          directives.push({ kind: 'show', name: '', expression: value });
        } else {
          // Reactive attribute: :href={expr}
          directives.push({ kind: 'bind', name: attrName, expression: value });
        }
      } else if (name.startsWith('.')) {
        // DOM property: .value={expr}
        directives.push({ kind: 'prop', name: name.slice(1), expression: value });
      } else if (name === '[formControl]') {
        // Two-way form control binding: [formControl]={control}
        // Expands to: value prop binding + input handler (setValue + markAsTouched) + blur handler
        directives.push({ kind: 'formControl', name: '', expression: value });
      } else if (name.startsWith('class:')) {
        // Class toggle: class:active={expr}
        directives.push({ kind: 'class', name: name.slice(6), expression: value });
      } else {
        // Plain static attribute.
        staticAttrs.push({ name, value });
      }
    }

    return { staticAttrs, directives };
  }

  private parseAttrValue(): string {
    const ch = this.src[this.pos];
    if (ch === '"') {
      this.pos++;
      const val = this.parseUntilChar('"');
      this.pos++; // closing "
      return val;
    }
    if (ch === "'") {
      this.pos++;
      const val = this.parseUntilChar("'");
      this.pos++; // closing '
      return val;
    }
    if (ch === '{') {
      this.pos++; // opening {
      const val = this.parseExpression();
      this.pos++; // closing }
      return val;
    }
    // Bare unquoted value.
    return this.parseWhile(/[^\s>/]/);
  }

  // -------------------------------------------------------------------------
  // Text content parsing (splits on `{...}` interpolations)
  // -------------------------------------------------------------------------

  private parseTextContent(): TemplateNode[] {
    const nodes: TemplateNode[] = [];
    let text = '';

    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]!;
      if (ch === '<') break;

      if (ch === '{') {
        // Flush accumulated text first.
        const trimmed = text.trim();
        if (trimmed) nodes.push({ type: 'text', content: trimmed });
        text = '';

        this.pos++; // opening {
        const expr = this.parseExpression();
        this.pos++; // closing }
        nodes.push({ type: 'interpolation', expression: expr });
      } else {
        text += ch;
        this.pos++;
      }
    }

    const trimmed = text.trim();
    if (trimmed) nodes.push({ type: 'text', content: trimmed });

    return nodes;
  }

  // -------------------------------------------------------------------------
  // Primitives
  // -------------------------------------------------------------------------

  /**
   * Parses an expression respecting nested `{...}` braces. Stops at the
   * outermost unmatched `}` without consuming it.
   */
  private parseExpression(): string {
    let depth = 0;
    const start = this.pos;
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]!;
      if (ch === '{') { depth++; this.pos++; continue; }
      if (ch === '}') {
        if (depth === 0) break; // outer closing brace — stop
        depth--;
        this.pos++;
        continue;
      }
      // Handle string literals so `}` inside them doesn't confuse the parser.
      if (ch === '"' || ch === "'" || ch === '`') {
        this.skipStringLiteral(ch);
      } else {
        this.pos++;
      }
    }
    return this.src.slice(start, this.pos).trim();
  }

  private skipStringLiteral(quote: string): void {
    this.pos++; // opening quote
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]!;
      if (ch === '\\') { this.pos += 2; continue; } // escape sequence
      if (ch === quote) { this.pos++; break; }
      this.pos++;
    }
  }

  private skipComment(): void {
    const end = this.src.indexOf('-->', this.pos);
    this.pos = end === -1 ? this.src.length : end + 3;
  }

  /** Advance while characters match `pattern`, returning the consumed slice. */
  private parseWhile(pattern: RegExp): string {
    const start = this.pos;
    while (this.pos < this.src.length && pattern.test(this.src[this.pos]!)) {
      this.pos++;
    }
    return this.src.slice(start, this.pos);
  }

  private parseUntilChar(stop: string): string {
    const start = this.pos;
    while (this.pos < this.src.length && this.src[this.pos] !== stop) {
      this.pos++;
    }
    return this.src.slice(start, this.pos);
  }

  private skipWhitespace(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos]!)) {
      this.pos++;
    }
  }

  private expect(char: string): void {
    if (this.src[this.pos] !== char) {
      throw new Error(
        `[Forge Compiler] Expected '${char}' but got '${this.src[this.pos] ?? 'EOF'}' ` +
          `at position ${this.pos} in "${this.filename}"`,
      );
    }
    this.pos++;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wraps a string in single quotes with minimal escaping. */
function q(str: string): string {
  return `'${str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`;
}

// ---------------------------------------------------------------------------
// Code Generator
// ---------------------------------------------------------------------------

/**
 * Walks a template AST and emits JavaScript statements that build the DOM
 * tree using the `@forge/core/dom` runtime. All statements are indented with
 * two spaces (function body level).
 */
class CodeGenerator {
  private readonly stmts: string[] = [];
  private elemCount = 0;
  private textCount = 0;

  /** DOM functions actually used — drives the import statement. */
  readonly usedDomFns = new Set<string>();

  /**
   * @param scopeId      - When set, every generated HTML element receives a
   *   `data-v-{scopeId}` attribute so scoped CSS selectors can target it.
   * @param componentMap - Maps tag name → import binding name for every
   *   `.forge` import found in the script block.
   */
  constructor(
    private readonly scopeId?: string,
    private readonly componentMap: Map<string, string> = new Map(),
  ) {}

  // -------------------------------------------------------------------------
  // Public entry point
  // -------------------------------------------------------------------------

  /** Walk a single node, emit statements, return the variable that holds it. */
  walkNode(node: TemplateNode): string {
    switch (node.type) {
      case 'text':          return this.genText(node);
      case 'interpolation': return this.genInterpolation(node);
      case 'element':       return this.genElement(node);
    }
  }

  getStatements(): readonly string[] {
    return this.stmts;
  }

  // -------------------------------------------------------------------------
  // Node generators
  // -------------------------------------------------------------------------

  private genText(node: TextNode): string {
    const v = `_t${this.textCount++}`;
    this.emit(`const ${v} = document.createTextNode(${q(node.content)});`);
    return v;
  }

  private genInterpolation(node: InterpolationNode): string {
    const v = `_t${this.textCount++}`;
    this.use('bindText');
    this.emit(`const ${v} = document.createTextNode('');`);
    this.emit(`ctx.effects.push(bindText(${v}, () => String(${node.expression})));`);
    return v;
  }

  private genElement(node: ElementNode): string {
    // Route component tags to a dedicated generator.
    if (this.componentMap.has(node.tag)) {
      return this.genComponentElement(node);
    }

    const v = `_e${this.elemCount++}`;
    this.use('createElement');
    this.emit(`const ${v} = createElement(${q(node.tag)});`);

    // Scope attribute — stamped on every element when <style scoped> is used.
    if (this.scopeId !== undefined) {
      this.use('setAttr');
      this.emit(`setAttr(${v}, 'data-v-${this.scopeId}', '');`);
    }

    // Static attributes.
    for (const attr of node.staticAttrs) {
      this.use('setAttr');
      this.emit(`setAttr(${v}, ${q(attr.name)}, ${q(attr.value)});`);
    }

    // Directives — class: gathered for one bindClass call; formControl: expanded
    // into value binding + input/blur handlers; rest emitted inline.
    const classDirectives = node.directives.filter(d => d.kind === 'class');
    const formControlDirectives = node.directives.filter(d => d.kind === 'formControl');
    const otherDirectives = node.directives.filter(
      d => d.kind !== 'class' && d.kind !== 'formControl',
    );

    for (const dir of otherDirectives) {
      this.genDirective(v, dir);
    }

    for (const dir of formControlDirectives) {
      this.genFormControlDirective(v, dir.expression, node.staticAttrs);
    }

    if (classDirectives.length > 0) {
      this.use('bindClass');
      const entries = classDirectives
        .map(d => `      ${q(d.name)}: Boolean(${d.expression})`)
        .join(',\n');
      this.emit(`ctx.effects.push(bindClass(${v}, () => ({\n${entries}\n    })));`);
    }

    // Children — emitted depth-first so variables exist before insert calls.
    for (const child of node.children) {
      const childVar = this.walkNode(child);
      this.use('insert');
      this.emit(`insert(${v}, ${childVar});`);
    }

    return v;
  }

  /**
   * Generates a `mountChild` call for a component tag (a `.forge` import).
   *
   * Static attrs and `:bind` directives become getter functions in the props
   * object so child scripts can always call `props['name']()` uniformly:
   *   - `<MyCard title="Hi" />`     → `{ 'title': () => 'Hi' }`
   *   - `<MyCard :title={label()} />` → `{ 'title': () => label() }`
   */
  private genComponentElement(node: ElementNode): string {
    const idx = this.elemCount++;
    const v = `_e${idx}`;
    const factoryName = this.componentMap.get(node.tag)!;
    this.use('mountChild');

    const propsEntries: string[] = [];

    for (const attr of node.staticAttrs) {
      propsEntries.push(`    ${q(attr.name)}: () => ${q(attr.value)}`);
    }

    for (const dir of node.directives) {
      if (dir.kind === 'bind') {
        propsEntries.push(`    ${q(dir.name)}: () => (${dir.expression})`);
      }
      // Event, show, and class directives on component tags are not yet supported.
    }

    if (propsEntries.length > 0) {
      this.emit(`const _props${idx} = {\n${propsEntries.join(',\n')}\n  };`);
      this.emit(`const ${v} = mountChild(${factoryName}, ctx, _props${idx});`);
    } else {
      this.emit(`const ${v} = mountChild(${factoryName}, ctx);`);
    }

    return v;
  }

  /**
   * Generates the wiring for a `[formControl]={ctrl}` directive:
   *  1. Reactive value/checked prop binding (reads `ctrl.value()`)
   *  2. `input` event → `ctrl.setValue(...)` + `ctrl.markAsTouched()`
   *  3. `blur` event → `ctrl.markAsTouched()`
   *
   * Value coercion is inferred from the element's static `type` attribute:
   *  - `number` / `range` → `Number(ev.target.value)`
   *  - `checkbox`         → `ev.target.checked` (boolean)
   *  - everything else    → `ev.target.value`   (string)
   */
  private genFormControlDirective(
    elVar: string,
    ctrlExpr: string,
    staticAttrs: StaticAttr[],
  ): void {
    const inputType = staticAttrs.find(a => a.name === 'type')?.value ?? 'text';

    this.use('bindProp');
    this.use('listen');

    if (inputType === 'checkbox') {
      // Checkbox: bind `checked` property; read `.checked` on input.
      this.emit(`ctx.effects.push(bindProp(${elVar}, 'checked', () => Boolean(${ctrlExpr}.value())));`);
      this.emit(`ctx.effects.push(listen(${elVar}, 'input', (ev) => { const _t = ev.target; ${ctrlExpr}.setValue(_t.checked); ${ctrlExpr}.markAsTouched(); }));`);
    } else if (inputType === 'number' || inputType === 'range') {
      // Numeric inputs: bind `value` as string for the DOM; coerce to Number on input.
      this.emit(`ctx.effects.push(bindProp(${elVar}, 'value', () => String(${ctrlExpr}.value())));`);
      this.emit(`ctx.effects.push(listen(${elVar}, 'input', (ev) => { const _t = ev.target; ${ctrlExpr}.setValue(Number(_t.value)); ${ctrlExpr}.markAsTouched(); }));`);
    } else {
      // Text, email, password, url, textarea, etc.
      this.emit(`ctx.effects.push(bindProp(${elVar}, 'value', () => String(${ctrlExpr}.value())));`);
      this.emit(`ctx.effects.push(listen(${elVar}, 'input', (ev) => { const _t = ev.target; ${ctrlExpr}.setValue(_t.value); ${ctrlExpr}.markAsTouched(); }));`);
    }

    // Blur always marks as touched (handles focus-out without typing).
    this.emit(`ctx.effects.push(listen(${elVar}, 'blur', () => ${ctrlExpr}.markAsTouched()));`);
  }

  private genDirective(elVar: string, dir: DirectiveNode): void {
    switch (dir.kind) {
      case 'event':
        this.use('listen');
        this.emit(`ctx.effects.push(listen(${elVar}, ${q(dir.name)}, ${dir.expression}));`);
        break;
      case 'bind':
        this.use('bindAttr');
        this.emit(`ctx.effects.push(bindAttr(${elVar}, ${q(dir.name)}, () => ${dir.expression}));`);
        break;
      case 'prop':
        this.use('bindProp');
        this.emit(`ctx.effects.push(bindProp(${elVar}, ${q(dir.name)}, () => ${dir.expression}));`);
        break;
      case 'show':
        this.use('bindShow');
        this.emit(`ctx.effects.push(bindShow(${elVar}, () => Boolean(${dir.expression})));`);
        break;
      case 'class':
        // Handled separately in a batch bindClass call.
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private emit(stmt: string): void {
    this.stmts.push(`  ${stmt}`);
  }

  private use(fn: string): void {
    this.usedDomFns.add(fn);
  }
}

// ---------------------------------------------------------------------------
// Script block processing
// ---------------------------------------------------------------------------

/**
 * Splits a script block's content into:
 *  - `hoistedImports` — `import` statements that must live at module scope.
 *  - `bodyContent`   — the rest, which runs inside the `createComponent` factory.
 *  - `componentMap`  — maps tag name → import binding for every `.forge` import.
 *
 * Note: only single-line `import` statements are recognised. Multi-line
 * imports should be written on one line in `.forge` script blocks.
 */
function extractScriptParts(content: string): {
  hoistedImports: string[];
  bodyContent: string;
  componentMap: Map<string, string>;
} {
  const hoistedImports: string[] = [];
  const bodyLines: string[] = [];
  const componentMap = new Map<string, string>();

  // Matches: import Identifier from '...path.forge'  (default import of a .forge file)
  const forgeImportRe = /^\s*import\s+(\w+)\s+from\s+['"][^'"]*\.forge['"]/;
  // Matches: import { Foo, Bar } from '...'  (named imports — interior captured)
  const namedImportRe = /^\s*import\s*\{([^}]+)\}\s*from\s+/;
  // Matches: import Foo from '...'  (PascalCase default import from any module)
  const defaultImportRe = /^\s*import\s+([A-Z]\w*)\s+from\s+/;

  for (const line of content.split('\n')) {
    if (/^\s*import\s/.test(line)) {
      hoistedImports.push(line);

      // Type-only imports produce no runtime value.
      if (/^\s*import\s+type[\s{]/.test(line)) continue;

      // .forge default import — always a component factory.
      const forgeMatch = forgeImportRe.exec(line);
      if (forgeMatch?.[1] !== undefined) {
        componentMap.set(forgeMatch[1], forgeMatch[1]);
        continue;
      }

      // Named import — register any PascalCase (e.g. RouterLink) identifier.
      // ALL_CAPS tokens (e.g. ROUTER) are skipped — they are DI tokens, not factories.
      const namedMatch = namedImportRe.exec(line);
      if (namedMatch?.[1] !== undefined) {
        for (const part of namedMatch[1].split(',')) {
          // Handle "RouterLink as Link" → local binding is "Link"
          const aliasM = /(\w+)\s+as\s+(\w+)/.exec(part.trim());
          const localName = aliasM ? aliasM[2]! : (part.trim().split(/\s+/)[0] ?? '');
          if (/^[A-Z][a-z]/.test(localName)) {
            componentMap.set(localName, localName);
          }
        }
        continue;
      }

      // PascalCase default import from any module.
      const defaultMatch = defaultImportRe.exec(line);
      if (defaultMatch?.[1] !== undefined && /^[A-Z][a-z]/.test(defaultMatch[1])) {
        componentMap.set(defaultMatch[1], defaultMatch[1]);
      }
    } else {
      bodyLines.push(line);
    }
  }

  const bodyContent = bodyLines.join('\n').trim();
  return { hoistedImports, bodyContent, componentMap };
}

// ---------------------------------------------------------------------------
// Public: compileSFC
// ---------------------------------------------------------------------------

/**
 * Compiles a parsed `.forge` SFCDescriptor into a JavaScript module string.
 *
 * The output module exports a single `createComponent(ctx)` factory function
 * that builds and returns the DOM tree described by the `<template>` block.
 * Reactive bindings are wired through the provided `ComponentContext`.
 *
 * @example
 * ```ts
 * const result = compileSFC(parseSFC(source, 'counter.forge'));
 * if (result.errors.length === 0) {
 *   console.log(result.code);
 * }
 * ```
 */
export function compileSFC(descriptor: SFCDescriptor): CompileResult {
  const errors: CompileError[] = [];
  const warnings: CompileError[] = [];

  // ---- Build style descriptors (always, regardless of template presence) ---

  const scopeId = generateScopeId(descriptor.filename);
  const hasScoped = descriptor.styles.some(s => s.attrs['scoped'] === true);

  const styles: StyleResult[] = descriptor.styles.map(block => ({
    content: block.content,
    lang: block.attrs['lang'] === 'scss' ? 'scss' : 'css',
    scoped: block.attrs['scoped'] === true,
    scopeId,
  }));

  // A missing template is not fatal but produces no DOM.
  if (!descriptor.template) {
    return {
      code: descriptor.script?.content.trim() ?? '',
      errors,
      warnings: [{
        message: '[Forge Compiler] No <template> block found; component will have no DOM output.',
      }],
      styles,
    };
  }

  // ---- Parse template -------------------------------------------------------

  let rootNodes: TemplateNode[];
  try {
    const parser = new TemplateParser(
      descriptor.template.content,
      descriptor.filename,
    );
    rootNodes = parser.parse();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { code: '', errors: [{ message }], warnings, styles };
  }

  // We require at least one element root.
  const elementRoots = rootNodes.filter((n): n is ElementNode => n.type === 'element');

  if (elementRoots.length === 0) {
    return {
      code: '',
      errors: [{
        message: '[Forge Compiler] <template> must contain at least one root element.',
      }],
      warnings,
      styles,
    };
  }

  if (elementRoots.length > 1) {
    warnings.push({
      message:
        '[Forge Compiler] <template> has multiple root elements; only the first will be used.',
    });
  }

  // ---- Process script block -------------------------------------------------

  // Strip TypeScript type annotations when <script lang="ts"> is declared.
  // oxc-transform removes all type syntax and leaves valid plain JavaScript,
  // which the rest of the compiler then embeds verbatim into the output module.
  let scriptContent = descriptor.script?.content ?? '';
  if (descriptor.script?.attrs['lang'] === 'ts') {
    const stripped = stripTypeScript(scriptContent, descriptor.filename);
    if (stripped.errors.length > 0) {
      return { code: '', errors: stripped.errors, warnings, styles };
    }
    scriptContent = stripped.code;
  }

  const { hoistedImports, bodyContent, componentMap } =
    extractScriptParts(scriptContent);

  // ---- Generate template code -----------------------------------------------

  // Pass scopeId only when at least one style block is scoped so elements
  // receive the data-v-{scopeId} attribute for CSS selector targeting.
  const gen = new CodeGenerator(hasScoped ? scopeId : undefined, componentMap);
  const rootVar = gen.walkNode(elementRoots[0]!);

  // ---- Assemble the output module -------------------------------------------

  const domFns = [...gen.usedDomFns].sort().join(', ');
  const domImportLine = domFns
    ? `import { ${domFns} } from '@forge/core/dom';`
    : '';

  const factoryLines: string[] = [];

  // Script body (state, functions) — indented into the factory.
  if (bodyContent) {
    for (const line of bodyContent.split('\n')) {
      factoryLines.push(`  ${line}`);
    }
    factoryLines.push(''); // blank separator between script body and template code
  }

  // Generated template statements.
  factoryLines.push(...gen.getStatements());
  factoryLines.push(`  return ${rootVar};`);

  // Indent the factory body one extra level for the runInContext callback.
  const innerLines = factoryLines.map(l => `  ${l}`);

  const parts: string[] = [];
  parts.push(`// Forge compiled component: ${descriptor.filename}`);
  parts.push(`import { runInContext } from '@forge/core';`);
  if (domImportLine) parts.push(domImportLine);
  for (const imp of hoistedImports) parts.push(imp);
  parts.push('');
  parts.push('export default function(ctx, props = {}) {');
  parts.push('  return runInContext(ctx.injector, () => {');
  parts.push(innerLines.join('\n'));
  parts.push('  });');
  parts.push('}');

  return { code: parts.join('\n'), errors, warnings, styles };
}
