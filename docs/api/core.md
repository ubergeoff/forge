# @forge/core

The reactive foundation of Forge. Provides signals, computed values, effects, batching, dependency injection, and the DOM runtime.

```bash
npm install @forge/core
```

## Reactivity

### signal()

Creates a writable reactive signal.

```ts
function signal<T>(
  initialValue: T,
  options?: { equals?: (a: T, b: T) => boolean }
): WritableSignal<T>
```

**Parameters:**
- `initialValue` — The initial value of the signal
- `options.equals` — Custom equality function. Defaults to `Object.is`. When the setter is called with a value that is considered equal, no subscribers are notified.

**Returns:** A `WritableSignal<T>` which is a callable function (returns `T`) with additional methods.

**WritableSignal methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| Call | `() => T` | Read the current value (registers a dependency) |
| `set` | `(value: T) => void` | Set to a specific value |
| `update` | `(fn: (prev: T) => T) => void` | Functional update |
| `asReadonly` | `() => ReadonlySignal<T>` | Expose read-only interface |

**Example:**
```ts
import { signal } from '@forge/core'

const count = signal(0)
count()           // → 0
count.set(5)
count.update(n => n + 1)
count()           // → 6
```

---

### computed()

Creates a lazily-evaluated derived value that memoizes its result.

```ts
function computed<T>(
  compute: () => T,
  options?: { equals?: (a: T, b: T) => boolean }
): ComputedSignal<T>
```

**Parameters:**
- `compute` — Pure function that reads signals and returns a derived value
- `options.equals` — Custom equality for the computed result

**Returns:** A `ComputedSignal<T>` — a read-only callable that re-evaluates lazily when dependencies change.

**Example:**
```ts
import { signal, computed } from '@forge/core'

const price = signal(100)
const tax = computed(() => price() * 0.2)
const total = computed(() => price() + tax())

total()  // → 120
price.set(200)
total()  // → 240
```

---

### effect()

Runs a side-effect function immediately and re-runs whenever its signal dependencies change.

```ts
function effect(fn: () => void | (() => void)): EffectHandle
```

**Parameters:**
- `fn` — The side-effect function. May return a cleanup function.

**Returns:** An `EffectHandle` with a `destroy()` method to stop the effect.

**EffectHandle:**
```ts
interface EffectHandle {
  destroy(): void  // Stop the effect and release all subscriptions
}
```

**Example:**
```ts
import { signal, effect } from '@forge/core'

const title = signal('Forge')

const handle = effect(() => {
  document.title = title()
  return () => { document.title = '' }  // cleanup
})

title.set('New Title')  // effect re-runs
handle.destroy()        // effect stops, cleanup runs
```

---

### batch()

Groups multiple signal writes into a single effect flush.

```ts
function batch(fn: () => void): void
```

Effects only run once after the outermost `batch()` completes, not after each write.

**Example:**
```ts
import { signal, effect, batch } from '@forge/core'

const x = signal(0)
const y = signal(0)

batch(() => {
  x.set(1)
  y.set(2)
  // Effects have not run yet
})
// Effects run here — once
```

---

### untrack()

Reads signals inside `fn` without creating dependency subscriptions.

```ts
function untrack<T>(fn: () => T): T
```

**Example:**
```ts
import { signal, effect, untrack } from '@forge/core'

const trigger = signal(0)
const data = signal('value')

effect(() => {
  trigger()  // subscribed
  const value = untrack(() => data())  // NOT subscribed
  console.log(value)
})
```

---

### isSignal()

Type guard to check whether a value is a signal (writable or computed).

```ts
function isSignal(value: unknown): value is ReadonlySignal<unknown>
```

---

## Types

### WritableSignal\<T\>

```ts
interface WritableSignal<T> extends ReadonlySignal<T> {
  set(value: T): void
  update(fn: (prev: T) => T): void
  asReadonly(): ReadonlySignal<T>
}
```

### ReadonlySignal\<T\>

```ts
interface ReadonlySignal<T> {
  (): T  // callable
  readonly __type: 'signal'
}
```

### ComputedSignal\<T\>

Extends `ReadonlySignal<T>`. Identical interface to `ReadonlySignal` but created by `computed()`.

### EffectHandle

```ts
interface EffectHandle {
  destroy(): void
}
```

---

## Dependency Injection

### @Injectable

Class decorator that marks a class as injectable.

```ts
function Injectable(options?: InjectableOptions): ClassDecorator

interface InjectableOptions {
  providedIn?: 'root' | 'component' | Injector
}
```

**Defaults:** `providedIn: 'root'`

**Example:**
```ts
import { Injectable } from '@forge/core'

@Injectable({ providedIn: 'root' })
class UserService {
  // ...
}
```

