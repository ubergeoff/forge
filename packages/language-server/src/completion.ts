// =============================================================================
// @vorra/language-server — Completions
// Template directive, element, and attribute completions for .vorra files.
// =============================================================================

import type { CompletionItem } from 'vscode-languageserver';
import { CompletionItemKind } from 'vscode-languageserver';
import { VorraDocument } from './vorra-document';

// ---------------------------------------------------------------------------
// Data sets
// ---------------------------------------------------------------------------

const HTML_EVENTS: string[] = [
  'for', // @for directive (special — listed first for visibility)
  'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseover',
  'mouseout', 'mouseenter', 'mouseleave', 'contextmenu',
  'keydown', 'keyup', 'keypress',
  'focus', 'blur', 'focusin', 'focusout',
  'input', 'change', 'submit', 'reset', 'select',
  'scroll', 'resize', 'wheel',
  'load', 'unload', 'error', 'abort',
  'drag', 'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop',
  'touchstart', 'touchend', 'touchmove', 'touchcancel',
  'transitionend', 'animationend', 'animationstart', 'animationiteration',
  'pointerdown', 'pointerup', 'pointermove', 'pointerenter', 'pointerleave',
  'copy', 'cut', 'paste',
];

const HTML_ATTRS: string[] = [
  // Vorra directives first
  'show',
  // Common HTML attributes
  'href', 'src', 'class', 'id', 'style', 'title', 'alt', 'type', 'name',
  'value', 'placeholder', 'disabled', 'checked', 'readonly', 'required',
  'min', 'max', 'step', 'pattern', 'maxlength', 'minlength',
  'rows', 'cols', 'target', 'rel', 'action', 'method', 'enctype',
  'for', 'colspan', 'rowspan', 'width', 'height',
  'tabindex', 'autofocus', 'autocomplete', 'multiple', 'selected',
  'open', 'hidden', 'draggable', 'contenteditable', 'spellcheck',
  'lang', 'dir', 'role',
  'aria-label', 'aria-hidden', 'aria-expanded', 'aria-checked',
  'aria-selected', 'aria-disabled', 'aria-describedby', 'aria-labelledby',
  'data-id', 'data-value', 'data-index',
];

const DOM_PROPS: string[] = [
  'value', 'checked', 'disabled', 'readonly', 'required', 'selected',
  'multiple', 'innerHTML', 'innerText', 'textContent', 'outerHTML',
  'className', 'id', 'style', 'href', 'src', 'type', 'name',
  'placeholder', 'min', 'max', 'step', 'pattern', 'maxLength', 'minLength',
  'rows', 'cols', 'target', 'tabIndex', 'autofocus', 'autoComplete',
  'open', 'hidden', 'draggable', 'contentEditable',
  'scrollTop', 'scrollLeft', 'offsetWidth', 'offsetHeight',
  'clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight',
];

const HTML_ELEMENTS: string[] = [
  // Block elements
  'div', 'p', 'section', 'article', 'header', 'footer', 'main', 'aside',
  'nav', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'figure', 'figcaption', 'details', 'summary',
  'dialog', 'form', 'fieldset', 'legend',
  // Inline elements
  'span', 'a', 'em', 'strong', 'small', 'sub', 'sup', 'mark', 'del', 'ins',
  'q', 'abbr', 'dfn', 'time', 'var', 'samp', 'kbd', 'code', 'cite',
  'label', 'output',
  // Interactive elements
  'button', 'input', 'select', 'option', 'optgroup', 'textarea',
  // Media
  'img', 'video', 'audio', 'source', 'track', 'canvas', 'svg', 'picture',
  // Void elements
  'br', 'hr', 'link', 'meta',
];

// ---------------------------------------------------------------------------
// Context detection
// ---------------------------------------------------------------------------

/**
 * Return true if the cursor (absolute offset into `source`) is inside an
 * element opening tag's attribute zone within the template block.
 */
