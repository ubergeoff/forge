import { describe, it, expect } from 'vitest';
import { getCompletions } from '../src/completion.js';
import { CompletionItemKind } from 'vscode-languageserver';

const TEST_URI = 'file:///test/Component.vorra';

// Helper: build a .vorra source and return the offset of the LAST occurrence of
// a marker string. Uses lastIndexOf so markers like '@' resolve to the
// template occurrence, not to the script import '@vorra/core'.
function sourceWithOffset(template: string, marker: string): { source: string; offset: number } {
  const source = [
    '<script>',
    "import { signal } from '@vorra/core';",
    'const count = signal(0);',
    '</script>',
    '<template>',
    `  ${template}`,
    '</template>',
  ].join('\n');
  const idx = source.lastIndexOf(marker);
  const offset = idx + marker.length;
  return { source, offset };
}

describe('getCompletions', () => {
  describe('event completions (@)', () => {
    it('suggests HTML event names after @', () => {
      const { source, offset } = sourceWithOffset('<button @', '@');
      const items = getCompletions(source, TEST_URI, offset, '@');
      const labels = items.map(i => i.label);
      expect(labels).toContain('click');
      expect(labels).toContain('input');
      expect(labels).toContain('change');
      expect(labels).toContain('submit');
    });

    it('includes @for as a completion', () => {
      const { source, offset } = sourceWithOffset('<li @', '@');
      const items = getCompletions(source, TEST_URI, offset, '@');
      const labels = items.map(i => i.label);
      expect(labels).toContain('for');
    });

    it('returns event completions with Event kind', () => {
      const { source, offset } = sourceWithOffset('<div @', '@');
      const items = getCompletions(source, TEST_URI, offset, '@');
      const clickItem = items.find(i => i.label === 'click');
      expect(clickItem?.kind).toBe(CompletionItemKind.Event);
    });

    it('returns no event completions outside a template tag', () => {
      const source = '<template><div>@</div></template>';
      const offset = source.indexOf('@') + 1;
      // The @ is inside text content, not inside a tag attribute position
      const items = getCompletions(source, TEST_URI, offset, '@');
      expect(items).toHaveLength(0);
    });
  });

  describe('attribute completions (:)', () => {
    it('suggests HTML attribute names after :', () => {
      const { source, offset } = sourceWithOffset('<div :', ':');
      const items = getCompletions(source, TEST_URI, offset, ':');
      const labels = items.map(i => i.label);
      expect(labels).toContain('show');
      expect(labels).toContain('href');
      expect(labels).toContain('class');
      expect(labels).toContain('id');
    });

    it('returns attribute completions with Property kind', () => {
      const { source, offset } = sourceWithOffset('<div :', ':');
      const items = getCompletions(source, TEST_URI, offset, ':');
      const showItem = items.find(i => i.label === 'show');
      expect(showItem?.kind).toBe(CompletionItemKind.Property);
    });
  });

  describe('property completions (.)', () => {
    it('suggests DOM property names after .', () => {
      const { source, offset } = sourceWithOffset('<input .', '.');
      const items = getCompletions(source, TEST_URI, offset, '.');
      const labels = items.map(i => i.label);
      expect(labels).toContain('value');
      expect(labels).toContain('checked');
      expect(labels).toContain('disabled');
    });
  });

  describe('formControl completion ([)', () => {
    it('suggests formControl after [', () => {
      const { source, offset } = sourceWithOffset('<input [', '[');
      const items = getCompletions(source, TEST_URI, offset, '[');
      expect(items).toHaveLength(1);
      expect(items[0]?.label).toBe('formControl]');
      expect(items[0]?.kind).toBe(CompletionItemKind.Keyword);
    });
  });

  describe('element completions (<)', () => {
    // Helper: find the offset of '<' inside the template content (not the
    // opening <template> or the closing </template> tag).
    function innerAngle(source: string): number {
      const tplStart = source.indexOf('<template>') + '<template>'.length;
      const pos = source.indexOf('<', tplStart); // first '<' inside template
      return pos + 1; // offset after the '<'
    }

    it('suggests HTML elements after <', () => {
      const source = '<template><</template>';
      const offset = innerAngle(source);
      const items = getCompletions(source, TEST_URI, offset, '<');
      const labels = items.map(i => i.label);
      expect(labels).toContain('div');
      expect(labels).toContain('span');
      expect(labels).toContain('button');
      expect(labels).toContain('input');
      expect(labels).toContain('ul');
      expect(labels).toContain('li');
    });

    it('includes imported component names in element completions', () => {
      const source = [
        '<script>',
        "import MyButton from './MyButton.vorra';",
        '</script>',
        '<template><</template>',
      ].join('\n');
      const offset = innerAngle(source);
      const items = getCompletions(source, TEST_URI, offset, '<');
      const labels = items.map(i => i.label);
      expect(labels).toContain('MyButton');
    });

    it('marks components with Class kind', () => {
      const source = [
        '<script>',
        "import MyCard from './MyCard.vorra';",
        '</script>',
        '<template><</template>',
      ].join('\n');
      const offset = innerAngle(source);
      const items = getCompletions(source, TEST_URI, offset, '<');
      const cardItem = items.find(i => i.label === 'MyCard');
      expect(cardItem?.kind).toBe(CompletionItemKind.Class);
    });
  });

  describe('block awareness', () => {
    it('returns no completions when cursor is in the script block', () => {
      const source = '<script>const x = @</script><template><div></div></template>';
      const offset = source.indexOf('@') + 1;
      const items = getCompletions(source, TEST_URI, offset, '@');
      expect(items).toHaveLength(0);
    });

    it('returns no completions when cursor is in a style block', () => {
      const source = '<template><div></div></template><style>div { color: }</style>';
      const offset = source.indexOf('color: ') + 'color: '.length;
      const items = getCompletions(source, TEST_URI, offset, ':');
      expect(items).toHaveLength(0);
    });
  });
});
