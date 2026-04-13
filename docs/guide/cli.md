# CLI

The `@vorra/cli` package provides the `forge` command-line tool for creating, developing, and building Vorra applications.

## Installation

```bash
npm install --save-dev @vorra/cli
```

Or globally:

```bash
npm install -g @vorra/cli
```

## Commands

### vorra new

Scaffold a new Vorra application:

```bash
vorra new my-app
```

This creates a new directory `my-app/` with:
- `package.json` with Vorra dependencies
- `tsconfig.json` with recommended settings
- `vorra.config.ts`
- `index.html`
- `src/main.ts` — application entry point
- `src/App.vorra` — root component

### vorra dev

Start the development server with live reload:

```bash
vorra dev
vorra dev --port 4000
vorra dev --entry src/index.ts
vorra dev --outDir public
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--port <n>` | `3000` | HTTP port for the dev server |
| `--entry <path>` | `src/main.ts` | Application entry file |
| `--outDir <path>` | `dist` | Output directory |

The dev server:
- Watches all `.vorra` files and TypeScript source for changes
- Recompiles and reloads the browser on save
- Serves your `index.html` for all routes (SPA mode)
- Processes `.vorra` SFCs via the Vorra Rolldown plugin

### vorra build

Build for production:

```bash
vorra build
vorra build --entry src/main.ts --outDir dist
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--entry <path>` | `src/main.ts` | Application entry file |
| `--outDir <path>` | `dist` | Output directory |

The production build:
- Compiles all `.vorra` SFCs
- Strips TypeScript with `oxc-transform`
- Bundles with Rolldown (ESM output)
- Minifies and tree-shakes
- Emits a `dist/index.html`, `dist/assets/` with hashed filenames

### vorra typecheck

Run TypeScript type checking without emitting files:

```bash
vorra typecheck
```

Useful in CI to verify types without a full build.

## vorra.config.ts

Create a `vorra.config.ts` in your project root to configure the CLI:

```ts
import { defineConfig } from '@vorra/cli'

export default defineConfig({
  entry: 'src/main.ts',    // Application entry file
  outDir: 'dist',           // Build output directory
  port: 3000,               // Dev server port
  plugins: [],              // Additional Rolldown plugins
})
```

### defineConfig options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entry` | `string` | `'src/main.ts'` | Application entry file |
| `outDir` | `string` | `'dist'` | Production output directory |
| `port` | `number` | `3000` | Dev server port |
| `plugins` | `Plugin[]` | `[]` | Additional Rolldown plugins to inject |

### Example with PostCSS / Tailwind

```ts
import { defineConfig } from '@vorra/cli'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  entry: 'src/main.ts',
  outDir: 'dist',
  port: 3000,
  plugins: [
    tailwindcss(),
  ],
})
```

### Example with path aliases

```ts
import { defineConfig } from '@vorra/cli'
import { resolve } from 'path'

export default defineConfig({
  entry: 'src/main.ts',
  plugins: [
    {
      name: 'resolve-aliases',
      resolveId(id) {
        if (id.startsWith('@/')) {
          return resolve('src', id.slice(2))
        }
      },
    },
  ],
})
```

## Using npm scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "dev": "vorra dev",
    "build": "vorra build",
    "typecheck": "vorra typecheck"
  }
}
```

## Getting help

```bash
vorra --help
vorra --version
```

```
  vorra — compiled signal-first framework for enterprise apps

  Usage: vorra <command> [options]

  Commands:
    new <name>          Scaffold a new Vorra application
    dev                 Start the development server (with live reload)
    build               Build for production
    typecheck           Run TypeScript type checking

  Options:
    --help, -h          Show this help message
    --version, -v       Show the Vorra version
```

## Nx Integration

If you're using Nx to manage a monorepo, add a `project.json` to your app:

```json
{
  "name": "my-app",
  "targets": {
    "dev": {
      "command": "vorra dev",
      "options": { "cwd": "{projectRoot}" }
    },
    "build": {
      "command": "vorra build",
      "options": { "cwd": "{projectRoot}" },
      "dependsOn": ["^build"],
      "outputs": ["{projectRoot}/dist"]
    },
    "typecheck": {
      "command": "vorra typecheck",
      "options": { "cwd": "{projectRoot}" }
    }
  }
}
```

Then run:

```bash
nx run my-app:dev
nx run my-app:build
nx run-many --target=build  # build all projects
```
