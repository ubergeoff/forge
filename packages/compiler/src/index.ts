// =============================================================================
// @forge/compiler — Public API
// =============================================================================

// Step 4: SFC parser (complete)
export type { SFCBlock, SFCDescriptor } from './parser.js';
export { parseSFC } from './parser.js';

// Step 5: Template compiler (complete)
export type { CompileResult, CompileError } from './compiler.js';
export { compileSFC } from './compiler.js';

// Step 6: Rolldown plugin (complete)
export type { ForgePluginObject } from './plugin.js';
export { forgePlugin } from './plugin.js';
