// =============================================================================
// Forge Runtime DOM Layer
// Direct DOM operations + reactive bindings that compiled templates call into.
// =============================================================================

import { effect } from './reactivity.js';
import type { EffectHandle } from './reactivity.js';
import { Injector } from './di.js';
import type { Provider } from './di.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentContext {
  injector: Injector;
  effects: EffectHandle[];
  children: ComponentContext[];
}

// Injected as a compile-time constant by Rolldown `define` in dev mode.
// `typeof` check is intentional — the variable may not be defined at runtime.
declare const __forge_dev: boolean | undefined;

/** Internal record of a mounted component instance, used by HMR swapping. */
interface HMRInstance {
  node: Node;
  ctx: ComponentContext;
  props: Record<string, () => unknown>;
  parentCtx: ComponentContext;
}

// ---------------------------------------------------------------------------
// 5.1 Element creation & patching
// ---------------------------------------------------------------------------

/**
 * Creates a DOM element with the given tag name.
 *
 * @example
 * const div = createElement('div');
 */
export function createElement(tag: string): Element {
  return document.createElement(tag);
}

/**
 * Sets a static attribute on an element.
 *
 * @example
 * setAttr(el, 'class', 'container');
 */
export function setAttr(el: Element, name: string, value: string): void {
  el.setAttribute(name, value);
}

/**
 * Sets a DOM property directly (e.g. value, checked, disabled).
 *
 * @example
 * setProp(input, 'value', 'hello');
 */
export function setProp(el: Element, name: string, value: unknown): void {
  (el as unknown as Record<string, unknown>)[name] = value;
}

/**
 * Attaches an event listener and returns an EffectHandle to remove it.
 *
 * @example
 * const handle = listen(btn, 'click', () => count.update(n => n + 1));
 * handle.destroy(); // removes listener
 */
export function listen(
  el: Element,
  event: string,
  handler: EventListener
): EffectHandle {
  el.addEventListener(event, handler);
  return {
    destroy() {
      el.removeEventListener(event, handler);
    },
  };
}

/**
 * Inserts a child node into a parent, optionally before an anchor node.
 *
 * @example
 * insert(container, textNode);
 * insert(list, item, anchor); // insert before anchor
 */
export function insert(parent: Node, child: Node, anchor?: Node | null): void {
  parent.insertBefore(child, anchor ?? null);
}

/**
 * Removes a node from the DOM.
 *
 * @example
 * remove(el);
 */
export function remove(node: Node): void {
  node.parentNode?.removeChild(node);
}

// ---------------------------------------------------------------------------
// 5.2 Reactive bindings
// ---------------------------------------------------------------------------

/**
 * Binds a getter to a Text node's content. The text updates surgically
 * whenever the getter's signal dependencies change.
 *
 * @example
 * const t = document.createTextNode('');
 * bindText(t, () => String(count()));
 */
export function bindText(node: Text, getter: () => string): EffectHandle {
  return effect(() => {
    node.nodeValue = getter();
  });
}

/**
 * Binds a getter to an element attribute. When the getter returns `null`,
 * the attribute is removed.
 *
 * @example
 * bindAttr(el, 'disabled', () => isDisabled() ? '' : null);
 */
export function bindAttr(
  el: Element,
  name: string,
  getter: () => string | null
): EffectHandle {
  return effect(() => {
    const value = getter();
    if (value === null) {
      el.removeAttribute(name);
    } else {
      el.setAttribute(name, value);
    }
  });
}

/**
 * Binds a getter to a DOM property. Updates the property directly whenever
 * the getter's signal dependencies change.
 *
 * @example
 * bindProp(input, 'value', () => name());
 */
export function bindProp(
  el: Element,
  name: string,
  getter: () => unknown
): EffectHandle {
  return effect(() => {
    (el as unknown as Record<string, unknown>)[name] = getter();
  });
}

/**
 * Binds a getter to element visibility. When the getter returns `false`,
 * `display: none` is applied; otherwise the inline style is cleared.
 *
 * @example
 * bindShow(el, () => isVisible());
 */
