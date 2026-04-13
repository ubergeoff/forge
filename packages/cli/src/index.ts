// =============================================================================
// @vorra/cli — Public API
// =============================================================================

/**
 * User-facing configuration for a Vorra project.
 * Returned by `defineConfig()` and loaded by `vorra dev` / `vorra build`.
 */
export interface VorraConfig {
  /** Application entry point. Defaults to `'src/main.ts'`. */
  entry?: string;
  /** Output directory. Defaults to `'dist'`. */
  outDir?: string;
  /** Dev server port. Defaults to `3000`. */
  port?: number;
  /**
   * Output directory used by `vorra dev`. Defaults to `'.vorra'`.
   * Kept separate from `outDir` so dev artifacts never pollute the production
   * build folder. Add `.vorra/` to your `.gitignore`.
   */
  devOutDir?: string;
  /** Additional Rolldown plugins appended after the built-in vorra plugin. */
  plugins?: unknown[];
  /**
   * Emit source map files alongside build output.
   * Defaults to `false` for `vorra build` (production).
   * `vorra dev` always enables source maps regardless of this setting.
   *
   * @example
   * ```js
   * // vorra.config.js — enable source maps for a debug/staging build
   * export default defineConfig({ sourcemap: true });
   * ```
   */
  sourcemap?: boolean;
  /**
   * Absolute or relative path to a CSS entry file processed through PostCSS
   * (e.g. a Tailwind CSS file using `@import "tailwindcss"`). Import the
   * virtual module `"vorra:css"` from your entry point to inject it:
   *
   * ```ts
   * // src/main.ts
   * import 'vorra:css';
   * ```
   */
  css?: string;
  /**
   * PostCSS configuration. Required when `css` uses PostCSS-processed rules
   * such as Tailwind CSS.
   *
   * @example
   * ```js
   * // vorra.config.js
   * import tailwindcss from '@tailwindcss/postcss';
   * export default defineConfig({
   *   css: './src/tailwind.css',
   *   postcss: { plugins: [tailwindcss()] },
   * });
   * ```
   */
  postcss?: { plugins: unknown[] };
}

/**
 * Type-safe helper for writing `vorra.config.js`.
 *
 * @example
 * ```js
 * // vorra.config.js
 * import { defineConfig } from '@vorra/cli';
 *
 * export default defineConfig({
 *   entry: 'src/main.ts',
 *   outDir: 'dist',
 *   port: 3000,
 * });
 * ```
 */
export function defineConfig(config: VorraConfig): VorraConfig {
  return config;
}
