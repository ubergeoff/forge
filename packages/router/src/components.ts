// =============================================================================
// @forge/router — RouterLink & RouterOutlet component factories
// Thin wrappers that conform to the (ctx, props) => Node factory contract so
// they can be used directly in .forge templates as child components.
// =============================================================================

import { inject, runInContext } from '@forge/core';
import type { ComponentContext } from '@forge/core';
import { ROUTER } from './router.js';
import { createRouterLink } from './link.js';
import { createRouterOutlet } from './outlet.js';

/**
 * Component factory for a router-aware anchor element.
 *
 * Props:
 *   - `href`  (required) — the path to navigate to
 *   - `label` (optional) — text content of the link
 *   - `class` (optional) — CSS class string
 *
 * @example
 * <RouterLink href="/about" label="About" class="nav-link" />
 */
export function RouterLink(
  ctx: ComponentContext,
  props: Record<string, () => unknown>,
): Node {
  return runInContext(ctx.injector, () => {
    const router = inject(ROUTER);
    const href  = (props['href']?.()  ?? '/') as string;
    const label = (props['label']?.() ?? '')  as string;
    const cls   = (props['class']?.() ?? '')  as string;

    const a = createRouterLink(router, href);
    if (label) a.textContent = label;
    if (cls)   a.setAttribute('class', cls);

    return a;
  });
}

/**
 * Component factory for a router outlet — reactively mounts the active route.
 *
 * @example
 * <RouterOutlet />
 */
export function RouterOutlet(
  ctx: ComponentContext,
  _props: Record<string, () => unknown>,
): Node {
  return runInContext(ctx.injector, () => {
    const router = inject(ROUTER);
    return createRouterOutlet(router, ctx);
  });
}
