// =============================================================================
// @vorra/compiler — Rolldown Plugin (Step 6)
// Wires the SFC parser + template compiler into the Rolldown build pipeline.
// CSS and SCSS support:
//   - <style> and <style lang="scss"> blocks in .vorra files are extracted,
//     compiled (if SCSS), and injected via a virtual CSS module.
//   - <style scoped> stamps data-v-{scopeId} on every template element and
//     rewrites CSS selectors to match.
//   - Standalone .scss files are compiled to CSS by the transform hook.
//   - Imported .css files are processed through PostCSS when configured.
//   - Optional PostCSS support enables Tailwind CSS and other PostCSS plugins.
// =============================================================================

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { parseSFC } from './parser.js';
import { compileSFC } from './compiler.js';
import type { CompileSFCOptions } from './compiler.js';

// ---------------------------------------------------------------------------
// Plugin options
// ---------------------------------------------------------------------------

/**
 * Options for the Vorra Rolldown plugin.
 */
export interface VorraPluginOptions {
  /**
   * Absolute or relative path to a CSS entry file (e.g. a Tailwind CSS file
   * using `@import "tailwindcss"`). The file is processed through PostCSS
   * when `postcss` is also configured, then injected into the page at runtime
   * via a `<style>` element.
   *
   * Import the virtual module `"vorra:css"` from your entry point to trigger
   * injection:
   *
   * ```ts
   * // src/main.ts
   * import 'vorra:css';
   * ```
   *
   * Because Rolldown's built-in CSS extraction intercepts `.css` imports
   * before plugin hooks can claim them, using a named virtual module avoids
   * that pipeline entirely.
   *
   * @example
   * ```ts
   * vorraPlugin({
   *   css: './src/tailwind.css',
   *   postcss: { plugins: [tailwindcss()] },
   * })
   * ```
   */
  css?: string;

  /**
   * Optional PostCSS configuration. When provided, all CSS (including
   * `<style>` blocks in `.vorra` files) is processed through PostCSS before
   * injection. Required for Tailwind CSS and other PostCSS plugins.
   *
   * @example
   * ```ts
   * import tailwindcss from 'tailwindcss';
   * import autoprefixer from 'autoprefixer';
   *
   * vorraPlugin({ postcss: { plugins: [tailwindcss(), autoprefixer()] } })
   * ```
   */
  postcss?: {
    plugins: unknown[];
  };

  /**
   * Enable Hot Module Replacement (HMR) support. When true, compiled `.vorra`
   * components include self-registration code that allows the dev server to
   * hot-swap component instances without a full page reload.
   *
   * Set automatically by `vorra dev`; do not set in production builds.
   */
  hmr?: boolean;
}

// ---------------------------------------------------------------------------
// Minimal plugin interface (Rolldown / Rollup compatible)
// ---------------------------------------------------------------------------

/**
 * The subset of the Rolldown/Rollup plugin interface used by the Vorra plugin.
 * Kept minimal so this package does not need a hard dep on rolldown's types.
 * `transform` is always async to support optional PostCSS processing.
 */
export interface VorraPluginObject {
  name: string;
  resolveId(id: string): string | null;
  load(id: string): Promise<{ code: string } | null>;
  transform(
    code: string,
    id: string,
  ): Promise<{ code: string; map?: string } | null | undefined>;
}

// ---------------------------------------------------------------------------
// Virtual module prefixes
// ---------------------------------------------------------------------------

/** Prefix that marks synthetic style modules produced per .vorra file. */
const VIRTUAL_PREFIX = '\0vorra-style:';

/**
 * The public import specifier that applications use to trigger CSS entry
 * injection. Resolved to `CSS_VIRTUAL_ID` by the plugin so it never carries
 * a `.css` extension that Rolldown would intercept as a CSS asset.
 */
const CSS_IMPORT_SPECIFIER = 'vorra:css';

/** Internal virtual module ID for the CSS entry injection module. */
const CSS_VIRTUAL_ID = '\0vorra:css';

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
      `[Vorra Compiler] SCSS requires the 'sass' package — run: npm i -D sass`,
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
      `[Vorra Compiler] PostCSS requires the 'postcss' package — run: npm i -D postcss`,
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
 * 1. Transforms `.vorra` SFC files into plain JavaScript modules.
 * 2. Extracts `<style>` / `<style lang="scss">` blocks into virtual CSS
 *    modules that inject a `<style>` element at runtime.
 * 3. Applies CSS scoping when `<style scoped>` is present.
 * 4. Compiles standalone `.scss` files to CSS.
 *
 * @example
 * ```ts
 * // rolldown.config.ts — with Tailwind CSS
 * import { defineConfig } from 'rolldown';
 * import { vorraPlugin } from '@vorra/compiler';
 * import tailwindcss from 'tailwindcss';
 * import autoprefixer from 'autoprefixer';
 *
 * export default defineConfig({
 *   input: 'src/main.ts',
 *   plugins: [vorraPlugin({ postcss: { plugins: [tailwindcss(), autoprefixer()] } })],
 * });
 * ```
 */
export function vorraPlugin(options?: VorraPluginOptions): VorraPluginObject {
  /**
   * Maps virtual module IDs → their JS injection code.
   * Populated by `transform`, consumed by `load`.
   */
  const virtualStyles = new Map<string, string>();

  return {
    name: 'vorra',

    // -------------------------------------------------------------------------
    // resolveId — claim ownership of virtual style module IDs
    // -------------------------------------------------------------------------

    resolveId(id: string) {
      if (id.startsWith(VIRTUAL_PREFIX)) return id;
      if (id === CSS_IMPORT_SPECIFIER) return CSS_VIRTUAL_ID;
      return null;
    },

    // -------------------------------------------------------------------------
    // load — serve virtual style modules, .scss, and .css files
    // -------------------------------------------------------------------------

    async load(id: string) {
      // Virtual style modules produced by .vorra SFC compilation.
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

      // CSS entry file — resolved from `options.css` and injected at runtime.
      // Processed through PostCSS when configured (e.g. Tailwind CSS).
      if (id === CSS_VIRTUAL_ID) {
        if (!options?.css) return { code: '' };
        const filePath = isAbsolute(options.css)
          ? options.css
          : resolve(options.css);
        let css = readFileSync(filePath, 'utf-8');
        if (options.postcss) {
          css = await runPostCSS(css, filePath, options.postcss.plugins);
        }
        return { code: buildStyleModule(css) };
      }

      return null;
    },

    // -------------------------------------------------------------------------
    // transform — .css imports and .vorra SFCs
    // -------------------------------------------------------------------------

    async transform(code: string, id: string) {
      // ---- .vorra SFC files ------------------------------------------------
      if (!id.endsWith('.vorra')) return null;

      // Step 1 — parse the SFC source into block descriptors.
      const descriptor = parseSFC(code, id);

      // Step 2 — compile the descriptor into a JS module string.
      const compileOptions: CompileSFCOptions = options?.hmr ? { hmr: true } : {};
      const result = compileSFC(descriptor, undefined, compileOptions);

      // Fatal errors abort the build with a descriptive message.
      if (result.errors.length > 0) {
        const messages = result.errors.map(e => e.message).join('\n');
        throw new Error(
          `[Vorra Plugin] Compilation failed for "${id}":\n${messages}`,
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
