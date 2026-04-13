// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RouterLink, RouterOutlet } from '../src/components.js';
import { Router, provideRouter, ROUTER } from '../src/router.js';
import { bootstrapApp, resetRootInjector } from '@vorra/core';
import { createComponent, destroyComponent } from '@vorra/core/dom';
import type { ComponentContext } from '@vorra/core';

function makeSetup() {
  const routes = [{ path: '/home' }, { path: '/about' }];
  const injector = bootstrapApp(provideRouter(routes));
  const router: Router = injector.get(ROUTER);
  const parentCtx = createComponent(injector);
  return { router, parentCtx, injector };
}

describe('RouterLink component factory', () => {
  let router: Router;
  let parentCtx: ComponentContext;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    resetRootInjector();
    ({ router, parentCtx } = makeSetup());
  });

  afterEach(() => {
    router?.destroy();
    destroyComponent(parentCtx);
    resetRootInjector();
  });

  it('returns an <a> element with the given href', () => {
    const a = RouterLink(parentCtx, { href: () => '/about' }) as HTMLAnchorElement;
    expect(a.tagName).toBe('A');
    expect(a.getAttribute('href')).toBe('/about');
  });

  it('sets textContent when label prop is provided', () => {
    const a = RouterLink(parentCtx, { href: () => '/about', label: () => 'About' }) as HTMLAnchorElement;
    expect(a.textContent).toBe('About');
  });

  it('sets class attribute when class prop is provided', () => {
    const a = RouterLink(parentCtx, { href: () => '/about', class: () => 'nav-link' }) as HTMLAnchorElement;
    expect(a.getAttribute('class')).toBe('nav-link');
  });

  it('defaults href to / when no href prop given', () => {
    const a = RouterLink(parentCtx, {}) as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('/');
  });

  it('navigates on click', () => {
    const spy = vi.spyOn(router, 'navigate');
    const a = RouterLink(parentCtx, { href: () => '/about' }) as HTMLAnchorElement;
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { button: 0, cancelable: true }));
    expect(spy).toHaveBeenCalledWith('/about', undefined);
    document.body.removeChild(a);
  });
});

describe('RouterOutlet component factory', () => {
  let router: Router;
  let parentCtx: ComponentContext;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    resetRootInjector();
    ({ router, parentCtx } = makeSetup());
  });

  afterEach(() => {
    router?.destroy();
    destroyComponent(parentCtx);
    resetRootInjector();
  });

  it('returns a div with data-forge-outlet attribute', () => {
    const outlet = RouterOutlet(parentCtx, {}) as HTMLElement;
    expect(outlet.tagName).toBe('DIV');
    expect(outlet.hasAttribute('data-forge-outlet')).toBe(true);
  });
});
