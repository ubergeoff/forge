// =============================================================================
// @forge/compiler — Shared compiler internals (browser-safe, no Node.js deps)
// Contains all types, the template parser, code generator, and compileSFC.
// Both compiler.ts (Node.js) and browser.ts import from here.
// =============================================================================

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

/**
 * Signature for a function that strips TypeScript syntax from source code.
 * The Node.js default uses oxc-transform; the browser default uses a regex
 * stripper. Pass explicitly to compileSFC to override.
 */
export type StripTypeScriptFn = (
  source: string,
  filename: string,
) => { code: string; errors: CompileError[] };

// ---------------------------------------------------------------------------
// Browser-safe TypeScript stripper
// ---------------------------------------------------------------------------

/**
 * Lightweight TypeScript stripper for browser environments.
 * Handles common patterns (import type, interface, type aliases, annotations)
 * sufficient for playground use. Not a full TypeScript parser.
 */
export const regexStripTypeScript: StripTypeScriptFn = (source) => {
  let code = source;
  code = code.replace(/^\s*import\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]+['"]\s*;?\s*$/gm, '');
  code = code.replace(/^\s*import\s+type\s+\w+\s+from\s+['"][^'"]+['"]\s*;?\s*$/gm, '');
  code = code.replace(/^\s*(?:export\s+)?interface\s+\w+[^{]*\{[^}]*\}\s*$/gm, '');
  code = code.replace(/^\s*(?:export\s+)?type\s+\w+\s*=\s*[^;]+;\s*$/gm, '');
  code = code.replace(/:\s*[A-Z][A-Za-z<>[\]|&\s,]*(?=\s*[=,);\n{])/g, '');
  code = code.replace(/\)\s*:\s*[A-Z][A-Za-z<>[\]|&\s,]*(?=\s*\{)/g, ') ');
  return { code, errors: [] };
};

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
  name: string;
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

class TemplateParser {
  private pos = 0;

  constructor(
    private readonly src: string,
    private readonly filename: string,
  ) {}

  parse(): TemplateNode[] {
    return this.parseDescendants(undefined);
  }

  private parseDescendants(parentTag: string | undefined): TemplateNode[] {
    const nodes: TemplateNode[] = [];

    while (this.pos < this.src.length) {
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

    if (this.src[this.pos] === '/') {
      this.pos++;
      this.expect('>');
      return { type: 'element', tag, staticAttrs, directives, children: [] };
    }

    this.expect('>');

    if (VOID_TAGS.has(tag.toLowerCase())) {
      return { type: 'element', tag, staticAttrs, directives, children: [] };
    }

    const children = this.parseDescendants(tag);
    return { type: 'element', tag, staticAttrs, directives, children };
  }

  private parseAttributes(): { staticAttrs: StaticAttr[]; directives: DirectiveNode[] } {
    const staticAttrs: StaticAttr[] = [];
    const directives: DirectiveNode[] = [];

    while (this.pos < this.src.length) {
      this.skipWhitespace();
      const ch = this.src[this.pos];
      if (ch === '>' || ch === '/') break;

      const name = this.parseWhile(/[^\s=>/]/);
      if (!name) break;

      this.skipWhitespace();

      let value = '';
      if (this.src[this.pos] === '=') {
        this.pos++;
        this.skipWhitespace();
        value = this.parseAttrValue();
      }

      if (name.startsWith('@')) {
        directives.push({ kind: 'event', name: name.slice(1), expression: value });
      } else if (name.startsWith(':')) {
        const attrName = name.slice(1);
        if (attrName === 'show') {
          directives.push({ kind: 'show', name: '', expression: value });
        } else {
          directives.push({ kind: 'bind', name: attrName, expression: value });
        }
      } else if (name.startsWith('.')) {
        directives.push({ kind: 'prop', name: name.slice(1), expression: value });
      } else if (name === '[formControl]') {
        directives.push({ kind: 'formControl', name: '', expression: value });
      } else if (name.startsWith('class:')) {
        directives.push({ kind: 'class', name: name.slice(6), expression: value });
      } else {
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
      this.pos++;
      return val;
    }
    if (ch === "'") {
      this.pos++;
      const val = this.parseUntilChar("'");
      this.pos++;
      return val;
    }
    if (ch === '{') {
      this.pos++;
      const val = this.parseExpression();
      this.pos++;
      return val;
    }
    return this.parseWhile(/[^\s>/]/);
  }

  private parseTextContent(): TemplateNode[] {
    const nodes: TemplateNode[] = [];
    let text = '';

    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]!;
      if (ch === '<') break;

      if (ch === '{') {
        const trimmed = text.trim();
        if (trimmed) nodes.push({ type: 'text', content: trimmed });
        text = '';

        this.pos++;
        const expr = this.parseExpression();
        this.pos++;
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

  private parseExpression(): string {
    let depth = 0;
    const start = this.pos;
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]!;
      if (ch === '{') { depth++; this.pos++; continue; }
      if (ch === '}') {
        if (depth === 0) break;
        depth--;
        this.pos++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        this.skipStringLiteral(ch);
      } else {
        this.pos++;
      }
    }
    return this.src.slice(start, this.pos).trim();
  }

  private skipStringLiteral(quote: string): void {
    this.pos++;
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]!;
      if (ch === '\\') { this.pos += 2; continue; }
      if (ch === quote) { this.pos++; break; }
      this.pos++;
    }
  }

  private skipComment(): void {
    const end = this.src.indexOf('-->', this.pos);
    this.pos = end === -1 ? this.src.length : end + 3;
  }

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

class CodeGenerator {
  private readonly stmts: string[] = [];
  private elemCount = 0;
  private textCount = 0;

  readonly usedDomFns = new Set<string>();

  constructor(
    private readonly scopeId?: string,
    private readonly componentMap: Map<string, string> = new Map(),
  ) {}

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
    if (this.componentMap.has(node.tag)) {
      return this.genComponentElement(node);
    }

    const v = `_e${this.elemCount++}`;
    this.use('createElement');
    this.emit(`const ${v} = createElement(${q(node.tag)});`);

    if (this.scopeId !== undefined) {
      this.use('setAttr');
      this.emit(`setAttr(${v}, 'data-v-${this.scopeId}', '');`);
    }

    for (const attr of node.staticAttrs) {
      this.use('setAttr');
      this.emit(`setAttr(${v}, ${q(attr.name)}, ${q(attr.value)});`);
    }

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

    for (const child of node.children) {
      const childVar = this.walkNode(child);
      this.use('insert');
      this.emit(`insert(${v}, ${childVar});`);
    }

    return v;
  }

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
    }

    if (propsEntries.length > 0) {
      this.emit(`const _props${idx} = {\n${propsEntries.join(',\n')}\n  };`);
      this.emit(`const ${v} = mountChild(${factoryName}, ctx, _props${idx});`);
    } else {
      this.emit(`const ${v} = mountChild(${factoryName}, ctx);`);
    }

    return v;
  }

  private genFormControlDirective(
    elVar: string,
    ctrlExpr: string,
    staticAttrs: StaticAttr[],
  ): void {
    const inputType = staticAttrs.find(a => a.name === 'type')?.value ?? 'text';

    this.use('bindProp');
    this.use('listen');

    if (inputType === 'checkbox') {
      this.emit(`ctx.effects.push(bindProp(${elVar}, 'checked', () => Boolean(${ctrlExpr}.value())));`);
      this.emit(`ctx.effects.push(listen(${elVar}, 'input', (ev) => { const _t = ev.target; ${ctrlExpr}.setValue(_t.checked); ${ctrlExpr}.markAsTouched(); }));`);
    } else if (inputType === 'number' || inputType === 'range') {
      this.emit(`ctx.effects.push(bindProp(${elVar}, 'value', () => String(${ctrlExpr}.value())));`);
      this.emit(`ctx.effects.push(listen(${elVar}, 'input', (ev) => { const _t = ev.target; ${ctrlExpr}.setValue(Number(_t.value)); ${ctrlExpr}.markAsTouched(); }));`);
    } else {
      this.emit(`ctx.effects.push(bindProp(${elVar}, 'value', () => String(${ctrlExpr}.value())));`);
      this.emit(`ctx.effects.push(listen(${elVar}, 'input', (ev) => { const _t = ev.target; ${ctrlExpr}.setValue(_t.value); ${ctrlExpr}.markAsTouched(); }));`);
    }

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
        break;
    }
  }

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

