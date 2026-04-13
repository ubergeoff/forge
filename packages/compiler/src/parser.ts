// =============================================================================
// @forge/compiler — SFC Parser (Step 4)
// Splits a raw .forge source file into typed block descriptors.
// =============================================================================

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SFCBlock {
  /** The block kind. */
  type: 'script' | 'template' | 'style';
  /** Raw inner content of the block (between opening and closing tag). */
  content: string;
  /** Parsed attributes from the opening tag. Boolean attributes map to `true`. */
  attrs: Record<string, string | true>;
  /**
   * Source offsets — both relative to the start of the full source string.
   * `start` points to the first character of `content` (after `>`).
   * `end` points to the first character of the closing tag (`</…>`).
   */
  start: number;
  end: number;
}

export interface SFCDescriptor {
  script: SFCBlock | null;
  template: SFCBlock | null;
  /** Ordered list of `<style>` blocks (a file may have multiple). */
  styles: SFCBlock[];
  filename: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parses the raw attribute string from an opening tag into a key→value map.
 *
 * Handles:
 *   - `lang="ts"`  →  `{ lang: "ts" }`
 *   - `lang='ts'`  →  `{ lang: "ts" }`
 *   - `scoped`     →  `{ scoped: true }`
 */
function parseAttrs(raw: string): Record<string, string | true> {
  const attrs: Record<string, string | true> = {};
  // Matches: name="val" | name='val' | name=bare | name
  const re = /([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const name = m[1];
    if (name === undefined) continue;
    // dq → double-quoted, sq → single-quoted, bare → unquoted value
    const value: string | true = m[2] ?? m[3] ?? m[4] ?? true;
    attrs[name] = value;
  }
  return attrs;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a raw `.forge` SFC source string into a structured descriptor.
 *
 * A `.forge` file may contain up to one `<script>` block, one `<template>`
 * block, and any number of `<style>` blocks, in any order. Blocks that are
 * absent produce `null` (script/template) or an empty array (styles).
 *
 * @param source   - The full text of a `.forge` file.
 * @param filename - The file path / name (stored on the descriptor for
 *                   downstream error reporting).
 *
 * @throws {Error} if a top-level block tag is opened but never closed.
 */
export function parseSFC(source: string, filename: string): SFCDescriptor {
  const descriptor: SFCDescriptor = {
    script: null,
    template: null,
    styles: [],
    filename,
  };

  // Matches the opening tag of any of the three top-level block types.
  // Group 1: tag name; Group 2: raw attribute string (may be empty).
  const openRe = /<(script|template|style)((?:\s[^>]*)?)\s*>/g;

  let m: RegExpExecArray | null;
  while ((m = openRe.exec(source)) !== null) {
    const fullOpenTag = m[0];
    const tagName = m[1] as SFCBlock['type'];
    const rawAttrs = m[2] ?? '';

    // Content starts right after the closing `>` of the opening tag.
    const contentStart = m.index + fullOpenTag.length;

    const closeTag = `</${tagName}>`;
    const closeIdx = source.indexOf(closeTag, contentStart);

    if (closeIdx === -1) {
      throw new Error(
        `[Forge Parser] Unclosed <${tagName}> block in "${filename}". ` +
          `Add a closing </${tagName}> tag.`,
      );
    }

    const block: SFCBlock = {
      type: tagName,
      content: source.slice(contentStart, closeIdx),
      attrs: parseAttrs(rawAttrs.trim()),
      start: contentStart,
      end: closeIdx,
    };

    if (tagName === 'script') {
      descriptor.script = block;
    } else if (tagName === 'template') {
      descriptor.template = block;
    } else {
      descriptor.styles.push(block);
    }

    // Advance the regex past the entire block so we don't re-enter it.
    openRe.lastIndex = closeIdx + closeTag.length;
  }

  return descriptor;
}
