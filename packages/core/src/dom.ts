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
  return factory(childCtx, props);
}
