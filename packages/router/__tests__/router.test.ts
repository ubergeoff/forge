// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Router } from '../src/router.js';
import { provideRouter, ROUTER, ROUTES } from '../src/router.js';
import { bootstrapApp, resetRootInjector, inject, runInContext } from '@forge/core';
import type { RouteConfig } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRouter(routes: RouteConfig[]): Router {
  return new Router(routes);
}

// ---------------------------------------------------------------------------
// Router signal behaviour
// ---------------------------------------------------------------------------

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    // Reset browser location to / before each test
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    router.destroy();
    resetRootInjector();
  });

  it('resolves the initial URL on construction', () => {
    window.history.replaceState(null, '', '/home');
    router = makeRouter([{ path: '/home' }]);
    expect(router.currentRoute()).not.toBeNull();
    expect(router.currentRoute()?.config.path).toBe('/home');
  });

  it('sets currentRoute to null when nothing matches', () => {
    router = makeRouter([{ path: '/home' }]);
    router.navigate('/unknown');
    expect(router.currentRoute()).toBeNull();
  });

  it('navigate() updates currentRoute signal', () => {
    router = makeRouter([{ path: '/home' }]);
    router.navigate('/home');
    expect(router.currentRoute()).not.toBeNull();
    expect(router.currentRoute()?.config.path).toBe('/home');
  });

  it('params() reflects named route parameters', () => {
    router = makeRouter([{ path: '/users/:id' }]);
    router.navigate('/users/42');
    expect(router.params()).toEqual({ id: '42' });
  });

  it('params() resets when navigating to a route without params', () => {
    router = makeRouter([{ path: '/users/:id' }, { path: '/home' }]);
    router.navigate('/users/42');
    expect(router.params()).toEqual({ id: '42' });
    router.navigate('/home');
    expect(router.params()).toEqual({});
  });

  it('query() reflects the query string', () => {
    router = makeRouter([{ path: '/search' }]);
    router.navigate('/search?q=forge&page=2');
    expect(router.query()).toEqual({ q: 'forge', page: '2' });
  });

  it('query() is empty when there is no query string', () => {
    router = makeRouter([{ path: '/home' }]);
    router.navigate('/home');
    expect(router.query()).toEqual({});
  });

  it('pushes a new history entry by default', () => {
    router = makeRouter([{ path: '/a' }, { path: '/b' }]);
    router.navigate('/a');
    router.navigate('/b');
    expect(window.location.pathname).toBe('/b');
  });

  it('replaceUrl replaces the current history entry', () => {
    router = makeRouter([{ path: '/a' }, { path: '/b' }]);
    router.navigate('/a');
    router.navigate('/b', { replaceUrl: true });
    expect(window.location.pathname).toBe('/b');
  });

  it('follows redirectTo to the target route', () => {
    router = makeRouter([
      { path: '/old', redirectTo: '/new' },
      { path: '/new' },
    ]);
    router.navigate('/old');
    expect(router.currentRoute()?.config.path).toBe('/new');
    expect(window.location.pathname).toBe('/new');
  });

  it('sets document.title when the route has a title', () => {
    router = makeRouter([{ path: '/home', title: 'Home Page' }]);
    router.navigate('/home');
    expect(document.title).toBe('Home Page');
  });

  it('wildcard ** route matches any path', () => {
    router = makeRouter([{ path: '**' }]);
    router.navigate('/anything/goes/here');
    expect(router.currentRoute()).not.toBeNull();
  });

  it('signals update reactively when the route changes', () => {
    const values: Array<string | null> = [];
    router = makeRouter([{ path: '/a' }, { path: '/b' }]);

    // Manually collect currentRoute changes
    router.navigate('/a');
    values.push(router.currentRoute()?.config.path ?? null);
    router.navigate('/b');
    values.push(router.currentRoute()?.config.path ?? null);

    expect(values).toEqual(['/a', '/b']);
  });
});

// ---------------------------------------------------------------------------
// DI integration
// ---------------------------------------------------------------------------

describe('provideRouter', () => {
  beforeEach(() => resetRootInjector());
  afterEach(() => {
    try {
      const r = runInContext(bootstrapApp(), () => inject(ROUTER, { optional: true }));
      r?.destroy();
    } catch {
      // ignore
    }
    resetRootInjector();
  });

  it('registers ROUTES and ROUTER tokens', () => {
    const routes: RouteConfig[] = [{ path: '/home' }];
    const injector = bootstrapApp(provideRouter(routes));

    const resolvedRoutes = injector.get(ROUTES);
    expect(resolvedRoutes).toBe(routes);

    const r = injector.get(ROUTER);
    expect(r).toBeInstanceOf(Router);
    r.destroy();
  });
});
