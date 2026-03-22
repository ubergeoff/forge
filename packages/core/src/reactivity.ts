// =============================================================================
// Forge Reactivity Core
// signal() / computed() / effect() / batch() / untrack()
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignalGetter<T> = () => T;
export type SignalSetter<T> = (value: T | ((prev: T) => T)) => void;
export type Signal<T> = [SignalGetter<T>, SignalSetter<T>];

export interface ReadonlySignal<T> {
  (): T;
  readonly __type: 'signal';
}

export interface WritableSignal<T> extends ReadonlySignal<T> {
  set(value: T): void;
  update(fn: (prev: T) => T): void;
  asReadonly(): ReadonlySignal<T>;
}

export interface ComputedSignal<T> extends ReadonlySignal<T> {
  readonly __type: 'signal';
}

export interface EffectHandle {
  /** Stops the effect from running again and releases all subscriptions. */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Internal tracking state
// ---------------------------------------------------------------------------

/**
 * The currently-executing reactive context (effect or computed).
 * When a signal is read, it registers itself as a dependency of this context.
 */
let activeContext: ReactiveContext | null = null;

/**
 * Batch depth counter. When > 0, signal writes are queued rather than
 * flushed immediately.
 */
let batchDepth = 0;

/** Queue of effects to re-run after the current batch completes. */
const pendingEffects = new Set<EffectNode>();

// ---------------------------------------------------------------------------
// Internal node types
// ---------------------------------------------------------------------------

interface ReactiveContext {
  /** Called when a dependency notifies this context of a change. */
  notify(): void;
  /** The set of signal nodes this context is currently subscribed to. */
  deps: Set<SignalNode<unknown>>;
}

interface SignalNode<T> {
  value: T;
  /** All reactive contexts currently subscribed to this signal. */
  subscribers: Set<ReactiveContext>;
  /** Equality check — defaults to Object.is */
  equals: (a: T, b: T) => boolean;
}

interface ComputedNode<T> extends ReactiveContext {
  dirty: boolean;
  value: T | undefined;
  deps: Set<SignalNode<unknown>>;
  compute: () => T;
  subscribers: Set<ReactiveContext>;
  equals: (a: T, b: T) => boolean;
}

interface EffectNode extends ReactiveContext {
  fn: () => void | (() => void);
  cleanup: (() => void) | void;
  deps: Set<SignalNode<unknown>>;
  scheduled: boolean;
  destroyed: boolean;
}

// ---------------------------------------------------------------------------
// Dependency tracking helpers
// ---------------------------------------------------------------------------

function trackDep<T>(node: SignalNode<T>): void {
  if (activeContext === null) return;
  node.subscribers.add(activeContext);
  activeContext.deps.add(node as SignalNode<unknown>);
}

function unsubscribeContext(ctx: ReactiveContext): void {
  for (const dep of ctx.deps) {
    dep.subscribers.delete(ctx);
  }
  ctx.deps.clear();
}

function notifySubscribers(node: SignalNode<unknown>): void {
  // Copy subscribers before iterating — a subscriber's notify() could
  // mutate the set (e.g. a computed re-subscribing).
  for (const sub of [...node.subscribers]) {
    sub.notify();
  }
}

// ---------------------------------------------------------------------------
// Batch / flush
// ---------------------------------------------------------------------------

/**
 * Groups multiple signal writes into a single flush, preventing intermediate
 * effect executions. Effects only run once after the outermost batch ends.
 *
 * @example
 * batch(() => {
 *   firstName.set('Jane');
 *   lastName.set('Doe');
 * });
 * // Effects depending on either signal run exactly once.
 */
export function batch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) flushEffects();
  }
}

function flushEffects(): void {
  // Drain the pending set. Effects may schedule new effects during flush,
  // so we loop until the set is empty.
  while (pendingEffects.size > 0) {
    const snapshot = [...pendingEffects];
    pendingEffects.clear();
    for (const node of snapshot) {
      if (!node.destroyed) runEffect(node);
    }
  }
}

function scheduleEffect(node: EffectNode): void {
  if (node.scheduled || node.destroyed) return;
  node.scheduled = true;
  pendingEffects.add(node);
  if (batchDepth === 0) flushEffects();
}

// ---------------------------------------------------------------------------
// signal()
// ---------------------------------------------------------------------------

/**
 * Creates a reactive signal — a piece of state that automatically notifies
 * any effects or computed values that read it when it changes.
 *
 * @example
 * const count = signal(0);
 * count();           // read → 0
 * count.set(1);      // write
 * count.update(n => n + 1);  // functional update
 */
