// =============================================================================
// @vorra/router — RouterOutlet
// Reactively mounts / unmounts the active route's component into a container.
// =============================================================================

import { effect } from '@vorra/core';
import type { ComponentContext } from '@vorra/core';
import {
  createElement,
  insert,
  remove,
  createComponent,
  destroyComponent,
} from '@vorra/core/dom';
import type { Router } from './router.js';
import type { ComponentFactory, LazyComponentLoader } from './types.js';
import { isLazyComponent } from './types.js';

/**
 * Creates a `<div data-vorra-outlet>` container element and reactively
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
  container.setAttribute('data-vorra-outlet', '');

  // Shared object reference so that hmrAccept's in-place updates to .node/.ctx
  // are immediately visible when destroyCurrent reads from currentInst.
  interface MountedInstance {
    node: Node;
    ctx: ComponentContext;
    props: Record<string, () => unknown>;
    parentCtx: ComponentContext;
  }
  let currentInst: MountedInstance | null = null;
  let currentHmrId: string | undefined;

  // Monotonically increasing — lets async mounts detect they are stale.
  let mountGeneration = 0;

  function destroyCurrent(): void {
    if (currentInst !== null) {
      // Deregister from the HMR registry before tearing down the DOM so that a
      // concurrent hot-swap cannot fire on an instance we are about to destroy.
      if (currentHmrId !== undefined && typeof window !== 'undefined') {
        const w = window as unknown as Record<string, unknown>;
        const hmr = w['__vorra_hmr'] as { instances?: Map<string, MountedInstance[]> } | undefined;
        const list = hmr?.instances?.get(currentHmrId);
        if (list) {
          const i = list.indexOf(currentInst);
          if (i >= 0) list.splice(i, 1);
        }
        currentHmrId = undefined;
      }

      remove(currentInst.node);
      const idx = parentCtx.children.indexOf(currentInst.ctx);
      if (idx >= 0) parentCtx.children.splice(idx, 1);
      destroyComponent(currentInst.ctx);
      currentInst = null;
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

    const inst: MountedInstance = { node, ctx: childCtx, props: {}, parentCtx };
    currentInst = inst;

    // Register the page component for HMR hot-swapping. hmrAccept updates
    // inst.node and inst.ctx in-place, so currentInst always reflects the
    // latest mounted node/context after a hot swap.
    const hmrId = (factory as unknown as Record<string, unknown>)['__hmrId'] as string | undefined;
    if (hmrId !== undefined && typeof window !== 'undefined') {
      const w = window as unknown as Record<string, unknown>;
      const hmr = w['__vorra_hmr'] as { instances?: Map<string, MountedInstance[]> } | undefined;
      if (hmr?.instances) {
        const list = hmr.instances.get(hmrId) ?? [];
        list.push(inst);
        hmr.instances.set(hmrId, list);
        currentHmrId = hmrId;
      }
    }
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
