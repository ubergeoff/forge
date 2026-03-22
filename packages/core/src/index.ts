// =============================================================================
// @forge/core — Public API
// =============================================================================

// Reactivity primitives
export {
  signal,
  computed,
  effect,
  batch,
  untrack,
  isSignal,
} from './reactivity.js';

export type {
  WritableSignal,
  ReadonlySignal,
  ComputedSignal,
  EffectHandle,
  Signal,
  SignalGetter,
  SignalSetter,
} from './reactivity.js';

// Dependency injection
export {
  Injectable,
  Inject,
  InjectionToken,
  Injector,
  inject,
  runInContext,
  bootstrapApp,
  resetRootInjector,
  getRootInjector,
  getActiveInjector,
  onDestroy,
  runDestroyCallbacks,
} from './di.js';

export type {
  Provider,
  ClassProvider,
  ValueProvider,
  FactoryProvider,
  ExistingProvider,
  Token,
  ProvidedIn,
  InjectableOptions,
} from './di.js';

// DOM runtime
export {
  createElement,
  setAttr,
  setProp,
  listen,
  insert,
  remove,
  bindText,
  bindAttr,
  bindProp,
  bindShow,
  bindClass,
  createComponent,
  destroyComponent,
  mountComponent,
  mountChild,
} from './dom.js';

export type { ComponentContext } from './dom.js';
