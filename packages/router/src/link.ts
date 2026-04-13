// =============================================================================
// @forge/router — createRouterLink
// Creates an <a> element that navigates via the Router instead of the browser.
// =============================================================================

import type { Router } from './router.js';
import type { NavigationExtras } from './types.js';

/**
 * Creates an `<a>` element whose `click` event is intercepted to perform
 * in-app navigation via `router.navigate()`.
 *
 * Standard browser behaviours (Ctrl+click, middle-click, etc.) are passed
 * through unchanged so the user can still open links in a new tab.
 *
 * @example
 * const link = createRouterLink(router, '/about');
 * link.textContent = 'About';
 * insert(nav, link);
 */
export function createRouterLink(
  router: Router,
  href: string,
  extras?: NavigationExtras
): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;

  a.addEventListener('click', (e: MouseEvent) => {
    // Let the browser handle modified clicks and non-primary buttons.
    if (
      e.button !== 0 ||
      e.ctrlKey ||
      e.metaKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    router.navigate(href, extras);
  });

  return a;
}