export function bindShow(el: Element, getter: () => boolean): EffectHandle {
  return effect(() => {
    (el as HTMLElement).style.display = getter() ? '' : 'none';
  });
}

/**
 * Binds a getter to a set of CSS classes. Each key in the record is a class
 * name; when the value is `true` the class is added, when `false` it is
 * removed. Classes not in the record are left untouched.
 *
 * @example
 * bindClass(el, () => ({ active: isActive(), disabled: isDisabled() }));
 */
export function bindClass(
  el: Element,
  getter: () => Record<string, boolean>
): EffectHandle {
  let prevClasses: Record<string, boolean> = {};

  return effect(() => {
    const next = getter();

    // Remove classes that were previously active but are no longer present or are now false.
    for (const name of Object.keys(prevClasses)) {
      if (prevClasses[name] === true && !next[name]) {
        el.classList.remove(name);
      }
    }

    // Add/remove based on current values.
    for (const [name, active] of Object.entries(next)) {
      if (active) {
        el.classList.add(name);
      } else {
        el.classList.remove(name);
      }
    }

    prevClasses = next;
  });
}

/**
 * Reactively renders a list of items before an anchor comment node.
 * Each item receives its own `ComponentContext` scoped under `parentCtx`
 * so that bindings created inside the item template are properly cleaned
 * up whenever the list re-renders.
 *
 * This is the runtime backing for the `@for` template directive.
 *
 * @example
 * // Generated by: <li @for={item of items()}>…</li>
 * const anchor = document.createComment('for');
 * insert(container, anchor);
 * ctx.effects.push(bindList(anchor, ctx, () => items(), (item, i, itemCtx) => {
 *   const li = createElement('li');
 *   const t = document.createTextNode('');
 *   itemCtx.effects.push(bindText(t, () => item.name));
 *   insert(li, t);
 *   return li;
 * }));
 */
export function bindList<T>(
  anchor: Comment,
  parentCtx: ComponentContext,
  getter: () => T[],
  itemFactory: (item: T, index: number, ctx: ComponentContext) => Node,
): EffectHandle {
  let activeItems: Array<{ node: Node; ctx: ComponentContext }> = [];

  return effect(() => {
    const list = getter();
    const parent = anchor.parentNode;
    if (!parent) return;

    // Tear down previous iteration: remove DOM nodes and destroy child contexts.
    for (const { node, ctx } of activeItems) {
      parent.removeChild(node);
      const idx = parentCtx.children.indexOf(ctx);
      if (idx >= 0) parentCtx.children.splice(idx, 1);
      destroyComponent(ctx);
    }
    activeItems = [];

    // Render each new item and insert it before the anchor.
    for (let i = 0; i < list.length; i++) {
      const itemCtx = createComponent(parentCtx.injector);
      parentCtx.children.push(itemCtx);
      const node = itemFactory(list[i]!, i, itemCtx);
      parent.insertBefore(node, anchor);
      activeItems.push({ node, ctx: itemCtx });
    }
  });
}

// ---------------------------------------------------------------------------
// 5.3 Component lifecycle
// ---------------------------------------------------------------------------

/**
 * Creates a ComponentContext scoped to a child injector derived from
 * `parentInjector`. The context owns all EffectHandles created during
 * the component's lifetime.
 *
 * @example
 * const ctx = createComponent(app, [{ provide: MY_TOKEN, useValue: 42 }]);
 */
export function createComponent(
  parentInjector: Injector,
  providers?: Provider[]
): ComponentContext {
  const injector = parentInjector.createChild(providers ?? []);
  return {
    injector,
    effects: [],
    children: [],
  };
}

/**
 * Tears down a ComponentContext: destroys all child contexts recursively,
 * then destroys all owned effects, then destroys the injector.
 *
 * @example
 * destroyComponent(ctx);
 */
export function destroyComponent(ctx: ComponentContext): void {
  // Recursively destroy children first.
  for (const child of ctx.children) {
    destroyComponent(child);
  }
  ctx.children.length = 0;

  // Destroy all owned effect handles.
  for (const handle of ctx.effects) {
    handle.destroy();
  }
  ctx.effects.length = 0;

  // Tear down the scoped injector.
  ctx.injector.destroy();
}

