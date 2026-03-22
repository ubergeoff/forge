// =============================================================================
// @forge/router — RouterOutlet
// Reactively mounts / unmounts the active route's component into a container.
// =============================================================================

import { effect } from '@forge/core';
import type { ComponentContext } from '@forge/core';
import {
  createElement,
  insert,
  remove,
  createComponent,
  destroyComponent,
} from '@forge/core/dom';
import type { Router } from './router.js';
import type { ComponentFactory, LazyComponentLoader } from './types.js';
import { isLazyComponent } from './types.js';

/**
 * Creates a `<div data-forge-outlet>` container element and reactively
 * mounts the current route's component inside it.  When the route changes
 * the previous component is torn down and the new one is mounted.
 *
 * Lazy-loaded components (created with `lazy()`) are resolved asynchronously;
 * stale loads are automatically cancelled when the route changes again before
 * the import resolves.
 *
 * The returned element should be inserted into the DOM by the caller.
 *
 * @example
 * const outlet = createRouterOutlet(router, ctx);
 * insert(appRoot, outlet);
 */
export function createRouterOutlet(
  router: Router,
  parentCtx: ComponentContext
): Element {
  const container = createElement('div');
  container.setAttribute('data-forge-outlet', '');

  let currentNode: Node | null = null;
  let currentCtx: ComponentContext | null = null;
  // Monotonically increasing — lets async mounts detect they are stale.
  let mountGeneration = 0;

  function destroyCurrent(): void {
    if (currentNode !== null) {
      remove(currentNode);
      currentNode = null;
    }
    if (currentCtx !== null) {
      const idx = parentCtx.children.indexOf(currentCtx);
      if (idx >= 0) parentCtx.children.splice(idx, 1);
      destroyComponent(currentCtx);
      currentCtx = null;
    }
  }

  async function mountRoute(
    component: ComponentFactory | LazyComponentLoader,
    generation: number
  ): Promise<void> {
    let factory: ComponentFactory;

    if (isLazyComponent(component)) {
      const mod = await component();
      // If the route changed while we were awaiting, discard this load.
      if (generation !== mountGeneration) return;
      factory = mod.default;
    } else {
      factory = component;
    }

    // Guard again — a synchronous factory path could also race if batching
    // ever becomes async in the future.
    if (generation !== mountGeneration) return;

    destroyCurrent();

    const childCtx = createComponent(parentCtx.injector);
    parentCtx.children.push(childCtx);
    const node = factory(childCtx);
    insert(container, node);
    currentNode = node;
    currentCtx = childCtx;
  }

  const handle = effect(() => {
    const route = router.currentRoute();
    mountGeneration++;
    const gen = mountGeneration;

    if (route === null || route.config.component === undefined) {
      destroyCurrent();
      return;
    }

    void mountRoute(route.config.component, gen);
  });

  parentCtx.effects.push(handle);

  return container;
}
