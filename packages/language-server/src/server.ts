// =============================================================================
// @vorra/language-server — LSP Server Entry Point
// Provides diagnostics, completions, hover, and document symbols for .vorra
// Single File Components.
//
// Transports supported (determined automatically from process.argv):
//   --stdio  — stdin/stdout (VS Code, WebStorm, any LSP client)
//   (default) — falls back to stdio
//
// Launch:
//   node dist/server.js --stdio
// =============================================================================

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeResult,
  TextDocumentSyncKind,
  DiagnosticSeverity,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { runDiagnostics } from './diagnostics';
import { getCompletions } from './completion';
import { getHover } from './hover';
import { getDocumentSymbols } from './symbols';

// ---------------------------------------------------------------------------
// Connection + document store
// ---------------------------------------------------------------------------

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

connection.onInitialize((_params): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: {
        triggerCharacters: ['@', ':', '.', '[', '<'],
        resolveProvider: false,
      },
      hoverProvider: true,
      documentSymbolProvider: true,
    },
    serverInfo: {
      name: 'vorra-language-server',
      version: '0.1.0',
    },
  };
});

connection.onInitialized(() => {
  connection.console.log('[Vorra LSP] Server initialized.');
});

// ---------------------------------------------------------------------------
// Diagnostics — push on open + every change
// ---------------------------------------------------------------------------

documents.onDidChangeContent(({ document }) => {
  pushDiagnostics(document);
});

documents.onDidClose(({ document }) => {
  // Clear diagnostics when a file is closed.
  connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
});

function pushDiagnostics(document: TextDocument): void {
  const source = document.getText();
  try {
    const diagnostics = runDiagnostics(source, document.uri);
    connection.sendDiagnostics({ uri: document.uri, diagnostics });
  } catch (err) {
    // Never crash the server over a single file's diagnostics.
    connection.console.error(`[Vorra LSP] Diagnostics error for ${document.uri}: ${String(err)}`);
    connection.sendDiagnostics({
      uri: document.uri,
      diagnostics: [{
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        message: `[Vorra LSP] Internal error: ${String(err)}`,
        severity: DiagnosticSeverity.Error,
        source: 'vorra',
      }],
    });
  }
}

// ---------------------------------------------------------------------------
// Completions
// ---------------------------------------------------------------------------

connection.onCompletion((params) => {
  const document = documents.get(params.textDocument.uri);
  if (document === undefined) return [];

  const source = document.getText();
  const offset = document.offsetAt(params.position);
  const triggerChar = params.context?.triggerCharacter;

  try {
    return getCompletions(source, document.uri, offset, triggerChar);
  } catch (err) {
    connection.console.error(`[Vorra LSP] Completion error: ${String(err)}`);
    return [];
  }
});

// ---------------------------------------------------------------------------
// Hover
// ---------------------------------------------------------------------------

connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (document === undefined) return null;

  const source = document.getText();
  const offset = document.offsetAt(params.position);

  try {
    return getHover(source, document.uri, offset);
  } catch (err) {
    connection.console.error(`[Vorra LSP] Hover error: ${String(err)}`);
    return null;
  }
});

// ---------------------------------------------------------------------------
// Document Symbols (outline)
// ---------------------------------------------------------------------------

connection.onDocumentSymbol((params) => {
  const document = documents.get(params.textDocument.uri);
  if (document === undefined) return [];

  const source = document.getText();

  try {
    return getDocumentSymbols(source, document.uri);
  } catch (err) {
    connection.console.error(`[Vorra LSP] Symbol error: ${String(err)}`);
    return [];
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

documents.listen(connection);
connection.listen();
