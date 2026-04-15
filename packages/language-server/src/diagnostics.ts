// =============================================================================
// @vorra/language-server — Diagnostics
// Runs parseSFC + compileSFC and converts errors/warnings to LSP Diagnostics.
// =============================================================================

import { compileSFC } from '@vorra/compiler';
import type { CompileError } from '@vorra/compiler';
import type { Diagnostic } from 'vscode-languageserver';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { VorraDocument } from './vorra-document';

// Pass the script block through unmodified — TypeScript errors are handled by
// VS Code's built-in TypeScript language service; we focus on template errors.
const passthroughTs = (source: string, _filename: string): { code: string; errors: CompileError[] } => ({
  code: source,
  errors: [],
});

/**
 * Run all Vorra compiler diagnostics on the given source and return LSP
 * Diagnostic objects. Diagnostics include:
 *   - SFC parse errors (unclosed blocks)
 *   - Template compiler errors (bad @for, missing root, etc.)
 *   - Template compiler warnings (no template block, multiple roots)
 */
export function runDiagnostics(source: string, uri: string): Diagnostic[] {
  const doc = new VorraDocument(source, uri);

  // If parseSFC threw (e.g. unclosed <template> block), report at file start.
  if (doc.parseError !== null) {
    return [makeDiagnostic(doc.parseError, DiagnosticSeverity.Error, 0, 0)];
  }

  let result;
  try {
    result = compileSFC(doc.descriptor, passthroughTs);
  } catch (err) {
    // Uncaught compiler error (e.g. invalid @for expression in the template).
    const message = err instanceof Error ? err.message : String(err);
    const start = doc.templateBlock ? doc.offsetToPosition(doc.templateBlock.start) : { line: 0, character: 0 };
    return [makeDiagnostic(message, DiagnosticSeverity.Error, start.line, start.character)];
  }

  const diagnostics: Diagnostic[] = [];

  for (const error of result.errors) {
    diagnostics.push(compileErrorToDiagnostic(error, DiagnosticSeverity.Error, doc));
  }
  for (const warning of result.warnings) {
    diagnostics.push(compileErrorToDiagnostic(warning, DiagnosticSeverity.Warning, doc));
  }

  return diagnostics;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compileErrorToDiagnostic(
  error: CompileError,
  severity: DiagnosticSeverity,
  doc: VorraDocument,
): Diagnostic {
  if (error.line !== undefined && error.column !== undefined) {
    // Compiler gives 1-indexed line/column relative to the script content.
    // Convert to 0-indexed absolute file position.
    const scriptStart = doc.scriptBlock?.start ?? 0;
    const scriptContent = doc.scriptBlock?.content ?? doc.source;
    const absoluteOffset = scriptStart + lineColToOffset(scriptContent, error.line, error.column);
    const pos = doc.offsetToPosition(absoluteOffset);
    return makeDiagnostic(error.message, severity, pos.line, pos.character);
  }

  // No position info — place the diagnostic at the most relevant block start.
  const isTemplateError =
    error.message.includes('[Vorra Compiler]') || error.message.includes('<template>');

  if (isTemplateError && doc.templateBlock !== null) {
    const pos = doc.offsetToPosition(doc.templateBlock.start);
    return makeDiagnostic(error.message, severity, pos.line, pos.character);
  }

  return makeDiagnostic(error.message, severity, 0, 0);
}

function makeDiagnostic(
  message: string,
  severity: DiagnosticSeverity,
  line: number,
  character: number,
): Diagnostic {
  return {
    range: {
      start: { line, character },
      end: { line, character: character + 1 },
    },
    message,
    severity,
    source: 'vorra',
  };
}

/** Convert 1-indexed line/column within a string to a byte offset. */
function lineColToOffset(source: string, line: number, column: number): number {
  let offset = 0;
  let currentLine = 1;
  while (currentLine < line && offset < source.length) {
    if (source[offset] === '\n') currentLine++;
    offset++;
  }
  return offset + column - 1;
}
