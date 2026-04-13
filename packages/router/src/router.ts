// =============================================================================
// @forge/router — Router service
// Signal-driven client-side router backed by the History API.
// =============================================================================

import { signal, computed } from '@forge/core';
import { InjectionToken } from '@forge/core';
import type { ReadonlySignal, ComputedSignal, Provider } from '@forge/core';
import type {
  RouteConfig,
  ResolvedRoute,
  NavigationExtras,
} from './types.js';
import { matchRoute } from './route-matcher.js';

// ---------------------------------------------------------------------------
// DI tokens
// ---------------------------------------------------------------------------

/** Inject this token to receive the configured `RouteConfig[]` array. */
export const ROUTES = new InjectionToken<RouteConfig[]>('ROUTES');

/** Inject this token to receive the singleton `Router` instance. */
export const ROUTER = new InjectionToken<Router>('ROUTER');

// ---------------------------------------------------------------------------
// provideRouter() — registers everything needed for the router at bootstrap
// ---------------------------------------------------------------------------

/**
 * Returns the providers array to pass to `bootstrapApp()`.
 *
 * @example
 * bootstrapApp([
 *   ...provideRouter([
 *     { path: '/home', component: HomeComponent },
 *     { path: '**',   component: NotFoundComponent },
 *   ]),
 * ]);
 */
export function provideRouter(routes: RouteConfig[]): Provider<unknown>[] {
  return [
    { provide: ROUTES, useValue: routes },
    {
      provide: ROUTER,
      useFactory: (r: RouteConfig[]) => new Router(r),
      deps: [ROUTES],
    },
  ];
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Signal-driven router.  Reads/writes the browser History API and exposes
 * reactive route state via `currentRoute`, `params`, and `query` signals.
 *
 * Obtain an instance via `inject(ROUTER)` after calling `provideRouter()`.
 */
export class Router {
  // Internal writable signal — only the Router itself writes to it.
  private readonly _currentRoute = signal<ResolvedRoute | null>(null);
  private readonly _popstateHandler: () => void;

  /** The currently active resolved route, or `null` when nothing matched. */
  readonly currentRoute: ReadonlySignal<ResolvedRoute | null>;

  /** Named path params of the active route — e.g. `{ id: '42' }`. */
  readonly params: ComputedSignal<Record<string, string>>;

  /** Parsed query string of the active URL — e.g. `{ q: 'forge' }`. */
  readonly query: ComputedSignal<Record<string, string>>;

  constructor(private readonly routes: RouteConfig[]) {
    this.currentRoute = this._currentRoute.asReadonly();
    this.params = computed(() => this._currentRoute()?.params ?? {});
    this.query = computed(() => this._currentRoute()?.query ?? {});

    this._popstateHandler = () => {
      this._resolve(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', this._popstateHandler);

    // Resolve the URL that was active when the router was created.
    this._resolve(window.location.pathname + window.location.search);
  }

  /**
   * Navigates to `url`.  Pushes a new history entry by default; pass
   * `{ replaceUrl: true }` to replace the current entry instead.
   *
   * @example
   * router.navigate('/users/42');
   * router.navigate('/login', { replaceUrl: true });
   */
  navigate(url: string, extras?: NavigationExtras): void {
    if (extras?.replaceUrl === true) {
      window.history.replaceState(null, '', url);
    } else {
      window.history.pushState(null, '', url);
    }
    this._resolve(url);
  }

  /** Navigates one step back in the browser history. */
  back(): void {
    window.history.back();
  }

  /** Navigates one step forward in the browser history. */
  forward(): void {
    window.history.forward();
  }

  /**
   * Tears down the router — removes the `popstate` listener.
   * Call this when the application is unmounted (useful in tests).
   */
  destroy(): void {
    window.removeEventListener('popstate', this._popstateHandler);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private _resolve(url: string): void {
    const qIdx = url.indexOf('?');
    const pathname = qIdx >= 0 ? url.slice(0, qIdx) : url;
    const search = qIdx >= 0 ? url.slice(qIdx + 1) : '';

    const result = matchRoute(this.routes, pathname.length > 0 ? pathname : '/');

    if (result === null) {
      this._currentRoute.set(null);
      return;
    }

    // Follow redirect — use replaceState so the browser back-button skips it.
    if (result.config.redirectTo !== undefined) {
      this.navigate(result.config.redirectTo, { replaceUrl: true });
      return;
    }

    const query: Record<string, string> = {};
    new URLSearchParams(search).forEach((value, key) => {
      query[key] = value;
    });

    this._currentRoute.set({
      url,
      params: result.params,
      query,
      config: result.config,
    });

    if (result.config.title !== undefined) {
      document.title = result.config.title;
    }
  }
}
