# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Forge** is a compiled, signal-first JavaScript framework for enterprise applications. Philosophy: "Angular's structure. SolidJS's speed. Vue's elegance."

This is an **npm workspace monorepo** with four packages and an example app:
- `@forge/core` — Reactivity system (signals, computed, effects) + dependency injection
- `@forge/compiler` — SFC parser, template compiler, Rolldown plugin
- `@forge/cli` — Dev server and build commands (`forge` binary)
- `@forge/router` — Signal-driven client-side routing

## Commands

```bash
npm run build         # Build all packages (ESM + CJS via Rolldown)
npm test              # Run all tests (Vitest)
npm run test:watch    # Vitest in watch mode
npm run test:coverage # Coverage reports (v8, text + lcov + html)
npm run lint          # ESLint across all packages
npm run typecheck     # TypeScript type checking
npm run clean         # Remove all dist/ and node_modules
npm run graph         # Visualize Nx dependency graph
```

To build or test a single package, run the same commands inside its directory (e.g., `cd packages/core && npm run build`).

## Architecture

### Build System
- **Rolldown** (Rust-based bundler, Rollup-compatible API) — each package has `rolldown.config.mjs`
- **Nx** orchestrates the monorepo build graph; caching is enabled for build/test/lint/typecheck
- Each package outputs both ESM (`.js`) and CJS (`.cjs`) with `.d.ts` declarations and source maps to `dist/`
- Build dependency order: `core` → `compiler` + `router` → `cli`

### @forge/core
The reactive foundation. Key exports:
- `signal(value)` / `computed(fn)` / `effect(fn)` / `batch(fn)` / `untrack(fn)` — reactivity primitives in `reactivity.ts`
- `@Injectable` / `inject(token)` / `Injector` / `InjectionToken` / `bootstrapApp()` — DI system in `di.ts`
- `createElement` / `setAttr` / `setProp` / `listen` / `insert` / `remove` — DOM runtime in `dom.ts`

### @forge/compiler
Transforms `.forge` Single File Components into JavaScript:
1. `parser.ts` — splits `.forge` files into `<script>`, `<template>`, `<style>` blocks
2. `compiler.ts` — compiles templates to render functions using the core DOM runtime
3. `plugin.ts` — Rolldown plugin that hooks into the build pipeline

SFC format:
```
<script lang="ts">…</script>
<template>…</template>
<style scoped>…</style>  <!-- optional -->
```

### @forge/router
Signal-based router using `router.ts` (Router service), `outlet.ts` (RouterOutlet), `link.ts` (RouterLink), and `route-matcher.ts`. Supports lazy-loaded routes.

### @forge/cli
CLI binary (`bin.ts`) with `dev`, `build`, and `new` subcommands. User config via `defineConfig()` in `forge.config.ts`:
```ts
{ entry?, outDir?, port?, plugins? }
```

### Testing
- **Vitest** with `happy-dom` for DOM tests
- Tests live in `packages/*/__tests__/**/*.test.ts`
- Node.js >= 20.0.0 required