function isInTemplateTag(source: string, offset: number, doc: VorraDocument): boolean {
  const tpl = doc.templateBlock;
  if (tpl === null) return false;

  const templateEnd = tpl.end;
  if (offset < tpl.start || offset > templateEnd) return false;

  // Scan backwards from the cursor to find if there's an unclosed `<`
  const text = source.slice(tpl.start, Math.min(offset, templateEnd));
  let depth = 0;

  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '>') { depth++; }
    else if (ch === '<') {
      if (depth === 0) return true;
      depth--;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Provide completion items for the given cursor position.
 *
 * @param source      - Full .vorra source text.
 * @param uri         - Document URI.
 * @param offset      - Cursor byte offset.
 * @param triggerChar - The character that triggered completion (or undefined).
 */
export function getCompletions(
  source: string,
  uri: string,
  offset: number,
  triggerChar: string | undefined,
): CompletionItem[] {
  const doc = new VorraDocument(source, uri);
  const block = doc.blockAtOffset(offset);

  if (block === 'script' || block === 'style' || block === null) {
    return [];
  }

  // We're in the template block.
  switch (triggerChar) {
    case '@':
      if (isInTemplateTag(source, offset, doc)) {
        return eventCompletions();
      }
      return [];

    case ':':
      if (isInTemplateTag(source, offset, doc)) {
        return attrCompletions();
      }
      return [];

    case '.':
      if (isInTemplateTag(source, offset, doc)) {
        return propCompletions();
      }
      return [];

    case '[':
      if (isInTemplateTag(source, offset, doc)) {
        return [formControlCompletion()];
      }
      return [];

    case '<':
      return elementCompletions(doc);

    default:
      // Non-trigger invocation — offer everything based on context.
      if (isInTemplateTag(source, offset, doc)) {
        return [...eventCompletions(), ...attrCompletions(), ...propCompletions(), formControlCompletion()];
      }
      return elementCompletions(doc);
  }
}

// ---------------------------------------------------------------------------
// Completion item builders
// ---------------------------------------------------------------------------

function eventCompletions(): CompletionItem[] {
  return HTML_EVENTS.map(name => ({
    label: name,
    kind: CompletionItemKind.Event,
    detail: name === 'for' ? 'Vorra list rendering directive' : `@${name} — DOM event`,
    insertText: name === 'for' ? 'for={${1:item} of ${2:items()}}' : `${name}={$1}`,
    insertTextFormat: 2, // Snippet
  }));
}

function attrCompletions(): CompletionItem[] {
  return HTML_ATTRS.map(name => ({
    label: name,
    kind: CompletionItemKind.Property,
    detail: name === 'show' ? ':show — Vorra visibility directive' : `:${name} — attribute binding`,
    insertText: `${name}={$1}`,
    insertTextFormat: 2,
  }));
}

function propCompletions(): CompletionItem[] {
  return DOM_PROPS.map(name => ({
    label: name,
    kind: CompletionItemKind.Property,
    detail: `.${name} — DOM property binding`,
    insertText: `${name}={$1}`,
    insertTextFormat: 2,
  }));
}

function formControlCompletion(): CompletionItem {
  return {
    label: 'formControl]',
    kind: CompletionItemKind.Keyword,
    detail: '[formControl] — two-way form control binding',
    insertText: 'formControl]={$1}',
    insertTextFormat: 2,
  };
}

function elementCompletions(doc: VorraDocument): CompletionItem[] {
  const components = doc.importedComponents().map(name => ({
    label: name,
    kind: CompletionItemKind.Class,
    detail: `${name} — imported Vorra component`,
    insertText: `${name} />`,
    insertTextFormat: 2,
  }));

  const elements = HTML_ELEMENTS.map(name => ({
    label: name,
    kind: CompletionItemKind.Property,
    detail: `<${name}> — HTML element`,
    insertText: `${name}>$0</${name}>`,
    insertTextFormat: 2,
  }));

  return [...components, ...elements];
}
