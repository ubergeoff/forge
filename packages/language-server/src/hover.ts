// =============================================================================
// @vorra/language-server — Hover
// Provides documentation hover cards for Vorra template directives.
// =============================================================================

import type { Hover } from 'vscode-languageserver';
import { MarkupKind } from 'vscode-languageserver';
import { VorraDocument } from './vorra-document';

// ---------------------------------------------------------------------------
// Directive documentation
// ---------------------------------------------------------------------------

interface DirectiveDoc {
  /** Pattern to match (checked against the word at the cursor position). */
  pattern: RegExp;
  /** Markdown documentation string. */
  docs: string;
}

const DIRECTIVE_DOCS: DirectiveDoc[] = [
  {
    pattern: /^@for$/,
    docs: [
      '**`@for` — List Rendering**',
      '',
      'Renders the element once for each item in a reactive list.',
      '',
      '```html',
      '<li @for={item of items()}>',
      '  {item.name}',
      '</li>',
      '```',
      '',
      'The iterable expression is called reactively — the list updates automatically',
      'when the underlying signal changes.',
    ].join('\n'),
  },
  {
    pattern: /^@\w+$/,
    docs: [
      '**`@event` — Event Binding**',
      '',
      'Attaches a DOM event listener to the element.',
      '',
      '```html',
      '<button @click={increment}>+</button>',
      '<input @input={handleInput} @blur={markTouched} />',
      '```',
      '',
      'The expression can be a function reference or an inline arrow function.',
    ].join('\n'),
  },
  {
    pattern: /^:show$/,
    docs: [
      '**`:show` — Visibility Toggle**',
      '',
      'Conditionally shows or hides the element by toggling `display: none`.',
      'The element remains in the DOM.',
      '',
      '```html',
      '<p :show={isVisible()}>Visible when signal is truthy</p>',
      '```',
      '',
      'The expression is called reactively and coerced to boolean.',
    ].join('\n'),
  },
  {
    pattern: /^:\w+$/,
    docs: [
      '**`:attr` — Attribute Binding**',
      '',
      'Reactively sets a DOM attribute. When the expression returns `null`,',
      'the attribute is removed from the element.',
      '',
      '```html',
      '<a :href={url()}>Link</a>',
      '<div :class={computedClass()}></div>',
      '```',
      '',
      'Use `.prop` instead for DOM properties like `value` or `checked`.',
    ].join('\n'),
  },
  {
    pattern: /^\.\w+$/,
    docs: [
      '**`.prop` — DOM Property Binding**',
      '',
      'Reactively sets a DOM property (not an HTML attribute).',
      '',
      '```html',
      '<input .value={name()} />',
      '<input type="checkbox" .checked={isActive()} />',
      '<button .disabled={isLoading()}>Submit</button>',
      '```',
      '',
      'Use `.prop` for boolean properties and properties whose attribute',
      'names differ from their property names.',
    ].join('\n'),
  },
  {
    pattern: /^\[formControl\]$/,
    docs: [
      '**`[formControl]` — Form Control Binding**',
      '',
      'Two-way binding for `formControl` instances from `@vorra/forms`.',
      '',
      '```html',
      '<input [formControl]={email} type="email" />',
      '<input [formControl]={agree} type="checkbox" />',
      '```',
      '',
      'Automatically handles value coercion based on the `type` attribute:',
      '- `text`, `email`, `password` → string value',
      '- `number`, `range` → numeric value',
      '- `checkbox` → boolean checked state',
      '',
      'Also calls `markAsTouched()` on `blur`.',
    ].join('\n'),
  },
  {
    pattern: /^class:\w+$/,
    docs: [
      '**`class:name` — Conditional Class Binding**',
      '',
      'Toggles a CSS class name based on a reactive boolean expression.',
      '',
      '```html',
      '<div class:active={isActive()} class:error={hasError()}></div>',
      '```',
      '',
      'Multiple `class:` bindings on the same element are merged.',
      'The expression is coerced to boolean.',
    ].join('\n'),
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return a hover card if the cursor is positioned on a Vorra template directive.
 * Returns null if the position is not on a recognizable directive.
 */
export function getHover(source: string, uri: string, offset: number): Hover | null {
  const doc = new VorraDocument(source, uri);
  const block = doc.blockAtOffset(offset);

  if (block !== 'template') return null;

  const word = extractWordAt(source, offset);
  if (word === null) return null;

  for (const entry of DIRECTIVE_DOCS) {
    if (entry.pattern.test(word)) {
      return {
        contents: { kind: MarkupKind.Markdown, value: entry.docs },
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the "word" at the cursor position in the context of Vorra template
 * attribute names. A word here can contain `@`, `:`, `.`, `[`, `]`, letters,
 * digits, and hyphens/underscores.
 */
function extractWordAt(source: string, offset: number): string | null {
  // Define a broad character class for directive token characters.
  const tokenRe = /[@:.[\]a-zA-Z0-9_-]/;

  let start = offset;
  while (start > 0 && tokenRe.test(source[start - 1] ?? '')) start--;

  let end = offset;
  while (end < source.length && tokenRe.test(source[end] ?? '')) end++;

  const word = source.slice(start, end).trim();
  return word.length > 0 ? word : null;
}
