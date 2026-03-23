# Introduction

## What is Forge?

Forge is a compiled, signal-first JavaScript framework for building enterprise web applications. It takes the best ideas from established frameworks and combines them into a cohesive, high-performance whole:

- **Angular's structure** — hierarchical dependency injection, decorators, and a clear module system that scales to large teams
- **SolidJS's speed** — fine-grained reactivity with no Virtual DOM overhead; DOM updates are surgical and direct
- **Vue's elegance** — Single File Components that co-locate your script, template, and styles in one place

Forge compiles `.forge` SFCs at build time using the Rolldown-powered compiler pipeline. There is no runtime template interpreter — your templates become plain JavaScript functions that call directly into the DOM runtime.

## Core Philosophy

### Signals Over Virtual DOM

The Virtual DOM was a clever workaround for the complexity of tracking what changed. Forge takes a different approach: **signals** are the source of truth for reactive state. When a signal changes, only the DOM nodes that read that signal are updated — no diffing, no tree traversal, no component re-renders.

```ts
import { signal, computed, effect } from '@forge/core'

const count = signal(0)
const doubled = computed(() => count() * 2)

effect(() => {
  console.log(`count is ${count()}, doubled is ${doubled()}`)
})

count.set(5)
// Logs: "count is 5, doubled is 10"
// Only effects that read count() re-run — nothing else.
```

### Dependency Injection for Structure

Large applications need a way to share services across the component tree without prop drilling or global singletons. Forge's DI system — inspired by Angular's — lets you declare services with `@Injectable`, resolve them with `inject()`, and scope them to the right level of the injector hierarchy.

```ts
import { Injectable, inject } from '@forge/core'
import { signal } from '@forge/core'

@Injectable({ providedIn: 'root' })
class AuthService {
  readonly currentUser = signal<User | null>(null)

  login(user: User) {
    this.currentUser.set(user)
  }
}

// In any component:
const auth = inject(AuthService)
```

### Single File Components for Developer Experience

`.forge` files keep everything about a component together. The compiler splits the file into blocks, strips TypeScript, compiles the template, and outputs a JavaScript module — no extra config required.

```forge
<script lang="ts">
import { signal } from '@forge/core'

const count = signal(0)
</script>

<template>
  <button @click={count.update(n => n + 1)}>
    Clicked {count()} times
  </button>
</template>

<style scoped>
button {
  background: #6366f1;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
```

## Quick 5-Minute Example

Let's build a simple counter to see how Forge fits together.

### 1. Create a signal

```ts
import { signal } from '@forge/core'

const count = signal(0)

count()           // read → 0
count.set(1)      // set to a value
count.update(n => n + 1)  // functional update → 2
```

### 2. Derive computed state

```ts
import { signal, computed } from '@forge/core'

const count = signal(0)
const doubled = computed(() => count() * 2)
const label = computed(() => count() === 1 ? 'click' : 'clicks')

doubled()  // → 0, re-evaluates lazily when count changes
```

### 3. Create a component

```forge
<script lang="ts">
import { signal, computed } from '@forge/core'

const count = signal(0)
const doubled = computed(() => count() * 2)

function increment() {
  count.update(n => n + 1)
}

function reset() {
  count.set(0)
}
</script>

<template>
  <div class="counter">
    <h1>{count()} <span>× 2 = {doubled()}</span></h1>
    <div class="actions">
      <button @click={increment}>+1</button>
      <button @click={reset}>Reset</button>
    </div>
  </div>
</template>

<style scoped>
.counter { text-align: center; padding: 2rem; }
.actions { display: flex; gap: 8px; justify-content: center; margin-top: 1rem; }
button {
  padding: 8px 20px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
</style>
```

### 4. Bootstrap the app

```ts
// src/main.ts
import { bootstrapApp } from '@forge/core'
import { createComponent, mountComponent } from '@forge/core/dom'
import Counter from './Counter.forge'

const injector = bootstrapApp([])
const ctx = createComponent(injector)
mountComponent(Counter, document.getElementById('app')!, ctx)
```

That's it. No compiler configuration needed — `forge dev` handles everything.

## Next Steps

- [Installation](/guide/installation) — set up a new Forge project
- [Your First Component](/guide/your-first-component) — step-by-step walkthrough
- [Reactivity](/guide/reactivity) — deep dive into signals, computed, and effects
