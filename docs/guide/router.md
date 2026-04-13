# Router

`@forge/router` is a signal-driven client-side router backed by the History API. Route state is exposed as reactive signals, so your components automatically respond to navigation.

## Installation

```bash
npm install @forge/router
```

## Setup

### 1. Define your routes

```ts
// src/routes.ts
import { lazy } from '@forge/router'
import HomeComponent from './pages/Home.forge'
import AboutComponent from './pages/About.forge'

export const routes = [
  { path: '/', component: HomeComponent, title: 'Home' },
  { path: '/about', component: AboutComponent, title: 'About' },

  // Named params
  { path: '/users/:id', component: lazy(() => import('./pages/UserDetail.forge')) },

  // Redirect
  { path: '/home', redirectTo: '/' },

  // Wildcard (404)
  { path: '**', component: lazy(() => import('./pages/NotFound.forge')) },
]
```

### 2. Bootstrap with provideRouter

```ts
// src/main.ts
import { bootstrapApp } from '@forge/core'
import { provideRouter } from '@forge/router'
import { createComponent, mountComponent } from '@forge/core/dom'
import App from './App.forge'
import { routes } from './routes'

const injector = bootstrapApp([
  ...provideRouter(routes),
])

const ctx = createComponent(injector)
mountComponent(App, document.getElementById('app')!, ctx)
```

### 3. Add a RouterOutlet to your App component

```forge
<!-- src/App.forge -->
<script lang="ts">
import { inject } from '@forge/core'
import { ROUTER } from '@forge/router'
// RouterOutlet is used as a child component reference
import RouterOutlet from '@forge/router/outlet'
</script>

<template>
  <div>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
    <main>
      <RouterOutlet />
    </main>
  </div>
</template>
```

## RouteConfig

Each route is described by a `RouteConfig` object:

```ts
interface RouteConfig {
  path: string              // Path pattern — supports :param and **
  component?: RouteComponent  // Component factory or lazy loader
  children?: RouteConfig[]  // Nested child routes
  redirectTo?: string       // Redirect target path
  title?: string            // Sets document.title on match
  data?: Record<string, unknown>  // Arbitrary static route data
}
```

### Path patterns

| Pattern | Matches |
|---------|---------|
| `/users` | Exactly `/users` |
| `/users/:id` | `/users/42`, `/users/alice` — `id` captured as param |
| `/users/:id/posts/:postId` | Multi-param patterns |
| `**` | Anything — use as catch-all at the end |

## Injecting the Router

Inject the `ROUTER` token to navigate programmatically and read route state:

```forge
<script lang="ts">
import { inject } from '@forge/core'
import { ROUTER } from '@forge/router'

const router = inject(ROUTER)

// Reactive signals
router.currentRoute()  // → ResolvedRoute | null
router.params()        // → { id: '42' } for path '/users/:id'
router.query()         // → { q: 'forge' } for '?q=forge'

function goToUser(id: number) {
  router.navigate(`/users/${id}`)
}

function goBack() {
  router.back()
}
</script>
```

## Navigation

### router.navigate()

```ts
// Push a new history entry
router.navigate('/users/42')

// Replace the current entry (no back button)
router.navigate('/login', { replaceUrl: true })
```

### router.back() / router.forward()

```ts
router.back()     // equivalent to window.history.back()
router.forward()  // equivalent to window.history.forward()
```

## RouterLink

Use `RouterLink` for declarative navigation. It renders an `<a>` tag and handles clicks with `history.pushState` (no full page reload):

```forge
<script lang="ts">
import RouterLink from '@forge/router/link'
</script>

<template>
  <nav>
    <RouterLink to="/">Home</RouterLink>
    <RouterLink to="/about">About</RouterLink>
    <RouterLink :to={`/users/${userId()}`}>Profile</RouterLink>
  </nav>
</template>
```

## Lazy Loading

Use `lazy()` to code-split routes. The chunk is only fetched when the route is first activated:

```ts
import { lazy } from '@forge/router'

const routes = [
  { path: '/', component: HomeComponent },
  {
    path: '/dashboard',
    component: lazy(() => import('./pages/Dashboard.forge')),
  },
  {
    path: '/admin',
    component: lazy(() => import('./pages/Admin.forge')),
  },
]
```

The `lazy()` helper marks the loader function with a `__lazy: true` symbol so `RouterOutlet` knows to await the import before mounting the component.

## Reading Route State

The `Router` exposes reactive signals you can read in any component:

```forge
<script lang="ts">
import { inject, computed } from '@forge/core'
import { ROUTER } from '@forge/router'

const router = inject(ROUTER)

// The current route config and matched params
const route = router.currentRoute
const userId = computed(() => router.params().id)
const searchQuery = computed(() => router.query().q ?? '')
</script>

<template>
  <div>
    <h1>User {userId()}</h1>
    <p :show={!!searchQuery()}>Searching for: {searchQuery()}</p>
  </div>
</template>
```

## Nested / Child Routes

Define `children` on a route to nest components. The parent component must include a `RouterOutlet` to render the active child:

```ts
const routes = [
  {
    path: '/settings',
    component: SettingsLayout,
    children: [
      { path: '', redirectTo: 'profile' },
      { path: 'profile', component: ProfileSettings },
      { path: 'security', component: SecuritySettings },
    ],
  },
]
```

## Route Data

Attach arbitrary static data to routes using the `data` field. Access it via `router.currentRoute()?.config.data`:

```ts
const routes = [
  {
    path: '/admin',
    component: AdminComponent,
    data: { roles: ['admin', 'superuser'] },
  },
]
```

```ts
const requiredRoles = computed(() => {
  return router.currentRoute()?.config.data?.['roles'] as string[] ?? []
})
```

## Programmatic Guard Pattern

Forge's router does not have built-in guards, but you can implement them with effects:

```ts
import { effect } from '@forge/core'
import { inject } from '@forge/core'
import { ROUTER } from '@forge/router'
import { AuthService } from './auth.service'

const router = inject(ROUTER)
const auth = inject(AuthService)

effect(() => {
  const route = router.currentRoute()
  const roles = route?.config.data?.['roles'] as string[] | undefined

  if (roles && !roles.some(r => auth.hasRole(r))) {
    router.navigate('/unauthorized', { replaceUrl: true })
  }
})
```

## ResolvedRoute Shape

```ts
interface ResolvedRoute {
  url: string                      // Full URL (pathname + query string)
  params: Record<string, string>   // Named path params: { id: '42' }
  query: Record<string, string>    // Parsed query string: { q: 'forge' }
  config: RouteConfig              // The matched route config entry
}
```
