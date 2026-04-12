// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { createRouterLink } from '../src/link.js';
import type { Router } from '../src/router.js';

function makeRouter(): Router {
  return { navigate: vi.fn() } as unknown as Router;
}

describe('createRouterLink', () => {
  it('creates an <a> element with the given href', () => {
    const router = makeRouter();
    const a = createRouterLink(router, '/about');
    expect(a.tagName).toBe('A');
    expect(a.getAttribute('href')).toBe('/about');
  });

  it('calls router.navigate on primary click', () => {
    const router = makeRouter();
    const a = createRouterLink(router, '/about');
    document.body.appendChild(a);

    a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }));
    expect(router.navigate).toHaveBeenCalledWith('/about', undefined);

    document.body.removeChild(a);
  });

  it('passes NavigationExtras to router.navigate', () => {
    const router = makeRouter();
    const a = createRouterLink(router, '/home', { replaceUrl: true });
    document.body.appendChild(a);

    a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }));
    expect(router.navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });

    document.body.removeChild(a);
  });

  it('does not navigate on middle-click', () => {
    const router = makeRouter();
    const a = createRouterLink(router, '/about');
    document.body.appendChild(a);

    a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 1, cancelable: true }));
    expect(router.navigate).not.toHaveBeenCalled();

    document.body.removeChild(a);
  });

  it('does not navigate on ctrl+click', () => {
    const router = makeRouter();
    const a = createRouterLink(router, '/about');
    document.body.appendChild(a);

    a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, ctrlKey: true, cancelable: true }));
    expect(router.navigate).not.toHaveBeenCalled();

    document.body.removeChild(a);
  });

  it('does not navigate on meta+click', () => {
    const router = makeRouter();
    const a = createRouterLink(router, '/about');
    document.body.appendChild(a);

    a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, metaKey: true, cancelable: true }));
    expect(router.navigate).not.toHaveBeenCalled();

    document.body.removeChild(a);
  });

  it('does not navigate on shift+click', () => {
    const router = makeRouter();
    const a = createRouterLink(router, '/about');
    document.body.appendChild(a);

    a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, shiftKey: true, cancelable: true }));
    expect(router.navigate).not.toHaveBeenCalled();

    document.body.removeChild(a);
  });

  it('does not navigate on alt+click', () => {
    const router = makeRouter();
    const a = createRouterLink(router, '/about');
    document.body.appendChild(a);

    a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, altKey: true, cancelable: true }));
    expect(router.navigate).not.toHaveBeenCalled();

    document.body.removeChild(a);
  });
});
