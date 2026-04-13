# @forge/compiler

The Forge SFC compiler. Parses `.forge` Single File Components and compiles them to JavaScript modules.

```bash
npm install @forge/compiler
```

## Subpath Exports

| Import path | Environment | Description |
|-------------|-------------|-------------|
| `@forge/compiler` | Node.js | Full compiler with `oxc-transform` and `node:*` modules |
| `@forge/compiler/browser` | Browser / Vite | Parser + compiler without any Node.js-specific code |

The browser subpath is used by the Forge Playground and any browser-based tooling.

## parseSFC()

Splits a raw `.forge` source string into typed block descriptors.

```ts
function parseSFC(source: string, filename: string): SFCDescriptor
```

**Parameters:**
- `source` — The raw `.forge` file content
- `filename` — The filename (used for scope IDs and error messages)

**Returns:** An `SFCDescriptor` with the parsed blocks.

**Example:**
```ts
import { parseSFC } from '@forge/compiler'
// or in a browser context:
import { parseSFC } from '@forge/compiler/browser'

const descriptor = parseSFC(`
<script lang="ts">
const count = signal(0)
</script>
<template>
  <div>{count()}</div>
</template>
<style scoped>
div { color: red; }
</style>
`, 'Counter.forge')

descriptor.script    // → SFCBlock | null
descriptor.template  // → SFCBlock | null
descriptor.styles    // → SFCBlock[]
descriptor.filename  // → 'Counter.forge'
```

---

## compileSFC()

Compiles a parsed `SFCDescriptor` into a JavaScript module string.

```ts
function compileSFC(descriptor: SFCDescriptor): CompileResult
```

**Parameters:**
- `descriptor` — An `SFCDescriptor` returned by `parseSFC`

**Returns:** A `CompileResult` with the generated code, errors, warnings, and extracted styles.

**Example:**
```ts
import { parseSFC, compileSFC } from '@forge/compiler'

const descriptor = parseSFC(source, 'Counter.forge')
const result = compileSFC(descriptor)

if (result.errors.length > 0) {
  console.error(result.errors)
} else {
  console.log(result.code)  // The generated JS module
}
```

---

## forgePlugin()

The Rolldown plugin that integrates the compiler into the build pipeline.

```ts
function forgePlugin(options?: ForgePluginOptions): Plugin
```

**Parameters:**

```ts
interface ForgePluginOptions {
  /**
   * Path to a CSS entry file (e.g. Tailwind CSS).
   * Import 'forge:css' in your entry to inject it.
   */
  cssEntry?: string

  /**
   * PostCSS configuration. Accepts a PostCSS config object or `true`
   * to auto-load from `postcss.config.js`.
   */
  postcss?: object | boolean

  /**
   * Whether to enable scoped style ID stamping.
   * Defaults to true.
   */
  scoped?: boolean
}
```

**Example:**
```ts
// rolldown.config.mjs
import { forgePlugin } from '@forge/compiler'

export default {
  input: 'src/main.ts',
  plugins: [forgePlugin()],
}
```

The plugin handles:
- `.forge` files — parsed, compiled, and returned as JavaScript modules
- `.scss` files — compiled to CSS
- `forge:css` virtual module — injects the configured CSS entry at runtime
- Scoped style ID stamping via `data-v-{scopeId}` attributes

---

## Types

### SFCDescriptor

```ts
interface SFCDescriptor {
  script: SFCBlock | null
  template: SFCBlock | null
  styles: SFCBlock[]  // Ordered list (a file may have multiple <style> blocks)
  filename: string
}
```

### SFCBlock

```ts
interface SFCBlock {
  type: 'script' | 'template' | 'style'
  content: string                         // Raw inner content
  attrs: Record<string, string | true>    // Parsed attributes
  start: number                           // Byte offset of content start
  end: number                             // Byte offset of content end
}
```

**Attribute examples:**
- `<script lang="ts">` → `{ lang: 'ts' }`
- `<style scoped>` → `{ scoped: true }`
- `<style lang="scss" scoped>` → `{ lang: 'scss', scoped: true }`

### CompileResult

```ts
interface CompileResult {
  code: string              // Generated JavaScript module source
  map?: string              // Source map (future)
  errors: CompileError[]    // Fatal errors — compilation failed
  warnings: CompileError[]  // Non-fatal warnings
  styles: StyleResult[]     // Extracted style blocks
}
```

### StyleResult

```ts
interface StyleResult {
  content: string           // Raw CSS (or SCSS) source
  lang: 'css' | 'scss'      // Source language
  scoped: boolean           // Whether <style scoped> was present
  scopeId: string           // Deterministic scope ID from filename
}
```

### CompileError

```ts
interface CompileError {
  message: string
  line?: number
  column?: number
}
```

---

## Generated Output

The compiler generates a JavaScript ESM module for each `.forge` file. The default export is a **component factory function**:

```ts
export default function (ctx: ComponentContext, props?: Record<string, () => unknown>): Node
```

The factory:
1. Runs the script block code in module scope
2. Calls `createElement`, `bindText`, `listen`, etc. from `@forge/core/dom`
3. Returns the root DOM node

**Example output** for a simple counter:

```js
import { signal } from '@forge/core'
import { createElement, bindText, listen, insert } from '@forge/core/dom'

export default function factory(ctx) {
  const count = signal(0)

  function increment() {
    count.update(n => n + 1)
  }

  const _e0 = createElement('div')
  const _e1 = createElement('p')
  const _t0 = document.createTextNode('')
  bindText(_t0, () => String(count()))
  insert(_e1, _t0)
  insert(_e0, _e1)

  const _e2 = createElement('button')
  listen(_e2, 'click', increment)
  _e2.textContent = 'Increment'
  insert(_e0, _e2)

  return _e0
}
```
