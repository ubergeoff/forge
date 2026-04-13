# @forge/cli

The Forge command-line interface. Provides `forge new`, `forge dev`, `forge build`, and `forge typecheck` commands.

```bash
npm install --save-dev @forge/cli
# or globally:
npm install -g @forge/cli
```

## Commands

### forge new \<name\>

Scaffold a new Forge application in a directory named `<name>`.

```bash
forge new my-app
forge new my-app --port 4000
```

Creates:
- `package.json` with Forge dependencies
- `tsconfig.json` with recommended TypeScript settings
- `forge.config.ts` with default configuration
- `index.html`
- `src/main.ts` — application entry point
- `src/App.forge` — root component

---

### forge dev

Start the development server with hot reload.

```bash
forge dev
forge dev --port 4000
forge dev --entry src/index.ts
forge dev --outDir public
```

**Flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--port <n>` | `3000` | HTTP port for the dev server |
| `--entry <path>` | `src/main.ts` | Application entry file |
| `--outDir <path>` | `dist` | Intermediate output directory |

**Behavior:**
- Serves `index.html` for all routes (single-page app mode)
- Watches `.forge` files, TypeScript, and CSS for changes
- Reloads the browser on save
- Processes `.forge` SFCs via the Forge Rolldown plugin

---

### forge build

Build for production.

```bash
forge build
forge build --entry src/main.ts
forge build --outDir dist
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

### forge typecheck

Run TypeScript type checking without emitting files.

```bash
forge typecheck
```

Exits with code `0` on success, `1` on type errors. Suitable for CI pipelines.

---

## defineConfig()

Type-safe configuration helper for `forge.config.ts`.

```ts
function defineConfig(config: ForgeConfig): ForgeConfig
```

### ForgeConfig

```ts
interface ForgeConfig {
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
// forge.config.ts
import { defineConfig } from '@forge/cli'

export default defineConfig({
  entry: 'src/main.ts',
  outDir: 'dist',
  port: 3000,
})
```

---

## Config Resolution

The CLI reads `forge.config.ts` (or `forge.config.js`) from the current working directory. Command-line flags take precedence over config file values.

**Resolution order (highest to lowest priority):**
1. CLI flags (`--port`, `--entry`, `--outDir`)
2. `forge.config.ts` values
3. Built-in defaults

---

## Programmatic API

You can invoke CLI commands programmatically:

```ts
import { runDev } from '@forge/cli/commands/dev'
import { runBuild } from '@forge/cli/commands/build'
import { runNew } from '@forge/cli/commands/new'
import { runTypecheck } from '@forge/cli/commands/typecheck'

await runDev(['--port', '4000'])
await runBuild(['--outDir', 'public'])
runNew(['my-app'])
runTypecheck([])
```

---

## Global Help

```bash
forge --help
forge --version
```

```
  Forge — compiled signal-first framework for enterprise apps

  Usage: forge <command> [options]

  Commands:
    new <name>          Scaffold a new Forge application
    dev                 Start the development server (with live reload)
    build               Build for production
    typecheck           Run TypeScript type checking

  Options:
    --help, -h          Show this help message
    --version, -v       Show the Forge version

  Flags per command:
    dev   --port <n>    Dev server port (default: 3000)
          --entry <p>   Entry file     (default: src/main.ts)
          --outDir <p>  Output dir     (default: dist)
    build --entry <p>   Entry file     (default: src/main.ts)
          --outDir <p>  Output dir     (default: dist)
```
