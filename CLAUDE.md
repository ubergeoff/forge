# Forge Framework — Developer Reference

**Forge** is a compiled, signal-first JavaScript framework for large enterprise applications.
> "Angular's structure. SolidJS's speed. Vue's elegance."

---

## Status

| Step | Package | Status |
|------|---------|--------|
| Reactivity Core | `@forge/core` | ✅ Complete |
| DI System | `@forge/core` | ✅ Complete |
| Runtime DOM Layer | `@forge/core` | ✅ Complete |
| SFC Parser | `@forge/compiler` | ✅ Complete |
| Template Compiler | `@forge/compiler` | ✅ Complete |
| Rolldown Plugin | `@forge/compiler` | ✅ Complete |
| Dev CLI | `@forge/cli` | ✅ Complete |
| Router + Forms | `@forge/router`, `@forge/forms` | 🔜 Next |

**You are starting at Step 8 — Router + Forms.**

---

## Monorepo Layout

```
forge/
├── package.json              ← npm workspaces: ["packages/*", "examples/*"]
├── tsconfig.json             ← project references
├── vitest.config.ts
├── packages/
│   ├── core/                 ← @forge/core
│   │   └── src/
│   │       ├── reactivity.ts
│   │       ├── di.ts
│   │       └── dom.ts
│   ├── compiler/             ← @forge/compiler
│   │   └── src/
│   │       ├── parser.ts
│   │       ├── compiler.ts
│   │       └── plugin.ts
│   └── cli/                  ← @forge/cli
│       └── src/
│           ├── bin.ts
│           └── commands/
└── examples/
    └── counter-app/
```

### Dependency graph

```
@forge/cli → @forge/compiler → @forge/core
examples/counter-app → @forge/core
```

---

## Package APIs

### `@forge/core` — Reactivity

```ts
signal<T>(initial, opts?)         → WritableSignal<T>
computed<T>(fn, opts?)            → ComputedSignal<T>
effect(fn)                        → EffectHandle
batch(fn)                         → void
untrack<T>(fn)                    → T
isSignal(val)                     → boolean
```

### `@forge/core` — DI

```ts
@Injectable({ providedIn: 'root' | 'component' | Injector })
@Inject(deps[])
InjectionToken<T>
inject<T>(token)                  → T
runInContext(injector, fn)        → T
bootstrapApp(providers?)          → Injector
resetRootInjector()               → void   // test cleanup
onDestroy(fn)                     → void
```

Provider shapes: `useValue` / `useClass` / `useFactory` / `useExisting`

### `@forge/core/dom` — DOM Runtime

```ts
createElement(tag)                → Element
setAttr(el, name, value)          → void
setProp(el, name, value)          → void
listen(el, event, handler)        → EffectHandle
insert(parent, child, anchor?)    → void
remove(node)                      → void
bindText(node, getter)            → EffectHandle
bindAttr(el, name, getter)        → EffectHandle
bindProp(el, name, getter)        → EffectHandle
bindShow(el, getter)              → EffectHandle
bindClass(el, getter)             → EffectHandle
createComponent(injector, providers?) → ComponentContext
destroyComponent(ctx)             → void
mountComponent(factory, container, ctx) → void
```

### `@forge/compiler`

```ts
parseSFC(source, filename)        → SFCDescriptor
compileSFC(descriptor)            → CompileResult
forgePlugin()                     → RolldownPlugin
```

### `@forge/cli`

```ts
defineConfig(config: ForgeConfig) → ForgeConfig
// CLI: forge new | forge dev | forge build | forge typecheck
```

---

## Step 8 — Router + Forms

### `@forge/router` (new package)

- File-based + config-based routing
- Lazy-loaded routes by default
- Signal-driven route state (`currentRoute`, `params`, `query`)
- Outlet component pattern for nested routing

### `@forge/forms` (new package)

- Signal-driven reactive forms
- Schema validation, Zod-compatible
- `FormGroup`, `FormControl`, `FormArray` primitives
- Built-in validators, async validators

When adding a new package:
1. Create `packages/<name>/` with `package.json`, `tsconfig.json`, `rolldown.config.ts`, `src/index.ts`
2. Add `"type": "module"`, dual ESM+CJS exports, and `"sideEffects": false`
3. Add a `{ "path": "./packages/<name>" }` reference to root `tsconfig.json`
4. Add `__tests__/` alongside `src/`

---

## Conventions

### TypeScript
- `strict: true` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` — always on
- No `any` — use `unknown` and narrow
- Type-only imports: `import type { Foo } from './foo.js'`
- Internal imports use `.js` extension (ESM node resolution)
- Consumers import from package name only: `import { signal } from '@forge/core'`

### File naming
- Source: `kebab-case.ts` — one concept per file
- Tests: `kebab-case.test.ts` in `__tests__/` sibling to `src/`

### Error messages
- Prefix: `[Forge <Subsystem>]` — e.g. `[Forge Router]`, `[Forge Forms]`
- Always include actionable guidance

### Context tracking pattern
```ts
const prev = activeContext;
activeContext = newValue;
try { ... } finally { activeContext = prev; }
```

### Runtime primitives
- No classes — functions and plain objects for signals, effects, computed
- Classes only for `Injector` and `InjectionToken` (need identity)
- All reactive bindings return `EffectHandle` and are owned by `ComponentContext`

### Testing
- Vitest throughout; `// @vitest-environment happy-dom` for DOM tests
- `beforeEach(() => resetRootInjector())` in every DI test file
- DOM test environment already configured in `vitest.config.ts` for `packages/core/__tests__/dom.test.ts`

### Bundler
- **Rolldown only** — never Rollup or Vite. Hard architectural decision.

---

## Commands

```bash
npm install               # install all workspace deps
npm test                  # run all tests
npm run test:watch        # watch mode
npm run test:coverage     # coverage report
npm run typecheck         # tsc --build across all packages
npm run build             # build all packages

# Run counter-app example
cd examples/counter-app
node --loader ts-node/esm src/main.ts
```
