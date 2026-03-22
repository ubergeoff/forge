// =============================================================================
// @forge/compiler — Rolldown Plugin (Step 6)
// Wires the SFC parser + template compiler into the Rolldown build pipeline.
// CSS and SCSS support:
//   - <style> and <style lang="scss"> blocks in .forge files are extracted,
//     compiled (if SCSS), and injected via a virtual CSS module.
//   - <style scoped> stamps data-v-{scopeId} on every template element and
//     rewrites CSS selectors to match.
//   - Standalone .scss files are compiled to CSS by the transform hook.
//   - Imported .css files are processed through PostCSS when configured.
//   - Optional PostCSS support enables Tailwind CSS and other PostCSS plugins.
// =============================================================================

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { parseSFC } from './parser.js';
import { compileSFC } from './compiler.js';

// ---------------------------------------------------------------------------
// Plugin options
// ---------------------------------------------------------------------------

/**
 * Options for the Forge Rolldown plugin.
 */
export interface ForgePluginOptions {
  /**
   * Optional PostCSS configuration. When provided, all CSS (including
   * `<style>` blocks in `.forge` files and imported `.css` files) is
   * processed through PostCSS before injection. Required for Tailwind CSS
   * and other PostCSS plugins.
   *
   * @example
   * ```ts
   * import tailwindcss from 'tailwindcss';
   * import autoprefixer from 'autoprefixer';
   *
   * forgePlugin({ postcss: { plugins: [tailwindcss(), autoprefixer()] } })
   * ```
   */
  postcss?: {
    plugins: unknown[];
  };
}

// ---------------------------------------------------------------------------
// Minimal plugin interface (Rolldown / Rollup compatible)
// ---------------------------------------------------------------------------

/**
 * The subset of the Rolldown/Rollup plugin interface used by the Forge plugin.
 * Kept minimal so this package does not need a hard dep on rolldown's types.
 * `transform` is always async to support optional PostCSS processing.
 */
export interface ForgePluginObject {
  name: string;
  resolveId(id: string): string | null;
  load(id: string): { code: string } | null;
  transform(
    code: string,
    id: string,
  ): Promise<{ code: string; map?: string } | null | undefined>;
}

// ---------------------------------------------------------------------------
// Virtual module prefix (kept for resolveId/load of standalone .scss files)
// ---------------------------------------------------------------------------

/** Prefix that marks synthetic style modules produced per .forge file. */
const VIRTUAL_PREFIX = '\0forge-style:';

// ---------------------------------------------------------------------------
// SCSS compilation
// ---------------------------------------------------------------------------

type SassCompiler = {
  compileString(source: string, opts?: { url?: URL }): { css: string };
};

let _sass: SassCompiler | undefined;

/**
 * Lazily loads the `sass` package via a synchronous CJS require.
 * Throws a descriptive error if `sass` is not installed.
 */
function getSass(): SassCompiler {
  if (_sass !== undefined) return _sass;
  const _require = createRequire(import.meta.url);
  try {
    _sass = _require('sass') as SassCompiler;
    return _sass;
  } catch {
    throw new Error(
      `[Forge Compiler] SCSS requires the 'sass' package — run: npm i -D sass`,
    );
  }
}

/**
 * Compiles an SCSS string to CSS using the `sass` package.
 * `filename` is used to resolve relative `@use`/`@import` paths.
 */
function compileScss(source: string, filename: string): string {
  const sass = getSass();
  const result = sass.compileString(source, {
    url: new URL(`file://${filename.replace(/\\/g, '/')}`),
  });
  return result.css;
}

// ---------------------------------------------------------------------------
// PostCSS processing
// ---------------------------------------------------------------------------

type PostCSSResult = { css: string };
type PostCSSProcessor = {
  process(css: string, opts: { from: string }): Promise<PostCSSResult>;
};
type PostCSSFactory = (plugins: unknown[]) => PostCSSProcessor;

let _postcss: PostCSSFactory | undefined;

/**
 * Lazily loads the `postcss` package via a synchronous CJS require.
 * Throws a descriptive error if `postcss` is not installed.
 */
function getPostCSS(): PostCSSFactory {
  if (_postcss !== undefined) return _postcss;
  const _require = createRequire(import.meta.url);
  try {
    _postcss = _require('postcss') as PostCSSFactory;
    return _postcss;
  } catch {
    throw new Error(
      `[Forge Compiler] PostCSS requires the 'postcss' package — run: npm i -D postcss`,
    );
  }
}

/**
 * Runs a CSS string through PostCSS with the given plugins.
 * `filename` is passed as `from` for source-map accuracy.
 */
async function runPostCSS(
  css: string,
  filename: string,
  plugins: unknown[],
): Promise<string> {
  const postcss = getPostCSS();
  const result = await postcss(plugins).process(css, { from: filename });
  return result.css;
}

// ---------------------------------------------------------------------------
// CSS scoping
// ---------------------------------------------------------------------------

/**
 * Rewrites CSS selectors so every rule targets only elements carrying
 * `data-v-{scopeId}`. Leaves @-rule headers (e.g. @media, @keyframes) and
 * keyframe percentage selectors (from / to / 0%) untouched.
 */
