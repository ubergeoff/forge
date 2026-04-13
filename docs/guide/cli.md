# CLI

The `@forge/cli` package provides the `forge` command-line tool for creating, developing, and building Forge applications.

## Installation

```bash
npm install --save-dev @forge/cli
```

Or globally:

```bash
npm install -g @forge/cli
```

## Commands

### forge new

Scaffold a new Forge application:

```bash
forge new my-app
```

This creates a new directory `my-app/` with:
- `package.json` with Forge dependencies
- `tsconfig.json` with recommended settings
- `forge.config.ts`
- `index.html`
- `src/main.ts` — application entry point
- `src/App.forge` — root component

### forge dev

Start the development server with live reload:

```bash
forge dev
forge dev --port 4000
forge dev --entry src/index.ts
forge dev --outDir public
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--port <n>` | `3000` | HTTP port for the dev server |
| `--entry <path>` | `src/main.ts` | Application entry file |
| `--outDir <path>` | `dist` | Output directory |

The dev server:
- Watches all `.forge` files and TypeScript source for changes
- Recompiles and reloads the browser on save
- Serves your `index.html` for all routes (SPA mode)
- Processes `.forge` SFCs via the Forge Rolldown plugin

### forge build

Build for production:

```bash
forge build
forge build --entry src/main.ts --outDir dist
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--entry <path>` | `src/main.ts` | Application entry file |
| `--outDir <path>` | `dist` | Output directory |

The production build:
- Compiles all `.forge` SFCs
- Strips TypeScript with `oxc-transform`
- Bundles with Rolldown (ESM output)
- Minifies and tree-shakes
- Emits a `dist/index.html`, `dist/assets/` with hashed filenames

### forge typecheck

Run TypeScript type checking without emitting files:

```bash
forge typecheck
```

Useful in CI to verify types without a full build.

## forge.config.ts

Create a `forge.config.ts` in your project root to configure the CLI:

```ts
import { defineConfig } from '@forge/cli'

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
import { defineConfig } from '@forge/cli'
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
import { defineConfig } from '@forge/cli'
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
    "dev": "forge dev",
    "build": "forge build",
    "typecheck": "forge typecheck"
  }
}
```

## Getting help

```bash
forge --help
forge --version
```

```
  forge — compiled signal-first framework for enterprise apps

  Usage: forge <command> [options]

  Commands:
    new <name>          Scaffold a new Forge application
    dev                 Start the development server (with live reload)
    build               Build for production
    typecheck           Run TypeScript type checking

  Options:
    --help, -h          Show this help message
    --version, -v       Show the Forge version
```

## Nx Integration

If you're using Nx to manage a monorepo, add a `project.json` to your app:

```json
{
  "name": "my-app",
  "targets": {
    "dev": {
      "command": "forge dev",
      "options": { "cwd": "{projectRoot}" }
    },
    "build": {
      "command": "forge build",
      "options": { "cwd": "{projectRoot}" },
      "dependsOn": ["^build"],
      "outputs": ["{projectRoot}/dist"]
    },
    "typecheck": {
      "command": "forge typecheck",
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
