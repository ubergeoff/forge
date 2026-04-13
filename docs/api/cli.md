# @vorra/cli

The Vorra command-line interface. Provides `vorra new`, `vorra dev`, `vorra build`, and `vorra typecheck` commands.

```bash
npm install --save-dev @vorra/cli
# or globally:
npm install -g @vorra/cli
```

## Commands

### vorra new \<name\>

Scaffold a new Vorra application in a directory named `<name>`.

```bash
vorra new my-app
vorra new my-app --port 4000
```

Creates:
- `package.json` with Vorra dependencies
- `tsconfig.json` with recommended TypeScript settings
- `vorra.config.ts` with default configuration
- `index.html`
- `src/main.ts` — application entry point
- `src/App.vorra` — root component

---

### vorra dev

Start the development server with hot reload.

```bash
vorra dev
vorra dev --port 4000
vorra dev --entry src/index.ts
vorra dev --outDir public
```

**Flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--port <n>` | `3000` | HTTP port for the dev server |
| `--entry <path>` | `src/main.ts` | Application entry file |
| `--outDir <path>` | `dist` | Intermediate output directory |

**Behavior:**
- Serves `index.html` for all routes (single-page app mode)
- Watches `.vorra` files, TypeScript, and CSS for changes
- Reloads the browser on save
- Processes `.vorra` SFCs via the Vorra Rolldown plugin

---

### vorra build

Build for production.

```bash
vorra build
vorra build --entry src/main.ts
vorra build --outDir dist
```

**Flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--entry <path>` | `src/main.ts` | Application entry file |
| `--outDir <path>` | `dist` | Output directory |

**Output:**
- `dist/index.html`
- `dist/assets/*.js` — bundled and minified JavaScript with content hashes
- `dist/assets/*.css` — extracted and minified CSS
- Source maps alongside each asset

---

### vorra typecheck

Run TypeScript type checking without emitting files.

```bash
vorra typecheck
```

Exits with code `0` on success, `1` on type errors. Suitable for CI pipelines.

---

## defineConfig()

Type-safe configuration helper for `vorra.config.ts`.

```ts
function defineConfig(config: VorraConfig): VorraConfig
```

### VorraConfig

```ts
interface VorraConfig {
  /** Application entry file. Default: 'src/main.ts' */
  entry?: string

  /** Build output directory. Default: 'dist' */
  outDir?: string

  /** Dev server port. Default: 3000 */
  port?: number

  /** Additional Rolldown plugins injected into the build. Default: [] */
  plugins?: Plugin[]
}
```

**Example:**

```ts
// vorra.config.ts
import { defineConfig } from '@vorra/cli'

export default defineConfig({
  entry: 'src/main.ts',
  outDir: 'dist',
  port: 3000,
})
```

---

## Config Resolution

The CLI reads `vorra.config.ts` (or `vorra.config.js`) from the current working directory. Command-line flags take precedence over config file values.

**Resolution order (highest to lowest priority):**
1. CLI flags (`--port`, `--entry`, `--outDir`)
2. `vorra.config.ts` values
3. Built-in defaults

---

## Programmatic API

You can invoke CLI commands programmatically:

```ts
import { runDev } from '@vorra/cli/commands/dev'
import { runBuild } from '@vorra/cli/commands/build'
import { runNew } from '@vorra/cli/commands/new'
import { runTypecheck } from '@vorra/cli/commands/typecheck'

await runDev(['--port', '4000'])
await runBuild(['--outDir', 'public'])
runNew(['my-app'])
runTypecheck([])
```

---

## Global Help

```bash
vorra --help
vorra --version
```

```
  Vorra — compiled signal-first framework for enterprise apps

  Usage: vorra <command> [options]

  Commands:
    new <name>          Scaffold a new Vorra application
    dev                 Start the development server (with live reload)
    build               Build for production
    typecheck           Run TypeScript type checking

  Options:
    --help, -h          Show this help message
    --version, -v       Show the Vorra version

  Flags per command:
    dev   --port <n>    Dev server port (default: 3000)
          --entry <p>   Entry file     (default: src/main.ts)
          --outDir <p>  Output dir     (default: dist)
    build --entry <p>   Entry file     (default: src/main.ts)
          --outDir <p>  Output dir     (default: dist)
```