function scopeCSS(css: string, scopeId: string): string {
  const attr = `[data-v-${scopeId}]`;
  return css.replace(/([^{}]+)\{/g, (match, selectorGroup: string) => {
    const trimmed = selectorGroup.trim();
    if (trimmed.startsWith('@')) return match;
    if (/^(from|to|\d+%)/.test(trimmed)) return match;

    const scoped = selectorGroup
      .split(',')
      .map((s: string) => {
        // Append attribute selector just before any trailing whitespace.
        return s.replace(/(\s*)$/, `${attr}$1`);
      })
      .join(',');
    return `${scoped}{`;
  });
}

// ---------------------------------------------------------------------------
// Style module builder
// ---------------------------------------------------------------------------

/**
 * Wraps a CSS string in a JavaScript module that injects a `<style>` element
 * into `document.head` at runtime. The `typeof document` guard keeps the
 * module SSR-safe.
 */
function buildStyleModule(css: string): string {
  const escaped = css.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  return [
    `const _css = \`${escaped}\`;`,
    `if (typeof document !== 'undefined') {`,
    `  const _el = document.createElement('style');`,
    `  _el.textContent = _css;`,
    `  document.head.appendChild(_el);`,
    `}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Returns a Rolldown (Rollup-compatible) plugin that:
 *
 * 1. Transforms `.forge` SFC files into plain JavaScript modules.
 * 2. Extracts `<style>` / `<style lang="scss">` blocks into virtual CSS
 *    modules that inject a `<style>` element at runtime.
 * 3. Applies CSS scoping when `<style scoped>` is present.
 * 4. Compiles standalone `.scss` files to CSS.
 *
 * @example
 * ```ts
 * // rolldown.config.ts — with Tailwind CSS
 * import { defineConfig } from 'rolldown';
 * import { forgePlugin } from '@forge/compiler';
 * import tailwindcss from 'tailwindcss';
 * import autoprefixer from 'autoprefixer';
 *
 * export default defineConfig({
 *   input: 'src/main.ts',
 *   plugins: [forgePlugin({ postcss: { plugins: [tailwindcss(), autoprefixer()] } })],
 * });
 * ```
 */
export function forgePlugin(options?: ForgePluginOptions): ForgePluginObject {
  /**
   * Maps virtual module IDs → their JS injection code.
   * Populated by `transform`, consumed by `load`.
   */
  const virtualStyles = new Map<string, string>();

  return {
    name: 'forge',

    // -------------------------------------------------------------------------
    // resolveId — claim ownership of virtual style module IDs
    // -------------------------------------------------------------------------

    resolveId(id: string) {
      if (id.startsWith(VIRTUAL_PREFIX)) return id;
      return null;
    },

    // -------------------------------------------------------------------------
    // load — serve virtual style modules
    // -------------------------------------------------------------------------

    load(id: string) {
      // Virtual style modules produced by .forge SFC compilation.
      if (id.startsWith(VIRTUAL_PREFIX)) {
        const moduleCode = virtualStyles.get(id) ?? '';
        return { code: moduleCode };
      }

      // Standalone .scss files — compiled here in `load` so Rolldown never
      // tries to parse the raw SCSS source as JavaScript.
      if (id.endsWith('.scss')) {
        const source = readFileSync(id, 'utf-8');
        const css = compileScss(source, id);
        return { code: buildStyleModule(css) };
      }

      return null;
    },

    // -------------------------------------------------------------------------
    // transform — .css imports and .forge SFCs
    // -------------------------------------------------------------------------

    async transform(code: string, id: string) {
      // ---- Plain .css files ------------------------------------------------
      // Intercept CSS imports so Tailwind (or any PostCSS plugin) can process
      // them, then wrap the result in a runtime style-injection module.
      if (id.endsWith('.css')) {
        let css = code;
        if (options?.postcss) {
          css = await runPostCSS(css, id, options.postcss.plugins);
        }
        return { code: buildStyleModule(css) };
      }

      // ---- .forge SFC files ------------------------------------------------
      if (!id.endsWith('.forge')) return null;

      // Step 1 — parse the SFC source into block descriptors.
      const descriptor = parseSFC(code, id);

      // Step 2 — compile the descriptor into a JS module string.
      const result = compileSFC(descriptor);

      // Fatal errors abort the build with a descriptive message.
      if (result.errors.length > 0) {
        const messages = result.errors.map(e => e.message).join('\n');
        throw new Error(
          `[Forge Plugin] Compilation failed for "${id}":\n${messages}`,
        );
      }

      // Step 3 — process style blocks.
      let generatedCode = result.code;

      if (result.styles.length > 0) {
        // Build the combined CSS for this component (order: block order).
        const cssParts: string[] = [];
        for (const style of result.styles) {
          // a) SCSS → CSS
          let css = style.lang === 'scss'
            ? compileScss(style.content, id)
            : style.content;

          // b) PostCSS (e.g. Tailwind @apply, autoprefixer)
          if (options?.postcss) {
            css = await runPostCSS(css, id, options.postcss.plugins);
          }

          // c) Scoping — appended last so PostCSS sees unscoped selectors.
          if (style.scoped) {
            css = scopeCSS(css, style.scopeId);
          }

          cssParts.push(css);
        }

        const combinedCss = cssParts.join('\n');

        // Inline the style injection directly into the component module.
        // We do NOT use a virtual import here because Rolldown does not
        // reliably invoke resolveId/load for \0-prefixed virtual IDs that
        // are generated inside a transform hook.
        generatedCode = `${buildStyleModule(combinedCss)}\n${generatedCode}`;
      }

      return {
        code: generatedCode,
        ...(result.map !== undefined ? { map: result.map } : {}),
      };
    },
  };
}
