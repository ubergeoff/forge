// =============================================================================
// @forge/compiler/browser — Browser-safe entry point
// Exports parseSFC + compileSFC pre-configured with the regex TS stripper.
// Does NOT export the Rolldown plugin (plugin.ts uses node:fs / node:path).
// Imports ONLY from parser.ts and compiler-shared.ts — never from compiler.ts
// (which pulls in node:module via createRequire).
// =============================================================================

export { parseSFC } from './parser.js';
export { regexStripTypeScript, extractScriptParts } from './compiler-shared.js';

export type { SFCDescriptor, SFCBlock } from './parser.js';
export type { CompileResult, CompileError, StyleResult, StripTypeScriptFn } from './compiler-shared.js';

import type { SFCDescriptor } from './parser.js';
import type { CompileResult } from './compiler-shared.js';
import { compileSFC as _compileSFC, regexStripTypeScript } from './compiler-shared.js';

/** Browser-safe compileSFC — uses the regex TS stripper instead of oxc-transform. */
export function compileSFC(descriptor: SFCDescriptor): CompileResult {
  return _compileSFC(descriptor, regexStripTypeScript);
}