export function extractScriptParts(content: string): {
  hoistedImports: string[];
  bodyContent: string;
  componentMap: Map<string, string>;
} {
  const hoistedImports: string[] = [];
  const bodyLines: string[] = [];
  const componentMap = new Map<string, string>();

  const forgeImportRe = /^\s*import\s+(\w+)\s+from\s+['"][^'"]*\.forge['"]/;
  const namedImportRe = /^\s*import\s*\{([^}]+)\}\s*from\s+/;
  const defaultImportRe = /^\s*import\s+([A-Z]\w*)\s+from\s+/;

  for (const line of content.split('\n')) {
    if (/^\s*import\s/.test(line)) {
      hoistedImports.push(line);

      if (/^\s*import\s+type[\s{]/.test(line)) continue;

      const forgeMatch = forgeImportRe.exec(line);
      if (forgeMatch?.[1] !== undefined) {
        componentMap.set(forgeMatch[1], forgeMatch[1]);
        continue;
      }

      const namedMatch = namedImportRe.exec(line);
      if (namedMatch?.[1] !== undefined) {
        for (const part of namedMatch[1].split(',')) {
          const aliasM = /(\w+)\s+as\s+(\w+)/.exec(part.trim());
          const localName = aliasM ? aliasM[2]! : (part.trim().split(/\s+/)[0] ?? '');
          if (/^[A-Z][a-z]/.test(localName)) {
            componentMap.set(localName, localName);
          }
        }
        continue;
      }

      const defaultMatch = defaultImportRe.exec(line);
      if (defaultMatch?.[1] !== undefined && /^[A-Z][a-z]/.test(defaultMatch[1])) {
        componentMap.set(defaultMatch[1], defaultMatch[1]);
      }
    } else {
      bodyLines.push(line);
    }
  }

  return { hoistedImports, bodyContent: bodyLines.join('\n').trim(), componentMap };
}

