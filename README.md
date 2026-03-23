# Forge

> A compiled, signal-first JavaScript framework for enterprise applications.
> Angular's structure. SolidJS's speed. Vue's elegance.

---

## Packages

| Package | Description | Status |
|---|---|---|
| [`@forge/core`](./packages/core) | Reactivity primitives + dependency injection + DOM runtime | ✅ Complete |
| [`@forge/compiler`](./packages/compiler) | `.forge` SFC parser + template compiler + Rolldown plugin | ✅ Complete |
| [`@forge/router`](./packages/router) | Signal-driven client-side router with lazy loading | ✅ Complete |
| [`@forge/forms`](./packages/forms) | Reactive form controls, validation, and `[formControl]` binding | ✅ Complete |
| [`@forge/cli`](./packages/cli) | `forge new` / `forge dev` / `forge build` | ✅ Complete |

---

## Architecture

```
.forge SFC file
      │
      ▼
[@forge/compiler]  parseSFC() → AST → compileSFC() → JS module
      │
      ▼
[@forge/core]      signal() / computed() / effect() / inject()
      │
      ├── [@forge/router]   Router / RouterOutlet / RouterLink
      │
      ├── [@forge/forms]    formControl() / formGroup() / formArray()
      │
      ▼
[Rolldown]         forgePlugin() bundles everything → optimised output
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- npm >= 10

### Install

```bash
npm install
```

### Run Tests

```bash
# Run all tests across all packages
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Build All Packages

```bash
npm run build
```

### Run the Counter App Example

```bash
cd examples/counter-app
npm install
npm run dev
```

---

## Core Concepts

### Signals

```ts
import { signal, computed, effect, batch } from '@forge/core';

const count = signal(0);
const doubled = computed(() => count() * 2);

effect(() => console.log('doubled:', doubled()));

batch(() => {
  count.set(5);  // effect fires once, not per-write
});
```

### Dependency Injection

```ts
import { Injectable, inject, bootstrapApp, runInContext } from '@forge/core';

@Injectable({ providedIn: 'root' })
class UserService {
  readonly #users = signal<string[]>([]);
  readonly users = this.#users.asReadonly();
}

const app = bootstrapApp();
const users = runInContext(app, () => inject(UserService));
```

### Injection Tokens

```ts
import { InjectionToken, inject } from '@forge/core';

const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => 'https://api.example.com',
});

const url = inject(API_URL); // → 'https://api.example.com'
```

### Single File Components

```html
<!-- counter.forge -->
<script lang="ts">
  import { signal } from '@forge/core';

  const count = signal(0);
  const increment = () => count.set(count() + 1);
</script>

<template>
  <div>
    <p>Count: {count()}</p>
    <button [@click]={increment}>Increment</button>
  </div>
</template>

<style scoped>
  p { font-weight: bold; }
</style>
```

### Router

```ts
import { provideRouter, lazy } from '@forge/router';
import { bootstrapApp } from '@forge/core';

const routes = [
  { path: '/',        component: () => import('./pages/home.forge') },
  { path: '/about',   component: lazy(() => import('./pages/about.forge')) },
  { path: '/item/:id', component: lazy(() => import('./pages/item.forge')) },
  { path: '**',       redirectTo: '/' },
];

const app = bootstrapApp([provideRouter(routes)]);
```

```html
<!-- app-shell.forge -->
<template>
  <nav>
    <router-link to="/">Home</router-link>
    <router-link to="/about">About</router-link>
  </nav>
  <router-outlet></router-outlet>
</template>
```

### Reactive Forms

```ts
import { formControl, formGroup, Validators } from '@forge/forms';

const loginForm = formGroup({
  email:    formControl('', [Validators.required, Validators.email]),
  password: formControl('', [Validators.required, Validators.minLength(8)]),
});

// Read reactive state
loginForm.value();   // { email: '', password: '' }
loginForm.valid();   // false
loginForm.errors();  // aggregated errors
```

```html
<!-- login.forge -->
<template>
  <form>
    <input [formControl]={loginForm.controls.email} type="email" />
    <input [formControl]={loginForm.controls.password} type="password" />
    <button [:disabled]={!loginForm.valid()}>Submit</button>
  </form>
</template>
```

### Template Directives

