# Dependency Injection

Forge's DI system provides a hierarchical, type-safe way to share services across your application. It is modelled after Angular's DI but simplified for the Forge component model.

## Core Concepts

- A **token** identifies what you want to inject (a class, an `InjectionToken`, or an abstract type)
- A **provider** describes how to create the value for a given token
- An **injector** is a container that resolves tokens to instances and caches them
- Injectors form a **tree** — child injectors delegate to parents when a token isn't found locally

## @Injectable

Mark a class as injectable to register it in the DI system:

```ts
import { Injectable } from '@forge/core'
import { signal } from '@forge/core'

@Injectable({ providedIn: 'root' })
class CounterService {
  readonly count = signal(0)

  increment() {
    this.count.update(n => n + 1)
  }

  reset() {
    this.count.set(0)
  }
}
```

`providedIn: 'root'` means the service is a singleton shared across the entire app. Every call to `inject(CounterService)` returns the same instance.

### providedIn options

| Value | Behavior |
|-------|----------|
| `'root'` | Singleton shared across the whole app |
| `'component'` | A new instance is created for each component that injects it |
| `injector` | Provided in a specific `Injector` instance |

## @Inject

When a class has constructor dependencies, declare them with `@Inject`. This is required because Forge does not rely on `emitDecoratorMetadata`:

```ts
import { Injectable, Inject, inject } from '@forge/core'

@Injectable({ providedIn: 'root' })
class UserService {
  constructor(private readonly http: HttpClient) {}
}

// Tell the DI system to resolve HttpClient for the first constructor parameter
@Injectable({ providedIn: 'root' })
@Inject([HttpClient])
class UserService {
  constructor(private readonly http: HttpClient) {}
}
```

## inject()

`inject()` resolves a token from the active injection context. Call it inside a component script or service constructor:

```ts
import { inject } from '@forge/core'

// In a component's <script> block:
const counter = inject(CounterService)
const apiUrl = inject(API_URL)

// Optional injection — returns null if not provided
const optional = inject(OPTIONAL_TOKEN, { optional: true })
```

::: warning
`inject()` throws if called outside of an injection context (i.e., not during component mounting or service instantiation). Never call it in a setTimeout, promise handler, or other async context.
:::

## InjectionToken

Use `InjectionToken` for non-class values — configuration, primitives, or interfaces:

```ts
import { InjectionToken } from '@forge/core'

// A typed token with a default factory
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => 'https://api.example.com',
})

// A token without a default (must be explicitly provided)
export const FEATURE_FLAGS = new InjectionToken<FeatureFlags>('FEATURE_FLAGS')
```

Tokens with a `factory` are self-providing — they don't need to appear in a providers array unless you want to override the default.

## Providers

You can configure exactly how a token is resolved using provider objects:

### useValue

Provide a static value:

```ts
bootstrapApp([
  { provide: API_URL, useValue: 'https://staging.api.example.com' },
  { provide: APP_NAME, useValue: 'My App' },
])
```

### useClass

Provide a different class for a token:

```ts
bootstrapApp([
  { provide: UserService, useClass: MockUserService },
])
```

### useFactory

Provide a value computed by a factory function:

```ts
bootstrapApp([
  {
    provide: HttpClient,
    useFactory: (url: string) => new HttpClient(url),
    deps: [API_URL],
  },
])
```

### useExisting

Alias one token to another:

```ts
bootstrapApp([
  { provide: AuthService, useExisting: FirebaseAuthService },
])
```

## bootstrapApp()

`bootstrapApp()` creates the root injector with the given providers and returns it. Call this once at application startup:

```ts
import { bootstrapApp } from '@forge/core'
import { provideRouter } from '@forge/router'

const injector = bootstrapApp([
  { provide: API_URL, useValue: 'https://api.example.com' },
  ...provideRouter([
    { path: '/', component: HomeComponent },
  ]),
])
```

## Hierarchical Injectors

Child injectors inherit from their parent but can override providers locally. The component tree creates a matching injector tree:

```
Root Injector (bootstrapApp providers)
  └── App Injector
        ├── Header Injector
        └── Main Injector
              └── UserCard Injector
```

When `UserCard` calls `inject(UserService)`, the resolution walks up: UserCard → Main → App → Root. The first injector that has a provider for `UserService` wins.

### createChild()

You can create child injectors manually:

```ts
const child = rootInjector.createChild([
  { provide: UserService, useClass: MockUserService },
])

const mock = child.get(UserService) // → MockUserService instance
const real = rootInjector.get(UserService) // → real UserService
```

## onDestroy()

Register cleanup callbacks to run when an injector is destroyed:

```ts
import { Injectable, onDestroy } from '@forge/core'

@Injectable({ providedIn: 'root' })
class WebSocketService {
  #ws: WebSocket

  constructor() {
    this.#ws = new WebSocket('wss://example.com/ws')
    onDestroy(() => this.#ws.close())
  }
}
```

## runInContext()

Run a function within a specific injector context, enabling `inject()` calls inside it:

```ts
import { runInContext } from '@forge/core'

const instance = runInContext(injector, () => {
  const service = inject(SomeService)
  return new MyClass(service)
})
```

## Complete Example

```ts
// services/todo.service.ts
import { Injectable, inject } from '@forge/core'
import { signal, computed } from '@forge/core'
import { InjectionToken } from '@forge/core'

export interface Todo {
  id: number
  text: string
  done: boolean
}

export const STORAGE_KEY = new InjectionToken<string>('STORAGE_KEY', {
  providedIn: 'root',
  factory: () => 'forge-todos',
})

@Injectable({ providedIn: 'root' })
export class TodoService {
  private storageKey = inject(STORAGE_KEY)

  readonly todos = signal<Todo[]>(this.#load())
  readonly remaining = computed(() => this.todos().filter(t => !t.done).length)

  add(text: string) {
    this.todos.update(list => [
      ...list,
      { id: Date.now(), text, done: false },
    ])
    this.#save()
  }

  toggle(id: number) {
    this.todos.update(list =>
      list.map(t => t.id === id ? { ...t, done: !t.done } : t)
    )
    this.#save()
  }

  #load(): Todo[] {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) ?? '[]')
    } catch {
      return []
    }
  }

  #save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.todos()))
  }
}
```

```forge
<!-- components/TodoList.forge -->
<script lang="ts">
import { inject } from '@forge/core'
import { signal } from '@forge/core'
import { TodoService } from '../services/todo.service'

const todos = inject(TodoService)
const newText = signal('')

function addTodo() {
  const text = newText().trim()
  if (text) {
    todos.add(text)
    newText.set('')
  }
}
</script>

<template>
  <div class="todo-list">
    <h2>Todos ({todos.remaining()} remaining)</h2>
    <input .value={newText()} @input={e => newText.set(e.target.value)} />
    <button @click={addTodo}>Add</button>
  </div>
</template>
```
