// =============================================================================
// @vorra/language-server — Document Symbols
// Builds an outline of reactive primitives and functions from the script block.
// =============================================================================

import type { DocumentSymbol } from 'vscode-languageserver';
import { SymbolKind } from 'vscode-languageserver';
import { VorraDocument } from './vorra-document';

interface SymbolPattern {
  re: RegExp;
  kind: SymbolKind;
  detail: string;
}

const SYMBOL_PATTERNS: SymbolPattern[] = [
  { re: /\bconst\s+(\w+)\s*=\s*signal\s*\(/g,      kind: SymbolKind.Variable, detail: 'signal' },
  { re: /\bconst\s+(\w+)\s*=\s*computed\s*\(/g,    kind: SymbolKind.Variable, detail: 'computed' },
  { re: /\bconst\s+(\w+)\s*=\s*effect\s*\(/g,      kind: SymbolKind.Variable, detail: 'effect' },
  { re: /\bconst\s+(\w+)\s*=\s*inject\s*\(/g,      kind: SymbolKind.Variable, detail: 'inject' },
  { re: /\bconst\s+(\w+)\s*=\s*formControl\s*\(/g, kind: SymbolKind.Variable, detail: 'formControl' },
  { re: /\bconst\s+(\w+)\s*=\s*formGroup\s*\(/g,   kind: SymbolKind.Variable, detail: 'formGroup' },
  { re: /\bconst\s+(\w+)\s*=\s*formArray\s*\(/g,   kind: SymbolKind.Variable, detail: 'formArray' },
  { re: /\bfunction\s+(\w+)\s*\(/g,                kind: SymbolKind.Function,  detail: 'function' },
];

/**
 * Return a flat list of DocumentSymbols for the script block of a .vorra file.
 * Includes signals, computed values, effects, injected services, and functions.
 */
export function getDocumentSymbols(source: string, uri: string): DocumentSymbol[] {
  const doc = new VorraDocument(source, uri);
  const scriptBlock = doc.scriptBlock;
  if (scriptBlock === null) return [];

  const symbols: DocumentSymbol[] = [];
  const content = scriptBlock.content;
  const blockStart = scriptBlock.start;

  // Track names to avoid duplicates (e.g., if a name matches multiple patterns).
  const seen = new Set<string>();

  for (const { re, kind, detail } of SYMBOL_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const name = m[1];
      if (name === undefined || seen.has(name)) continue;
      seen.add(name);

      // Offset of the identifier within the content string.
      const identOffset = (m.index ?? 0) + (m[0]?.length ?? 0) - name.length;
      const absoluteOffset = blockStart + identOffset;

      const startPos = doc.offsetToPosition(absoluteOffset);
      const endPos = doc.offsetToPosition(absoluteOffset + name.length);

      symbols.push({
        name,
        detail,
        kind,
        range: {
          start: startPos,
          end: endPos,
        },
        selectionRange: {
          start: startPos,
          end: endPos,
        },
      });
    }
  }

  // Sort symbols by their line position for a logical outline order.
  symbols.sort((a, b) => a.range.start.line - b.range.start.line);

  return symbols;
}
