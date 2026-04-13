# Your First Component

In this guide we'll build a counter component step by step, introducing signals, template syntax, and event handling along the way.

## Step 1: Create the file

Create `src/Counter.forge`. The `.forge` extension tells the compiler this is a Single File Component.

```forge
<script lang="ts">
</script>

<template>
</template>
```

A `.forge` file has three optional blocks:
- `<script lang="ts">` — your component logic (TypeScript or JavaScript)
- `<template>` — the HTML-like template
- `<style scoped>` — styles scoped to this component

## Step 2: Add reactive state

Import `signal` from `@forge/core` and create a reactive counter:

```forge
<script lang="ts">
import { signal } from '@forge/core'

const count = signal(0)
</script>

<template>
  <div>
    <p>Count: {count()}</p>
  </div>
</template>
```

`signal(0)` creates a writable signal with an initial value of `0`. To read the current value, call it like a function: `count()`. The `{count()}` syntax in the template is an interpolation — it creates a reactive text node that updates whenever `count` changes.

## Step 3: Add a button and handle clicks

Use `@click` to bind a click event handler:

```forge
<script lang="ts">
import { signal } from '@forge/core'

const count = signal(0)

function increment() {
  count.update(n => n + 1)
}
</script>

<template>
  <div>
    <p>Count: {count()}</p>
    <button @click={increment}>Increment</button>
  </div>
</template>
```

`count.update(fn)` takes a function that receives the previous value and returns the next one. You can also use `count.set(42)` to set a value directly.

## Step 4: Add computed state

Use `computed` to derive values from signals. Computed values are lazy — they only re-evaluate when one of their signal dependencies changes, and only when read:

```forge
<script lang="ts">
import { signal, computed } from '@forge/core'

const count = signal(0)
const doubled = computed(() => count() * 2)
const isEven = computed(() => count() % 2 === 0)

function increment() {
  count.update(n => n + 1)
}

function decrement() {
  count.update(n => n - 1)
}

function reset() {
  count.set(0)
}
</script>

<template>
  <div class="counter">
    <h2>{count()}</h2>
    <p>Doubled: {doubled()}</p>
    <p>{isEven() ? 'Even' : 'Odd'}</p>
    <div class="actions">
      <button @click={decrement}>−</button>
      <button @click={reset}>Reset</button>
      <button @click={increment}>+</button>
    </div>
  </div>
</template>
```

## Step 5: Add styles

Add a `<style scoped>` block. The `scoped` attribute ensures styles only apply to this component's elements:

```forge
<script lang="ts">
import { signal, computed } from '@forge/core'

const count = signal(0)
const doubled = computed(() => count() * 2)
const isEven = computed(() => count() % 2 === 0)

function increment() { count.update(n => n + 1) }
function decrement() { count.update(n => n - 1) }
function reset() { count.set(0) }
</script>

<template>
  <div class="counter">
    <h2 class:even={isEven()}>{count()}</h2>
    <p>Doubled: {doubled()}</p>
    <div class="actions">
      <button @click={decrement}>−</button>
      <button @click={reset} class="reset">Reset</button>
      <button @click={increment}>+</button>
    </div>
  </div>
</template>

<style scoped>
.counter {
  font-family: system-ui, sans-serif;
  text-align: center;
  padding: 2rem;
  max-width: 300px;
  margin: 0 auto;
}

h2 {
  font-size: 4rem;
  margin: 0;
  color: #6366f1;
  transition: color 0.2s;
}

h2.even {
  color: #10b981;
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 1rem;
}

button {
  padding: 8px 20px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.15s;
}

button:hover {
  background: #4f46e5;
}

button.reset {
  background: #e5e7eb;
  color: #374151;
}

button.reset:hover {
  background: #d1d5db;
}
</style>
```

Notice `class:even={isEven()}` — this is a conditional class binding that adds or removes the `even` class based on the signal value.

## Step 6: Mount the component

In your `src/main.ts`:

```ts
import { bootstrapApp } from '@forge/core'
import { createComponent, mountComponent } from '@forge/core/dom'
import Counter from './Counter.forge'

const injector = bootstrapApp([])
const ctx = createComponent(injector)
mountComponent(Counter, document.getElementById('app')!, ctx)
```

## Try it in the Playground

Edit the counter live in your browser:

<ClientOnly>
  <ForgePlayground height="520px" />
</ClientOnly>

## What you learned

- `signal(initialValue)` creates reactive state
- `count()` reads the current value; `count.set(v)` and `count.update(fn)` write it
- `computed(() => expr)` derives a lazy computed value
- `{expr}` in templates creates reactive text interpolation
- `@event={handler}` binds DOM event listeners
- `class:name={bool}` toggles a CSS class reactively
- `<style scoped>` scopes styles to the component

## Next Steps

- [Reactivity](/guide/reactivity) — deeper look at signals, effects, and batching
- [Template Syntax](/guide/templates) — all template directives
- [Components & SFCs](/guide/components) — props, lifecycle, child components
