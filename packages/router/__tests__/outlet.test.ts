// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRouterOutlet } from '../src/outlet.js';
import { Router, provideRouter } from '../src/router.js';
import { bootstrapApp, resetRootInjector } from '@vorra/core';
import { createComponent, destroyComponent } from '@vorra/core/dom';
import type { ComponentContext } from '@vorra/core';
import type { RouteConfig } from '../src/types.js';

function makeSetup(routes: RouteConfig[]) {
  const router = new Router(routes);
  const injector = bootstrapApp(provideRouter(routes));
  const parentCtx = createComponent(injector);
  return { router, parentCtx, injector };
}

describe('createRouterOutlet', () => {
  let router: Router;
  let parentCtx: ComponentContext;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    resetRootInjector();
  });

  afterEach(() => {
    router?.destroy();
    if (parentCtx) destroyComponent(parentCtx);
    resetRootInjector();
  });

  it('returns a div with data-vorra-outlet attribute', () => {
    ({ router, parentCtx } = makeSetup([{ path: '/home' }]));
    const outlet = createRouterOutlet(router, parentCtx);
    expect(outlet.tagName).toBe('DIV');
    expect(outlet.hasAttribute('data-vorra-outlet')).toBe(true);
  });

  it('mounts a component when a matching route is active', async () => {
    const factory = vi.fn((ctx: ComponentContext) => {
      const el = document.createElement('span');
      el.textContent = 'hello';
      return el;
    });

    ({ router, parentCtx } = makeSetup([{ path: '/home', component: factory }]));
    const outlet = createRouterOutlet(router, parentCtx);
    document.body.appendChild(outlet);

    router.navigate('/home');
    // effect runs synchronously in happy-dom
    await Promise.resolve();

    expect(factory).toHaveBeenCalled();
    expect(outlet.querySelector('span')).not.toBeNull();

    document.body.removeChild(outlet);
  });

  it('unmounts the component when route becomes null', async () => {
    const factory = vi.fn((ctx: ComponentContext) => {
      const el = document.createElement('span');
      return el;
    });

    ({ router, parentCtx } = makeSetup([{ path: '/home', component: factory }]));
    const outlet = createRouterOutlet(router, parentCtx);
    document.body.appendChild(outlet);

    router.navigate('/home');
    await Promise.resolve();
    expect(outlet.querySelector('span')).not.toBeNull();

    router.navigate('/unknown');
    await Promise.resolve();
    expect(outlet.querySelector('span')).toBeNull();

    document.body.removeChild(outlet);
  });

  it('swaps component when route changes', async () => {
    const factoryA = vi.fn((ctx: ComponentContext) => {
      const el = document.createElement('div');
      el.id = 'a';
      return el;
    });
    const factoryB = vi.fn((ctx: ComponentContext) => {
      const el = document.createElement('div');
      el.id = 'b';
      return el;
    });

    ({ router, parentCtx } = makeSetup([
      { path: '/a', component: factoryA },
      { path: '/b', component: factoryB },
    ]));
    const outlet = createRouterOutlet(router, parentCtx);
    document.body.appendChild(outlet);

    router.navigate('/a');
    await Promise.resolve();
    expect(outlet.querySelector('#a')).not.toBeNull();

    router.navigate('/b');
    await Promise.resolve();
    expect(outlet.querySelector('#a')).toBeNull();
    expect(outlet.querySelector('#b')).not.toBeNull();

    document.body.removeChild(outlet);
  });

  it('does not mount when route has no component', async () => {
    ({ router, parentCtx } = makeSetup([{ path: '/home' }]));
    const outlet = createRouterOutlet(router, parentCtx);
    document.body.appendChild(outlet);

    router.navigate('/home');
    await Promise.resolve();

    expect(outlet.children.length).toBe(0);
    document.body.removeChild(outlet);
  });
});