| Directive | Purpose | Example |
|---|---|---|
| `{expr}` | Text interpolation | `{count()}` |
| `[bind]={expr}` | Attribute binding | `[class]="active"` |
| `[prop]={expr}` | Property binding | `[value]={name()}` |
| `[@event]={fn}` | Event listener | `[@click]={handleClick}` |
| `[:show]={expr}` | Conditional display | `[:show]={isVisible()}` |
| `[:class]={obj}` | Class map binding | `[:class]={ active: isOn() }` |
| `[formControl]={ctrl}` | Two-way form binding | `[formControl]={emailCtrl}` |

---

## Project Structure

```
forge/
├── package.json            ← monorepo root (npm workspaces)
├── tsconfig.json           ← root TS config with project references
├── vitest.config.ts        ← unified test runner
│
├── packages/
│   ├── core/               ← @forge/core
│   │   └── src/
│   │       ├── reactivity.ts  ← signal / computed / effect / batch / untrack
│   │       ├── di.ts          ← @Injectable / inject / Injector / InjectionToken
│   │       ├── dom.ts         ← DOM runtime (createElement, bind*, createComponent)
│   │       └── index.ts
│   │
│   ├── compiler/           ← @forge/compiler
│   │   └── src/
│   │       ├── parser.ts   ← parseSFC()
│   │       ├── compiler.ts ← compileSFC()
│   │       ├── plugin.ts   ← forgePlugin() for Rolldown
│   │       └── index.ts
│   │
│   ├── router/             ← @forge/router
│   │   └── src/
│   │       ├── router.ts        ← Router service + ROUTER token
│   │       ├── route-matcher.ts ← parameterized URL matching
│   │       ├── outlet.ts        ← RouterOutlet
│   │       ├── link.ts          ← RouterLink
│   │       ├── components.ts    ← template-ready factories
│   │       ├── types.ts
│   │       └── index.ts
│   │
│   ├── forms/              ← @forge/forms
│   │   └── src/
│   │       ├── control.ts    ← formControl()
│   │       ├── group.ts      ← formGroup()
│   │       ├── array.ts      ← formArray()
│   │       ├── validators.ts ← Validators + compose()
│   │       ├── types.ts
│   │       └── index.ts
│   │
│   └── cli/                ← @forge/cli
│       └── src/
│           ├── bin.ts              ← forge <command>
│           ├── commands/
│           │   ├── dev.ts
│           │   ├── build.ts
│           │   ├── new.ts
│           │   └── typecheck.ts
│           ├── utils/config.ts
│           └── index.ts            ← defineConfig()
│
└── examples/
    └── counter-app/        ← full SPA demo using all packages
        └── src/
            ├── app-shell.forge
            ├── browser-main.ts
            ├── components/         ← counter.forge, counter-display.forge, …
            ├── pages/              ← home, counter, forms, about, reactivity
            └── services/           ← counter.service.ts
```

---

## Build System

Forge uses [Rolldown](https://rolldown.rs) — a Rust-based Rollup-compatible bundler. Each package produces ESM (`.js`) and CJS (`.cjs`) with `.d.ts` declarations and source maps under `dist/`.

[Nx](https://nx.dev) orchestrates the monorepo build graph with caching. Build dependency order:

```
core → compiler
core → router
core → forms
compiler + router + forms → cli
```

---

## CLI

```bash
# Scaffold a new project
forge new my-app

# Start dev server (default port 3000)
forge dev

# Production build
forge build
```

`forge.config.ts`:

```ts
import { defineConfig } from '@forge/cli';

export default defineConfig({
  entry:   'src/main.ts',
  outDir:  'dist',
  port:    3000,
  plugins: [],
});
```

---

## Build Roadmap

- [x] **Step 1** — Reactivity Core (`signal`, `computed`, `effect`, `batch`, `untrack`)
- [x] **Step 2** — DI System (`@Injectable`, `inject`, `Injector`, `InjectionToken`)
- [x] **Step 3** — Runtime DOM Layer
- [x] **Step 4** — `.forge` SFC Parser
- [x] **Step 5** — Template Compiler
- [x] **Step 6** — Rolldown Plugin
- [x] **Step 7** — Dev CLI (`forge new` / `forge dev` / `forge build`)
- [x] **Step 8** — Router (`@forge/router`)
- [x] **Step 9** — Forms (`@forge/forms` + `[formControl]` directive)

---

## License

MIT
