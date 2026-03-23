# Components & SFCs

## Single File Components

A Forge Single File Component (SFC) is a `.forge` file that contains up to three blocks:

```forge
<script lang="ts">
// Component logic
</script>

<template>
  <!-- HTML-like template -->
</template>

<style scoped>
/* Component styles */
</style>
```

The compiler processes each block:
- The `<script>` block is TypeScript-stripped and becomes the module's top-level code
- The `<template>` block is compiled to a render function that uses the DOM runtime
- The `<style>` block is extracted and injected as a `<style>` element at runtime

All three blocks are optional. A component with only a `<template>` is perfectly valid.

## The Script Block

The script block is plain TypeScript (or JavaScript). Variables, functions, and classes declared here are available to the template. The compiler wraps everything into an exported factory function.

```forge
<script lang="ts">
import { signal, computed, effect } from '@forge/core'
import { inject } from '@forge/core'
import { UserService } from './user.service'

// DI resolution — runs once when the component is mounted
const userService = inject(UserService)

// Reactive state
const name = signal('World')
const greeting = computed(() => `Hello, ${name()}!`)

// Lifecycle — effects run immediately and clean up on destroy
effect(() => {
  document.title = greeting()
})
</script>

<template>
  <h1>{greeting()}</h1>
</template>
```

### lang attribute

Use `lang="ts"` to enable TypeScript. The compiler uses `oxc-transform` to strip types before running. Omitting the attribute treats the block as plain JavaScript.

## The Template Block

Templates use an HTML-like syntax with Forge directives. See [Template Syntax](/guide/templates) for the full reference.

```forge
<template>
  <div class="card">
    <h2>{title()}</h2>
    <p :class="{'active': isActive()}">Status</p>
    <button @click={handleClick} :show={canClick()}>
      Click me
    </button>
  </div>
</template>
```

## The Style Block

### Global styles

```forge
<style>
/* applies globally */
.button { background: #6366f1; }
</style>
```

### Scoped styles

With `scoped`, styles only apply to elements in this component. The compiler adds a unique `data-v-{scopeId}` attribute to every element and rewrites CSS selectors to match.

```forge
<style scoped>
/* only applies to .button elements in THIS component */
.button { background: #6366f1; }
</style>
```

### SCSS

```forge
<style lang="scss" scoped>
$brand: #6366f1;

.button {
  background: $brand;
  &:hover { background: darken($brand, 10%); }
}
</style>
```

## Component Lifecycle

Forge components are created by the DOM runtime's `mountComponent` / `mountChild` functions. The lifecycle is:

1. **Create** — `createComponent(injector)` creates a `ComponentContext` with a child injector
2. **Mount** — the factory function runs, building the DOM tree and setting up reactive effects
3. **Active** — effects keep the DOM in sync with signal changes
4. **Destroy** — `destroyComponent(ctx)` tears down child contexts, destroys all effects, and calls `injector.destroy()`

### onDestroy

Register cleanup callbacks inside a service or component that's instantiated within a DI context:

```ts
import { onDestroy } from '@forge/core'

// Inside a service constructor or component script
onDestroy(() => {
  console.log('component torn down')
})
```

## Props

Props are passed as getter functions so both static and reactive values share a uniform API at the call site.

### Defining a child component that accepts props

```forge
<!-- src/Greeting.forge -->
<script lang="ts">
// Props are injected as a second argument to the compiled factory.
// Declare them using a typed interface and access via the runtime props object.
// The compiler passes props as: { propName: () => value }

declare const props: { name: () => string }
</script>

<template>
  <p>Hello, {props.name()}!</p>
</template>
```

### Using a child component

```forge
<!-- src/App.forge -->
<script lang="ts">
import { signal } from '@forge/core'
import Greeting from './Greeting.forge'

const username = signal('Alice')
</script>

<template>
  <div>
    <Greeting :name={username()} />
    <input @input={e => username.set(e.target.value)} .value={username()} />
  </div>
</template>
```

Child component tags are Pascal-cased. The compiler imports the child factory and calls `mountChild` to create a scoped child context.

## Component Context

Under the hood, every component has a `ComponentContext`:

```ts
interface ComponentContext {
  injector: Injector   // child injector for this component
  effects: EffectHandle[]  // effects owned by this component
  children: ComponentContext[]  // mounted child component contexts
}
```

The context is automatically managed by `mountComponent` and `mountChild`. You only need to interact with it directly if you're building low-level utilities or integrating Forge with other frameworks.

## Nested Components

Components compose naturally. Each child gets its own injector scoped under the parent's, its own set of effects, and its own DOM subtree:

```
App (root injector)
├── Header
│   └── NavLink
├── Main
│   ├── UserList
│   │   └── UserCard (× N)
│   └── Sidebar
└── Footer
```

When `destroyComponent(App)` is called, the entire tree tears down recursively from leaves to root.
