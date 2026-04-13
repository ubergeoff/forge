# Reactivity

Forge's reactivity system is the engine that makes your UI respond to state changes without a Virtual DOM. It is implemented in `@forge/core` as a push-pull system built on three primitives: `signal`, `computed`, and `effect`.

## signal()

A signal holds a value and notifies subscribers when it changes. Call it like a function to read; use `.set()` or `.update()` to write.

```ts
import { signal } from '@forge/core'

const count = signal(0)

// Read
count()            // → 0

// Write — set to a specific value
count.set(42)
count()            // → 42

// Write — functional update (based on previous value)
count.update(n => n + 1)
count()            // → 43
```

### Custom equality

By default, signals use `Object.is` to decide whether a value has changed. You can override this:

```ts
const user = signal({ id: 1, name: 'Alice' }, {
  equals: (a, b) => a.id === b.id,
})

// Setting the same id will not trigger notifications
user.set({ id: 1, name: 'Bob' }) // no update — same id
```

### asReadonly()

Expose a signal's read interface without the write methods:

```ts
const _count = signal(0)
export const count = _count.asReadonly()

// count() works; count.set() does not exist on ReadonlySignal
```

## computed()

`computed` creates a derived value that re-evaluates lazily when its dependencies change. It is **memoized** — reading it multiple times before a dependency changes returns the cached value without re-running the computation.

```ts
import { signal, computed } from '@forge/core'

const firstName = signal('Jane')
const lastName = signal('Doe')

const fullName = computed(() => `${firstName()} ${lastName()}`)

fullName()  // → 'Jane Doe'

firstName.set('John')
fullName()  // → 'John Doe' (recomputed once)
fullName()  // → 'John Doe' (cached — no recomputation)
```

### Computed chains

Computed values can depend on other computed values:

```ts
const price = signal(100)
const tax = computed(() => price() * 0.2)
const total = computed(() => price() + tax())

total()  // → 120

price.set(200)
total()  // → 240 — both tax and total update automatically
```

### Custom equality for computed

Like signals, computed values accept a custom equality check. This is useful when the derived value is an object or array:

```ts
const items = signal([1, 2, 3])
const sorted = computed(
  () => [...items()].sort((a, b) => a - b),
  { equals: (a, b) => a.join(',') === b.join(',') }
)
```

## effect()

`effect` runs a side-effect function immediately and re-runs it whenever any signal read inside it changes. It returns an `EffectHandle` with a `destroy()` method to stop the effect.

```ts
import { signal, effect } from '@forge/core'

const count = signal(0)

const handle = effect(() => {
  console.log('count changed to', count())
})
// Immediately logs: "count changed to 0"

count.set(1)
// Logs: "count changed to 1"

handle.destroy()
count.set(2)
// Nothing — effect is stopped
```

### Cleanup function

An effect can optionally return a cleanup function. The cleanup runs before the next execution and when the effect is destroyed:

```ts
const enabled = signal(false)

effect(() => {
  if (!enabled()) return

  const handler = () => console.log('scroll')
  window.addEventListener('scroll', handler)

  // Cleanup: remove listener before next run or on destroy
  return () => window.removeEventListener('scroll', handler)
})
```

### Effects and the DOM

The Forge DOM runtime uses effects internally to keep DOM nodes in sync with signals. When you write `{count()}` in a template, the compiler generates a `bindText` call that creates an effect watching `count`. You usually do not need to write effects for DOM updates — the template compiler handles that.

Use effects for non-DOM side effects: logging, network requests, WebSocket subscriptions, localStorage sync, etc.

## batch()

Multiple signal writes inside a `batch()` call are grouped into a single flush. Effects run once after the outermost batch completes, not after each write:

```ts
import { signal, effect, batch } from '@forge/core'

const x = signal(0)
const y = signal(0)

effect(() => {
  console.log(`x=${x()}, y=${y()}`)
})
// Logs: "x=0, y=0"

batch(() => {
  x.set(1)
  y.set(2)
  // Effect has NOT run yet
})
// Effect runs once here: "x=1, y=2"
```

Batching is especially useful in form handlers and animations where you update several signals at once.

## untrack()

`untrack` lets you read signals inside a reactive context without creating a dependency on them:

```ts
import { signal, effect, untrack } from '@forge/core'

const trigger = signal(0)
const data = signal('hello')

effect(() => {
  trigger()  // subscribe to trigger

  // Read data WITHOUT subscribing — won't re-run when data changes
  const value = untrack(() => data())
  console.log('trigger fired, data is:', value)
})

trigger.update(n => n + 1)  // → re-runs the effect
data.set('world')            // → does NOT re-run the effect
```

## isSignal()

A type guard to check whether a value is a signal:

```ts
import { signal, computed, isSignal } from '@forge/core'

const count = signal(0)
const doubled = computed(() => count() * 2)
const plainFn = () => 42

isSignal(count)    // → true
isSignal(doubled)  // → true
isSignal(plainFn)  // → false
```

## Reactivity Rules

A few important rules to keep in mind:

1. **Read signals inside effects or computed to create subscriptions.** Reading a signal outside a reactive context just returns its current value without subscribing.

2. **Never write to a signal inside a computed.** Computed functions should be pure derivations. Writing inside a computed causes an error.

3. **Effects run synchronously before any async operations.** If your effect starts a `setTimeout` or `fetch`, the async work happens outside the reactive context and cannot create new subscriptions.

4. **Signals use `Object.is` equality by default.** Writing the same value does not notify subscribers. This means `mySignal.set(mySignal())` is a no-op.

## Relationship Diagram

```
signal(value)
    │
    ├──► computed(fn)  ──► computed(fn)  ──► ...
    │         │
    └──► effect(fn)  ◄── (updates DOM, logs, fetches, etc.)
```

When a signal changes:
1. All subscribed computed values are marked **dirty** (but not re-evaluated yet)
2. All subscribed effects are scheduled to re-run
3. If we're inside a `batch()`, effects are deferred until the batch ends
4. When an effect or computed is next read/run, it re-evaluates and re-subscribes

This push-pull model means work is only done when values are actually needed — no wasted computation.
