// =============================================================================
// @vorra/language-server — VorraDocument
// Wraps a parsed SFCDescriptor with position helpers for LSP use.
// =============================================================================

import { parseSFC } from '@vorra/compiler';
import type { SFCDescriptor, SFCBlock } from '@vorra/compiler';
import type { Position } from 'vscode-languageserver';
import { fileURLToPath } from 'node:url';

export type BlockKind = 'script' | 'template' | 'style' | null;

export class VorraDocument {
  readonly descriptor: SFCDescriptor;
  readonly source: string;
  readonly filename: string;
  readonly parseError: string | null;

  constructor(source: string, uri: string) {
    this.source = source;
    this.filename = fileURLToPath(uri);
    this.parseError = null;

    try {
      this.descriptor = parseSFC(source, this.filename);
    } catch (err) {
      this.parseError = err instanceof Error ? err.message : String(err);
      this.descriptor = { script: null, template: null, styles: [], filename: this.filename };
    }
  }

  /** Convert a byte offset into a 0-indexed LSP Position. */
  offsetToPosition(offset: number): Position {
    const clamped = Math.max(0, Math.min(offset, this.source.length));
    const before = this.source.slice(0, clamped);
    const line = (before.match(/\n/g)?.length ?? 0);
    const lastNewline = before.lastIndexOf('\n');
    const character = lastNewline === -1 ? clamped : clamped - lastNewline - 1;
    return { line, character };
  }

  /** Convert a 0-indexed LSP Position to a byte offset. */
  positionToOffset(pos: Position): number {
    let offset = 0;
    let line = 0;
    while (line < pos.line && offset < this.source.length) {
      if (this.source[offset] === '\n') line++;
      offset++;
    }
    return Math.min(offset + pos.character, this.source.length);
  }

  /** Return which top-level SFC block contains the given offset, or null if between blocks. */
  blockAtOffset(offset: number): BlockKind {
    const { script, template, styles } = this.descriptor;
    if (script !== null && offset >= script.start && offset <= script.end) return 'script';
    if (template !== null && offset >= template.start && offset <= template.end) return 'template';
    for (const style of styles) {
      if (offset >= style.start && offset <= style.end) return 'style';
    }
    return null;
  }

  /** Return the template SFCBlock if present. */
  get templateBlock(): SFCBlock | null {
    return this.descriptor.template;
  }

  /** Return the script SFCBlock if present. */
  get scriptBlock(): SFCBlock | null {
    return this.descriptor.script;
  }

  /**
   * Scan the script block for declared identifiers: signals, computed values,
   * effects, injected services, and functions. Used for template expression
   * completion suggestions.
   */
  scriptVariables(): string[] {
    const content = this.descriptor.script?.content ?? '';
    const names: string[] = [];

    // const X = signal(, computed(, effect(, inject(, formControl(, formGroup(, formArray(
    const reactiveRe = /\bconst\s+(\w+)\s*=\s*(?:signal|computed|effect|inject|formControl|formGroup|formArray)\s*[(<]/g;
    let m: RegExpExecArray | null;
    while ((m = reactiveRe.exec(content)) !== null) {
      const name = m[1];
      if (name !== undefined) names.push(name);
    }

    // const X = new SomeClass(
    const newRe = /\bconst\s+(\w+)\s*=\s*new\s+\w+/g;
    while ((m = newRe.exec(content)) !== null) {
      const name = m[1];
      if (name !== undefined) names.push(name);
    }

    // function X(
    const funcRe = /\bfunction\s+(\w+)\s*\(/g;
    while ((m = funcRe.exec(content)) !== null) {
      const name = m[1];
      if (name !== undefined) names.push(name);
    }

    // const X = (  or  const X: Type = (  — plain consts not matched above
    const constRe = /\bconst\s+(\w+)(?:\s*:\s*[^=]+)?\s*=/g;
    while ((m = constRe.exec(content)) !== null) {
      const name = m[1];
      if (name !== undefined && !names.includes(name)) names.push(name);
    }

    return names;
  }

  /**
   * Return the names of components imported in the script block.
   * Components are identified as default or named imports where the local
   * name starts with an uppercase letter.
   */
  importedComponents(): string[] {
    const content = this.descriptor.script?.content ?? '';
    const components: string[] = [];

    // default: import Comp from '...'
    const defaultRe = /^\s*import\s+([A-Z]\w*)\s+from\s+/gm;
    let m: RegExpExecArray | null;
    while ((m = defaultRe.exec(content)) !== null) {
      const name = m[1];
      if (name !== undefined) components.push(name);
    }

    // named: import { Foo, Bar as Baz } from '...'
    const namedRe = /^\s*import\s*\{([^}]+)\}\s*from\s+/gm;
    while ((m = namedRe.exec(content)) !== null) {
      const parts = m[1]?.split(',') ?? [];
      for (const part of parts) {
        const aliasM = /(\w+)\s+as\s+(\w+)/.exec(part.trim());
        const localName = aliasM ? aliasM[2] : part.trim().split(/\s+/)[0] ?? '';
        if (/^[A-Z]/.test(localName)) components.push(localName);
      }
    }

    return [...new Set(components)];
  }
}