/**
 * Mounts a compiled component factory into a container element. The factory
 * receives the ComponentContext, builds the DOM subtree, and returns the
 * root node which is then appended to the container.
 *
 * @example
 * mountComponent(counterFactory, document.getElementById('app')!, ctx);
 */
export function mountComponent(
  factory: (ctx: ComponentContext, props?: Record<string, () => unknown>) => Node,
  container: Element,
  ctx: ComponentContext
): void {
  const node = factory(ctx);
  container.appendChild(node);
}

/**
 * Instantiates a child component inside a parent's template. Creates a child
 * ComponentContext scoped under the parent, registers it for lifecycle
 * tracking, invokes the factory with the given props, and returns the root
 * DOM node so the caller can insert it into the tree.
 *
 * Props are always passed as getter functions so both static and reactive
 * values share a uniform call-site API: `props['label']()`.
 *
 * @example
 * // In a compiled parent template:
 * const _e1 = mountChild(MyButton, ctx, { label: () => 'Click me' });
 * insert(_e0, _e1);
 */
export function mountChild(
  factory: (ctx: ComponentContext, props: Record<string, () => unknown>) => Node,
  parentCtx: ComponentContext,
  props: Record<string, () => unknown> = {},
): Node {
  const childCtx = createComponent(parentCtx.injector);
  parentCtx.children.push(childCtx);
  const node = factory(childCtx, props);

  // Register the instance for HMR swapping when the runtime is active.
  const hmrId = (factory as unknown as Record<string, unknown>)['__hmrId'] as string | undefined;
  if (hmrId) {
    const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null;
    const hmr = w?.['__forge_hmr'] as { instances?: Map<string, HMRInstance[]> } | undefined;
    if (hmr?.instances) {
      const list = hmr.instances.get(hmrId) ?? [];
      list.push({ node, ctx: childCtx, props, parentCtx });
      hmr.instances.set(hmrId, list);
    }
  }

  return node;
}

/**
 * Replaces all mounted instances of the component identified by `id` with
 * the output of `newFactory`. Called by the HMR client when a `.forge` chunk
 * is hot-updated. Not intended for use in application code.
 */
export function hmrAccept(
  id: string,
  newFactory: (ctx: ComponentContext, props: Record<string, () => unknown>) => Node,
): void {
  const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null;
  const hmr = w?.['__forge_hmr'] as { instances?: Map<string, HMRInstance[]> } | undefined;
  if (!hmr?.instances) return;

  const instances = hmr.instances.get(id) ?? [];
  for (const inst of instances) {
    const parent = inst.node.parentNode;
    if (!parent) continue; // component was unmounted — skip

    const nextSibling = inst.node.nextSibling;

    // Tear down old component subtree.
    destroyComponent(inst.ctx);
    parent.removeChild(inst.node);

    // Mount the new factory in its place.
    const newCtx = createComponent(inst.parentCtx.injector);
    const idx = inst.parentCtx.children.indexOf(inst.ctx);
    if (idx >= 0) inst.parentCtx.children[idx] = newCtx;

    const newNode = newFactory(newCtx, inst.props);
    parent.insertBefore(newNode, nextSibling);

    // Update the instance record for future HMR swaps.
    inst.node = newNode;
    inst.ctx = newCtx;
  }
}

// Wire up the HMR runtime on the global `window.__forge_hmr` object so that
// dynamically-imported component chunks can call `window.__forge_hmr.accept`.
// This block is compiled away in production builds (Rolldown replaces
// `__forge_dev` with `false` and tree-shakes the dead code).
if (typeof __forge_dev !== 'undefined' && __forge_dev && typeof window !== 'undefined') {
  const w = window as unknown as Record<string, unknown>;
  if (!w['__forge_hmr']) w['__forge_hmr'] = {};
  const hmr = w['__forge_hmr'] as Record<string, unknown>;
  if (!hmr['instances']) hmr['instances'] = new Map<string, HMRInstance[]>();
  hmr['accept'] = hmrAccept;
}
