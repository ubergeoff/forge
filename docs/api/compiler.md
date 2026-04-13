# @vorra/compiler

The Vorra SFC compiler. Parses `.vorra` Single File Components and compiles them to JavaScript modules.

```bash
npm install @vorra/compiler
```

## Subpath Exports

| Import path | Environment | Description |
|-------------|-------------|-------------|
| `@vorra/compiler` | Node.js | Full compiler with `oxc-transform` and `node:*` modules |
| `@vorra/compiler/browser` | Browser / Vite | Parser + compiler without any Node.js-specific code |

The browser subpath is used by the Vorra Playground and any browser-based tooling.

## parseSFC()

Splits a raw `.vorra` source string into typed block descriptors.

```ts
function parseSFC(source: string, filename: string): SFCDescriptor
```

**Parameters:**
- `source` — The raw `.vorra` file content
- `filename` — The filename (used for scope IDs and error messages)

**Returns:** An `SFCDescriptor` with the parsed blocks.

**Example:**
```ts
import { parseSFC } from '@vorra/compiler'
// or in a browser context:
import { parseSFC } from '@vorra/compiler/browser'

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
`, 'Counter.vorra')

descriptor.script    // → SFCBlock | null
descriptor.template  // → SFCBlock | null
descriptor.styles    // → SFCBlock[]
descriptor.filename  // → 'Counter.vorra'
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
import { parseSFC, compileSFC } from '@vorra/compiler'

const descriptor = parseSFC(source, 'Counter.vorra')
const result = compileSFC(descriptor)

if (result.errors.length > 0) {
  console.error(result.errors)
} else {
  console.log(result.code)  // The generated JS module
}
```

---

## vorraPlugin()

The Rolldown plugin that integrates the compiler into the build pipeline.

```ts
function vorraPlugin(options?: VorraPluginOptions): Plugin
```

**Parameters:**

```ts
interface VorraPluginOptions {
  /**
   * Path to a CSS entry file (e.g. Tailwind CSS).
   * Import 'vorra:css' in your entry to inject it.
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
import { vorraPlugin } from '@vorra/compiler'

export default {
  input: 'src/main.ts',
  plugins: [vorraPlugin()],
}
```

The plugin handles:
- `.vorra` files — parsed, compiled, and returned as JavaScript modules
- `.scss` files — compiled to CSS
- `vorra:css` virtual module — injects the configured CSS entry at runtime
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

The compiler generates a JavaScript ESM module for each `.vorra` file. The default export is a **component factory function**:

```ts
export default function (ctx: ComponentContext, props?: Record<string, () => unknown>): Node
```

The factory:
1. Runs the script block code in module scope
2. Calls `createElement`, `bindText`, `listen`, etc. from `@vorra/core/dom`
3. Returns the root DOM node

**Example output** for a simple counter:

```js
import { signal } from '@vorra/core'
import { createElement, bindText, listen, insert } from '@vorra/core/dom'

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
