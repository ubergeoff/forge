// =============================================================================
// @forge/compiler — Node.js compiler entry point
// Adds oxc-transform-based TypeScript stripping on top of compiler-shared.ts.
// NOT browser-safe: imports node:module for createRequire.
// =============================================================================

import { createRequire } from 'node:module';
import type { SFCDescriptor } from './parser.js';

export type { CompileResult, CompileError, StyleResult, StripTypeScriptFn } from './compiler-shared.js';
export { regexStripTypeScript, extractScriptParts } from './compiler-shared.js';
import type { StripTypeScriptFn, CompileResult, CompileError } from './compiler-shared.js';
import { compileSFC as _compileSFC } from './compiler-shared.js';

// ---------------------------------------------------------------------------
// oxc-transform TypeScript stripper (Node.js only)
// ---------------------------------------------------------------------------

type OxcErrorLabel = { span: { start: number; end: number }; message: string };
type OxcError = { message: string; severity?: string; labels?: OxcErrorLabel[]; helpMessage?: string };

let _oxcTransformSync:
  | ((filename: string, source: string, options: object) => { code: string; errors: OxcError[] })
  | undefined;

function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  const clamped = Math.min(offset, source.length);
  const before = source.slice(0, clamped);
  const line = (before.match(/\n/g)?.length ?? 0) + 1;
  const column = clamped - before.lastIndexOf('\n');
  return { line, column };
}

/**
 * Default TypeScript stripper: lazily loads oxc-transform via CJS require.
 * Node.js only — throws if the package is not installed.
 */
export const oxcStripTypeScript: StripTypeScriptFn = (source, filename) => {
  if (_oxcTransformSync === undefined) {
    const _require = createRequire(import.meta.url);
    try {
      const mod = _require('oxc-transform') as { transformSync: typeof _oxcTransformSync };
      _oxcTransformSync = mod.transformSync;
    } catch {
      throw new Error(
        `[Forge Compiler] TypeScript stripping requires the 'oxc-transform' package.\n` +
        `Run: npm install oxc-transform`,
      );
    }
  }

  const tsFilename = filename.replace(/\.forge$/i, '') + '.ts';
  const result = _oxcTransformSync!(tsFilename, source, {
    typescript: { onlyRemoveTypeImports: true },
  });

  const errors: CompileError[] = result.errors.map(e => {
    const span = e.labels?.[0]?.span;
    if (span !== undefined) {
      const { line, column } = offsetToLineCol(source, span.start);
      const hint = e.helpMessage ? `\n  Hint: ${e.helpMessage}` : '';
      return { message: `[Script] Line ${line}:${column} — ${e.message}${hint}`, line, column };
    }
    return { message: `[Script] ${e.message}` };
  });

  return { code: result.code ?? source, errors };
};

// ---------------------------------------------------------------------------
// Public: compileSFC (Node.js default — uses oxc-transform)
// ---------------------------------------------------------------------------

/**
 * Compiles a parsed `.forge` SFCDescriptor into a JavaScript module string.
 * Uses oxc-transform for TypeScript stripping by default (Node.js only).
 * For browser use, import from `@forge/compiler/browser` instead.
 */
export function compileSFC(
  descriptor: SFCDescriptor,
  stripTypeScript: StripTypeScriptFn = oxcStripTypeScript,
): CompileResult {
  return _compileSFC(descriptor, stripTypeScript);
}