---

### @Inject

Class decorator that declares constructor dependencies for DI. Required when `emitDecoratorMetadata` is not enabled.

```ts
function Inject(deps: Token<unknown>[]): ClassDecorator
```

**Example:**
```ts
@Injectable({ providedIn: 'root' })
@Inject([HttpClient, AuthService])
class UserService {
  constructor(private http: HttpClient, private auth: AuthService) {}
}
```

---

### InjectionToken\<T\>

A typed token for injecting non-class values.

```ts
class InjectionToken<T> {
  constructor(
    description: string,
    options?: {
      providedIn?: ProvidedIn
      factory?: () => T
    }
  )
  readonly id: number
  readonly description: string
  toString(): string
}
```

**Example:**
```ts
import { InjectionToken } from '@forge/core'

export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => 'https://api.example.com',
})
```

---

### inject()

Resolves a token from the active injection context.

```ts
function inject<T>(token: Token<T>, options?: { optional?: false }): T
function inject<T>(token: Token<T>, options: { optional: true }): T | null
```

Must be called during component mounting or service instantiation.

**Example:**
```ts
import { inject } from '@forge/core'

const service = inject(UserService)
const url = inject(API_URL)
const maybe = inject(OPTIONAL_TOKEN, { optional: true })  // → T | null
```

---

### Injector

The DI container. Resolves and caches provider instances.

```ts
class Injector {
  constructor(providers?: Provider<unknown>[], parent?: Injector | null)

  get<T>(token: Token<T>, optional?: false): T
  get<T>(token: Token<T>, optional: true): T | null

  createChild(providers?: Provider<unknown>[]): Injector
  destroy(): void
}
```

---

### bootstrapApp()

Creates the root injector with the given providers.

```ts
function bootstrapApp(providers?: Provider<unknown>[]): Injector
```

**Example:**
```ts
import { bootstrapApp } from '@forge/core'

const injector = bootstrapApp([
  { provide: API_URL, useValue: 'https://api.example.com' },
])
```

---

### runInContext()

Runs a function within a specific injector context.

```ts
function runInContext<T>(injector: Injector, fn: () => T): T
```

---

### onDestroy()

Registers a cleanup callback for when the owning injector is destroyed.

```ts
function onDestroy(fn: () => void): void
```

Must be called within an injection context.

---

## Provider Types

```ts
type Provider<T> =
  | ClassProvider<T>
  | ValueProvider<T>
  | FactoryProvider<T>
  | ExistingProvider<T>

interface ClassProvider<T> {
  provide: Token<T>
  useClass: new (...args: unknown[]) => T
  deps?: Token<unknown>[]
}

interface ValueProvider<T> {
  provide: Token<T>
  useValue: T
}

interface FactoryProvider<T> {
  provide: Token<T>
  useFactory: (...args: unknown[]) => T
  deps?: Token<unknown>[]
}

interface ExistingProvider<T> {
  provide: Token<T>
  useExisting: Token<T>
}
```

---

## DOM Runtime

Exported from `@forge/core/dom`. Used by the compiled template output; you typically do not call these directly.

### createElement()

```ts
function createElement(tag: string): Element
```

### setAttr() / setProp()

```ts
function setAttr(el: Element, name: string, value: string): void
function setProp(el: Element, name: string, value: unknown): void
```

### listen()

```ts
function listen(el: Element, event: string, handler: EventListener): EffectHandle
```

### insert() / remove()

```ts
function insert(parent: Node, child: Node, anchor?: Node | null): void
function remove(node: Node): void
```

### Reactive bindings

```ts
function bindText(node: Text, getter: () => string): EffectHandle
function bindAttr(el: Element, name: string, getter: () => string | null): EffectHandle
function bindProp(el: Element, name: string, getter: () => unknown): EffectHandle
function bindShow(el: Element, getter: () => boolean): EffectHandle
function bindClass(el: Element, getter: () => Record<string, boolean>): EffectHandle
```

### Component lifecycle

```ts
function createComponent(parentInjector: Injector, providers?: Provider[]): ComponentContext
function destroyComponent(ctx: ComponentContext): void
function mountComponent(
  factory: (ctx: ComponentContext, props?: Record<string, () => unknown>) => Node,
  container: Element,
  ctx: ComponentContext
): void
function mountChild(
  factory: (ctx: ComponentContext, props: Record<string, () => unknown>) => Node,
  parentCtx: ComponentContext,
  props?: Record<string, () => unknown>
): Node
```

### ComponentContext

```ts
interface ComponentContext {
  injector: Injector
  effects: EffectHandle[]
  children: ComponentContext[]
}
```
