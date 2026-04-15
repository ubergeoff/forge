import { describe, it, expect } from 'vitest';
import { runDiagnostics } from '../src/diagnostics.js';
import { DiagnosticSeverity } from 'vscode-languageserver';

const TEST_URI = 'file:///test/Component.vorra';

describe('runDiagnostics', () => {
  it('returns no diagnostics for a minimal valid component', () => {
    const source = [
      '<script lang="ts">',
      "import { signal } from '@vorra/core';",
      'const count = signal(0);',
      'function increment() { count.update(n => n + 1); }',
      '</script>',
      '<template>',
      '  <div>',
      '    <button @click={increment}>+</button>',
      '    <span>{count()}</span>',
      '  </div>',
      '</template>',
    ].join('\n');

    const result = runDiagnostics(source, TEST_URI);
    expect(result).toHaveLength(0);
  });

  it('reports an error when the template has no root element', () => {
    const source = '<template>  </template>';
    const result = runDiagnostics(source, TEST_URI);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.severity).toBe(DiagnosticSeverity.Error);
    expect(result[0]?.message).toMatch(/root element/i);
  });

  it('reports a warning when there is no template block', () => {
    const source = '<script>const x = 1;</script>';
    const result = runDiagnostics(source, TEST_URI);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.severity).toBe(DiagnosticSeverity.Warning);
    expect(result[0]?.message).toMatch(/template/i);
  });

  it('reports a warning when the template has multiple root elements', () => {
    const source = [
      '<template>',
      '  <div>first</div>',
      '  <div>second</div>',
      '</template>',
    ].join('\n');
    const result = runDiagnostics(source, TEST_URI);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.severity).toBe(DiagnosticSeverity.Warning);
    expect(result[0]?.message).toMatch(/multiple root/i);
  });

  it('reports an error for unclosed top-level SFC block', () => {
    // parseSFC throws when a top-level block is not closed
    const source = '<template><div>hello</div>';
    const result = runDiagnostics(source, TEST_URI);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.severity).toBe(DiagnosticSeverity.Error);
  });

  it('reports an error for an invalid @for expression', () => {
    const source = [
      '<template>',
      '  <li @for={badExpression}>{item}</li>',
      '</template>',
    ].join('\n');
    const result = runDiagnostics(source, TEST_URI);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.severity).toBe(DiagnosticSeverity.Error);
    expect(result[0]?.message).toMatch(/@for/i);
  });

  it('returns a valid LSP Range with 0-indexed positions', () => {
    const source = '<template>  </template>';
    const result = runDiagnostics(source, TEST_URI);
    expect(result.length).toBeGreaterThan(0);
    const range = result[0]?.range;
    expect(range).toBeDefined();
    expect(range?.start.line).toBeGreaterThanOrEqual(0);
    expect(range?.start.character).toBeGreaterThanOrEqual(0);
  });

  it('returns no diagnostics for a component without a script block', () => {
    const source = [
      '<template>',
      '  <div>Hello, World!</div>',
      '</template>',
    ].join('\n');
    const result = runDiagnostics(source, TEST_URI);
    expect(result).toHaveLength(0);
  });

  it('handles an empty file gracefully', () => {
    const result = runDiagnostics('', TEST_URI);
    // No template → warning
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.severity).toBe(DiagnosticSeverity.Warning);
  });

  it('includes source: "vorra" on all diagnostics', () => {
    const source = '<template>  </template>';
    const result = runDiagnostics(source, TEST_URI);
    for (const diag of result) {
      expect(diag.source).toBe('vorra');
    }
  });
});
