// =============================================================================
// @forge/cli — Public API
// =============================================================================

/**
 * User-facing configuration for a Forge project.
 * Returned by `defineConfig()` and loaded by `forge dev` / `forge build`.
 */
export interface ForgeConfig {
  /** Application entry point. Defaults to `'src/main.ts'`. */
  entry?: string;
  /** Output directory. Defaults to `'dist'`. */
  outDir?: string;
  /** Dev server port. Defaults to `3000`. */
  port?: number;
  /** Additional Rolldown plugins appended after the built-in forge plugin. */
  plugins?: unknown[];
}

/**
 * Type-safe helper for writing `forge.config.js`.
 *
 * @example
 * ```js
 * // forge.config.js
 * import { defineConfig } from '@forge/cli';
 *
 * export default defineConfig({
 *   entry: 'src/main.ts',
 *   outDir: 'dist',
 *   port: 3000,
 * });
 * ```
 */
export function defineConfig(config: ForgeConfig): ForgeConfig {
  return config;
}