export function signal<T>(
  initialValue: T,
  options?: { equals?: (a: T, b: T) => boolean }
): WritableSignal<T> {
  const node: SignalNode<T> = {
    value: initialValue,
    subscribers: new Set(),
    equals: options?.equals ?? Object.is,
  };

  function getter(): T {
    trackDep(node);
    return node.value;
  }

  function setter(value: T): void {
    if (node.equals(node.value, value)) return;
    node.value = value;
    notifySubscribers(node as SignalNode<unknown>);
  }

  const writableSignal = getter as WritableSignal<T>;

  Object.defineProperty(writableSignal, '__type', { value: 'signal' });

  writableSignal.set = setter;

  writableSignal.update = (fn: (prev: T) => T): void => {
    setter(fn(node.value));
  };

  writableSignal.asReadonly = (): ReadonlySignal<T> => {
    const ro = (() => {
      trackDep(node);
      return node.value;
    }) as ReadonlySignal<T>;
    Object.defineProperty(ro, '__type', { value: 'signal' });
    return ro;
  };

  return writableSignal;
}

// ---------------------------------------------------------------------------
// computed()
// ---------------------------------------------------------------------------

/**
 * Creates a lazily-evaluated derived value. Re-evaluates only when one of
 * its signal dependencies changes, and only when read.
 *
 * @example
 * const count = signal(2);
 * const doubled = computed(() => count() * 2);
 * doubled(); // → 4
 */
export function computed<T>(
  compute: () => T,
  options?: { equals?: (a: T, b: T) => boolean }
): ComputedSignal<T> {
  const node: ComputedNode<T> = {
    dirty: true,
    value: undefined,
    deps: new Set(),
    compute,
    subscribers: new Set(),
    equals: options?.equals ?? Object.is,
    notify() {
      if (!node.dirty) {
        node.dirty = true;
        // Propagate dirtiness to downstream subscribers without re-evaluating.
        notifySubscribers(node as unknown as SignalNode<unknown>);
      }
    },
  };

  function getter(): T {
    // Register this computed as a dependency of the outer context.
    if (activeContext !== null) {
      (node as unknown as SignalNode<unknown>).subscribers.add(activeContext);
      activeContext.deps.add(node as unknown as SignalNode<unknown>);
    }

    if (node.dirty) {
      // Unsubscribe from old deps before re-running.
      unsubscribeContext(node);

      const prevContext = activeContext;
      activeContext = node;
      try {
        const newValue = compute();
        if (node.value === undefined || !node.equals(node.value as T, newValue)) {
          node.value = newValue;
        }
      } finally {
        activeContext = prevContext;
        node.dirty = false;
      }
    }

    return node.value as T;
  }

  const computedSignal = getter as ComputedSignal<T>;
  Object.defineProperty(computedSignal, '__type', { value: 'signal' });
  return computedSignal;
}

// ---------------------------------------------------------------------------
// effect()
// ---------------------------------------------------------------------------

/**
 * Runs a side-effect function immediately and re-runs it whenever any signal
 * read inside it changes.
 *
 * The function may optionally return a cleanup function that runs before the
 * next execution or when the effect is destroyed.
 *
 * @returns An EffectHandle with a `destroy()` method to stop the effect.
 *
 * @example
 * const count = signal(0);
 * const handle = effect(() => {
 *   console.log('count is', count());
 *   return () => console.log('cleanup');
 * });
 * handle.destroy(); // stops the effect
 */
export function effect(fn: () => void | (() => void)): EffectHandle {
  const node: EffectNode = {
    fn,
    cleanup: undefined,
    deps: new Set(),
    scheduled: false,
    destroyed: false,
    notify() {
      scheduleEffect(node);
    },
  };

  // Run immediately (synchronously).
  runEffect(node);

  return {
    destroy() {
      if (node.destroyed) return;
      node.destroyed = true;
      if (typeof node.cleanup === 'function') node.cleanup();
      unsubscribeContext(node);
      pendingEffects.delete(node);
    },
  };
}

function runEffect(node: EffectNode): void {
  if (node.destroyed) return;

  // Run previous cleanup.
  if (typeof node.cleanup === 'function') {
    node.cleanup();
    node.cleanup = undefined;
  }

  // Unsubscribe from previous deps before re-tracking.
  unsubscribeContext(node);

  node.scheduled = false;

  const prevContext = activeContext;
  activeContext = node;
  try {
    node.cleanup = node.fn() as (() => void) | void;
  } finally {
    activeContext = prevContext;
  }
}

// ---------------------------------------------------------------------------
// untrack()
// ---------------------------------------------------------------------------

/**
 * Reads signals inside `fn` without registering them as dependencies of the
 * current reactive context. Useful for reading state in an effect without
 * creating subscriptions.
 *
 * @example
 * effect(() => {
 *   triggerSignal(); // subscribed
 *   const val = untrack(() => otherSignal()); // NOT subscribed
 * });
 */
export function untrack<T>(fn: () => T): T {
  const prevContext = activeContext;
  activeContext = null;
  try {
    return fn();
  } finally {
    activeContext = prevContext;
  }
}

// ---------------------------------------------------------------------------
// isSignal() type guard
// ---------------------------------------------------------------------------

export function isSignal(value: unknown): value is ReadonlySignal<unknown> {
  return typeof value === 'function' && (value as ReadonlySignal<unknown>).__type === 'signal';
}
