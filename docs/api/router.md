# @forge/router

Signal-driven client-side router for Forge applications. Built on the History API with reactive route state exposed as signals.

```bash
npm install @forge/router
```

## provideRouter()

Returns the providers array to pass to `bootstrapApp()`. This registers the `ROUTES` token and creates the `Router` singleton.

```ts
function provideRouter(routes: RouteConfig[]): Provider<unknown>[]
```

**Example:**
```ts
import { bootstrapApp } from '@forge/core'
import { provideRouter } from '@forge/router'

bootstrapApp([
  ...provideRouter([
    { path: '/', component: HomeComponent },
    { path: '/about', component: AboutComponent },
    { path: '**', component: NotFoundComponent },
  ]),
])
```

---

## Router

The singleton router service. Inject via `inject(ROUTER)`.

```ts
class Router {
  // Reactive signals (read-only)
  readonly currentRoute: ReadonlySignal<ResolvedRoute | null>
  readonly params: ComputedSignal<Record<string, string>>
  readonly query: ComputedSignal<Record<string, string>>

  navigate(url: string, extras?: NavigationExtras): void
  back(): void
  forward(): void
  destroy(): void
}
```

### currentRoute

The currently active resolved route. `null` when no route matched.

```ts
const route = router.currentRoute()
// → ResolvedRoute | null
```

### params

Named path parameters extracted from the active route's URL.

```ts
// For route path '/users/:id' and URL '/users/42':
router.params()  // → { id: '42' }
```

### query

Parsed query string parameters.

```ts
// For URL '/search?q=forge&page=2':
router.query()  // → { q: 'forge', page: '2' }
```

### navigate()

Navigate to a URL, optionally replacing the current history entry.

```ts
router.navigate('/users/42')
router.navigate('/login', { replaceUrl: true })
```

### back() / forward()

```ts
router.back()     // history.back()
router.forward()  // history.forward()
```

### destroy()

Remove the `popstate` listener. Call when the application is unmounted (primarily useful in tests).

---

## ROUTER token

```ts
import { ROUTER } from '@forge/router'
import { inject } from '@forge/core'

const router = inject(ROUTER)
```

---

## ROUTES token

```ts
import { ROUTES } from '@forge/router'
import { inject } from '@forge/core'

const routes = inject(ROUTES)  // → RouteConfig[]
```

---

## RouteConfig

Describes a single route entry.

```ts
interface RouteConfig {
  path: string                 // Path pattern (supports :param and **)
  component?: RouteComponent   // Component factory or lazy loader
  children?: RouteConfig[]     // Nested child routes
  redirectTo?: string          // Redirect to another path
  title?: string               // Sets document.title on match
  data?: Record<string, unknown>  // Arbitrary static route data
}
```

**Path pattern syntax:**

| Pattern | Matches |
|---------|---------|
| `/users` | Exact path `/users` |
| `/users/:id` | `/users/42`, `/users/alice` — `id` captured as param |
| `/a/:x/b/:y` | Multi-segment with multiple named params |
| `**` | Matches anything — use as catch-all |

---

## ResolvedRoute

The resolved route object available via `router.currentRoute()`.

```ts
interface ResolvedRoute {
  url: string                       // Full URL (pathname + query string)
  params: Record<string, string>    // Named path params: { id: '42' }
  query: Record<string, string>     // Query string: { q: 'forge' }
  config: RouteConfig               // The matched RouteConfig entry
}
```

---

## NavigationExtras

Options for `router.navigate()`.

```ts
interface NavigationExtras {
  replaceUrl?: boolean  // Replace current history entry instead of pushing
}
```

---

## lazy()

Wraps an async import as a lazy route component. The chunk is only loaded when the route is first activated.

```ts
function lazy(
  loader: () => Promise<{ default: ComponentFactory }>
): LazyComponentLoader
```

**Example:**
```ts
import { lazy } from '@forge/router'

const routes = [
  { path: '/dashboard', component: lazy(() => import('./pages/Dashboard.forge')) },
  { path: '/admin', component: lazy(() => import('./pages/Admin.forge')) },
]
```

---

## isLazyComponent()

Type guard that returns `true` for lazy loaders created by `lazy()`.

```ts
function isLazyComponent(c: RouteComponent): c is LazyComponentLoader
```

---

## Types

### ComponentFactory

A synchronous compiled component factory.

```ts
type ComponentFactory = (
  ctx: ComponentContext,
  props?: Record<string, () => unknown>
) => Node
```

### LazyComponentLoader

An async loader that returns a `ComponentFactory` as the default export.

```ts
interface LazyComponentLoader {
  (): Promise<{ default: ComponentFactory }>
  readonly __lazy: true
}
```

### RouteComponent

Either a synchronous factory or a lazy loader.

```ts
type RouteComponent = ComponentFactory | LazyComponentLoader
```
