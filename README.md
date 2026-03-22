# ⚡ Forge

> A compiled, signal-first JavaScript framework for enterprise applications.
> Angular's structure. SolidJS's speed. Vue's elegance.

---

## Packages

| Package | Description | Status |
|---|---|---|
| [`@forge/core`](./packages/core) | Reactivity primitives + dependency injection | ✅ Complete |
| [`@forge/compiler`](./packages/compiler) | `.forge` SFC parser + template compiler | ✅ Steps 4–5 complete / 🔜 Step 6 |
| [`@forge/cli`](./packages/cli) | `forge new` / `forge dev` / `forge build` | 🔜 Step 7 |

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

### Run the Counter Example

```bash
cd examples/counter-app
node --input-type=module < src/main.ts
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

### Component Scoped Services

```ts
@Injectable({ providedIn: 'component' })
class DialogService { ... }

// Each component subtree gets its own instance
const child = app.createChild([/* component providers */]);
```

---

## Build Roadmap

- [x] **Step 1** — Reactivity Core (`signal`, `computed`, `effect`, `batch`, `untrack`)
- [x] **Step 2** — DI System (`@Injectable`, `inject`, `Injector`, `InjectionToken`)
- [x] **Step 3** — Runtime DOM Layer
- [x] **Step 4** — `.forge` SFC Parser
- [ ] **Step 5** — Template Compiler
- [ ] **Step 6** — Rolldown Plugin
- [ ] **Step 7** — Dev CLI
- [ ] **Step 8** — Router + Forms

---

## Project Structure

```
forge/
├── package.json            ← monorepo root (npm workspaces)
├── tsconfig.json           ← root TS config with project references
├── vitest.config.ts        ← unified test runner
├── .eslintrc.cjs
│
├── packages/
│   ├── core/               ← @forge/core
│   │   ├── src/
│   │   │   ├── index.ts    ← public API barrel
│   │   │   ├── reactivity.ts
│   │   │   ├── di.ts
│   │   │   └── dom.ts      ← runtime DOM layer
│   │   └── __tests__/
│   │       ├── reactivity.test.ts
│   │       ├── di.test.ts
│   │       └── dom.test.ts
│   │
│   ├── compiler/           ← @forge/compiler (Step 4–6)
│   │   ├── src/
│   │   │   ├── index.ts    ← public barrel
│   │   │   └── parser.ts   ← parseSFC() ✅
│   │   └── __tests__/
│   │       └── parser.test.ts
│   │
│   └── cli/                ← @forge/cli (Step 7)
│       └── src/
│           ├── index.ts
│           └── bin.ts      ← forge <command>
│
└── examples/
    └── counter-app/        ← minimal working example (Node, no DOM)
        └── src/
            ├── main.ts
            └── counter.service.ts
```

---

## Bundler

Forge uses [Rolldown](https://rolldown.rs) — a Rust-based Rollup-compatible bundler.
It is significantly faster than Rollup/Vite at enterprise scale and supports the same plugin API,
meaning the `@forge/compiler` Rolldown plugin will be portable.

---

## License

MIT