// ---------------------------------------------------------------------------
// Public: compileSFC
// ---------------------------------------------------------------------------

/**
 * Compiles a parsed `.forge` SFCDescriptor into a JavaScript module string.
 * Requires a `stripTypeScript` implementation — Node.js callers use
 * `oxcStripTypeScript` (from compiler.ts); browser callers use
 * `regexStripTypeScript` (exported from this file).
 */
export function compileSFC(
  descriptor: SFCDescriptor,
  stripTypeScript: StripTypeScriptFn,
): CompileResult {
  const errors: CompileError[] = [];
  const warnings: CompileError[] = [];

  const scopeId = generateScopeId(descriptor.filename);
  const hasScoped = descriptor.styles.some(s => s.attrs['scoped'] === true);

  const styles: StyleResult[] = descriptor.styles.map(block => ({
    content: block.content,
    lang: block.attrs['lang'] === 'scss' ? 'scss' : 'css',
    scoped: block.attrs['scoped'] === true,
    scopeId,
  }));

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

  let rootNodes: TemplateNode[];
  try {
    rootNodes = new TemplateParser(descriptor.template.content, descriptor.filename).parse();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { code: '', errors: [{ message }], warnings, styles };
  }

  const elementRoots = rootNodes.filter((n): n is ElementNode => n.type === 'element');

  if (elementRoots.length === 0) {
    return {
      code: '',
      errors: [{ message: '[Forge Compiler] <template> must contain at least one root element.' }],
      warnings,
      styles,
    };
  }

  if (elementRoots.length > 1) {
    warnings.push({
      message: '[Forge Compiler] <template> has multiple root elements; only the first will be used.',
    });
  }

  let scriptContent = descriptor.script?.content ?? '';
  if (descriptor.script?.attrs['lang'] === 'ts') {
    const stripped = stripTypeScript(scriptContent, descriptor.filename);
    if (stripped.errors.length > 0) {
      return { code: '', errors: stripped.errors, warnings, styles };
    }
    scriptContent = stripped.code;
  }

  const { hoistedImports, bodyContent, componentMap } = extractScriptParts(scriptContent);

  const gen = new CodeGenerator(hasScoped ? scopeId : undefined, componentMap);
  const rootVar = gen.walkNode(elementRoots[0]!);

  const domFns = [...gen.usedDomFns].sort().join(', ');
  const domImportLine = domFns ? `import { ${domFns} } from '@forge/core/dom';` : '';

  const factoryLines: string[] = [];
  if (bodyContent) {
    for (const line of bodyContent.split('\n')) {
      factoryLines.push(`  ${line}`);
    }
    factoryLines.push('');
  }
  factoryLines.push(...gen.getStatements());
  factoryLines.push(`  return ${rootVar};`);

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
