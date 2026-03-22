// =============================================================================
// Forge DI System
// Injectable / InjectionToken / inject() / Injector / runInContext()
// =============================================================================

import type { WritableSignal, ReadonlySignal } from './reactivity';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Where a provider is instantiated in the injector tree. */
export type ProvidedIn = 'root' | 'component' | Injector;

export interface InjectableOptions {
  providedIn?: ProvidedIn;
}

/** Describes how to provide a value for a given token. */
export type Provider<T> =
  | ClassProvider<T>
  | ValueProvider<T>
  | FactoryProvider<T>
  | ExistingProvider<T>;

export interface ClassProvider<T> {
  provide: Token<T>;
  useClass: new (...args: unknown[]) => T;
  deps?: Token<unknown>[];
}

export interface ValueProvider<T> {
  provide: Token<T>;
  useValue: T;
}

export interface FactoryProvider<T> {
  provide: Token<T>;
  useFactory: (...args: unknown[]) => T;
  deps?: Token<unknown>[];
}

export interface ExistingProvider<T> {
  provide: Token<T>;
  useExisting: Token<T>;
}

/** Anything that can be used as a DI token. */
export type Token<T> =
  | (new (...args: unknown[]) => T)
  | InjectionToken<T>
  | AbstractToken<T>;

/** Marker interface for abstract class tokens. */
export interface AbstractToken<T> {
  readonly __tokenType: T;
}

// ---------------------------------------------------------------------------
// INJECTABLE_META — metadata store for @Injectable classes
// ---------------------------------------------------------------------------

const INJECTABLE_META = new WeakMap<
  new (...args: unknown[]) => unknown,
  { providedIn: ProvidedIn; deps: Token<unknown>[] }
>();

// ---------------------------------------------------------------------------
// @Injectable decorator
// ---------------------------------------------------------------------------

/**
 * Marks a class as injectable and configures where it is provided.
 *
 * @example
 * \@Injectable({ providedIn: 'root' })
 * class UserService {
 *   readonly users = signal<User[]>([]);
 * }
 */
export function Injectable(options: InjectableOptions = {}): ClassDecorator {
  return (target: unknown) => {
    const ctor = target as new (...args: unknown[]) => unknown;
    const existing = INJECTABLE_META.get(ctor);
    INJECTABLE_META.set(ctor, {
      providedIn: options.providedIn ?? 'root',
      deps: existing?.deps ?? [],
    });
  };
}

/**
 * Declares the constructor dependencies for a class, enabling DI without
 * TypeScript decorator metadata (emitDecoratorMetadata).
 *
 * @example
 * \@Injectable({ providedIn: 'root' })
 * \@Inject([HttpClient, AuthService])
 * class UserService {
 *   constructor(private http: HttpClient, private auth: AuthService) {}
 * }
 */
export function Inject(deps: Token<unknown>[]): ClassDecorator {
  return (target: unknown) => {
    const ctor = target as new (...args: unknown[]) => unknown;
    const existing = INJECTABLE_META.get(ctor);
    if (existing) {
      existing.deps = deps;
    } else {
      INJECTABLE_META.set(ctor, { providedIn: 'root', deps });
    }
  };
}

// ---------------------------------------------------------------------------
// InjectionToken
// ---------------------------------------------------------------------------

let tokenIdCounter = 0;

/**
 * A typed token used to inject values that aren't class instances — configs,
 * primitives, interfaces, or abstract types.
 *
 * @example
 * const API_URL = new InjectionToken<string>('API_URL', {
 *   providedIn: 'root',
 *   factory: () => 'https://api.example.com',
 * });
 *
 * // Later:
 * const url = inject(API_URL); // → 'https://api.example.com'
 */
export class InjectionToken<T> {
  readonly __tokenType!: T; // phantom type only — never assigned at runtime
  readonly id: number;
  readonly description: string;
  readonly options?: {
    providedIn?: ProvidedIn;
    factory?: () => T;
  };

  constructor(
    description: string,
    options?: { providedIn?: ProvidedIn; factory?: () => T }
  ) {
    this.id = ++tokenIdCounter;
    this.description = description;
    this.options = options;
  }

  toString(): string {
    return `InjectionToken(${this.description})`;
  }
}

// ---------------------------------------------------------------------------
// Injector
// ---------------------------------------------------------------------------

const NOT_FOUND = Symbol('NOT_FOUND');
const CIRCULAR = Symbol('CIRCULAR');

/**
 * A hierarchical container that resolves and caches provider instances.
 * Child injectors delegate to their parent when a token isn't found locally.
 */
export class Injector {
  private readonly instances = new Map<Token<unknown>, unknown>();
  private readonly resolving = new Set<Token<unknown>>();
  private readonly providers = new Map<Token<unknown>, Provider<unknown>>();

  constructor(
    providers: Provider<unknown>[] = [],
    private readonly parent: Injector | null = null
  ) {
    for (const p of providers) {
      this.providers.set(p.provide, p);
    }
  }

  /**
   * Resolves a token to its instance. Throws if the token cannot be resolved
   * and `optional` is false (the default).
   */
  get<T>(token: Token<T>, optional?: false): T;
  get<T>(token: Token<T>, optional: true): T | null;
  get<T>(token: Token<T>, optional = false): T | null {
    const result = this.resolve(token);
    if (result === NOT_FOUND) {
      if (optional) return null;
      throw new Error(
        `[Forge DI] No provider found for ${tokenName(token)}. ` +
        `Did you forget @Injectable() or to add it to your providers array?`
      );
    }
    return result as T;
  }

  private resolve<T>(token: Token<T>): T | typeof NOT_FOUND {
    // 1. Return cached instance
    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    // 2. Circular dependency guard
    if (this.resolving.has(token)) {
      throw new Error(
        `[Forge DI] Circular dependency detected while resolving ${tokenName(token)}.`
      );
    }

    // 3. Check local provider registry
    const provider = this.providers.get(token);
    if (provider) {
      this.resolving.add(token);
      try {
        const instance = this.instantiate(provider) as T;
        this.instances.set(token, instance);
        return instance;
      } finally {
        this.resolving.delete(token);
      }
    }

    // 4. Handle InjectionToken with a factory (self-providing tokens)
    if (token instanceof InjectionToken && token.options?.factory) {
      const instance = runInContext(this, token.options.factory) as T;
      this.instances.set(token, instance);
      return instance;
    }

    // 5. Handle @Injectable classes with providedIn: 'root' / this injector
    if (typeof token === 'function') {
      const meta = INJECTABLE_META.get(token as new (...args: unknown[]) => unknown);
      if (meta) {
        const targetInjector = this.resolveProvidedIn(meta.providedIn);
        if (targetInjector === this) {
          this.resolving.add(token);
          try {
            const instance = this.instantiateClass(
              token as new (...args: unknown[]) => T,
              meta.deps
            );
            this.instances.set(token, instance);
            return instance;
          } finally {
            this.resolving.delete(token);
          }
        } else if (targetInjector) {
          // Delegate to the appropriate injector in the tree
          return targetInjector.resolve(token);
        }
      }
    }

    // 6. Delegate to parent
    if (this.parent) {
      return this.parent.resolve(token);
    }

    return NOT_FOUND as typeof NOT_FOUND;
  }

  private instantiate<T>(provider: Provider<T>): T {
    if ('useValue' in provider) {
      return provider.useValue;
    }

    if ('useExisting' in provider) {
      return this.get(provider.useExisting);
    }

    if ('useFactory' in provider) {
      const deps = (provider.deps ?? []).map(dep => this.get(dep));
      return provider.useFactory(...deps) as T;
    }

    // useClass
    const deps = (provider.deps ?? []).map(dep => this.get(dep));
    return new provider.useClass(...deps) as T;
  }

  private instantiateClass<T>(
    ctor: new (...args: unknown[]) => T,
    deps: Token<unknown>[]
  ): T {
    const resolved = deps.map(dep => this.get(dep));
    return new ctor(...resolved);
  }

  private resolveProvidedIn(providedIn: ProvidedIn): Injector | null {
    if (providedIn === 'root') return getRootInjector();
    if (providedIn === 'component') return this;
    if (providedIn instanceof Injector) return providedIn;
    return null;
  }

  /**
   * Creates a child injector that inherits from this one.
   * Child providers shadow parent providers for the same token.
   */
  createChild(providers: Provider<unknown>[] = []): Injector {
    return new Injector(providers, this);
  }

  /**
   * Destroys this injector — calls onDestroy() on any instances that
   * implement it, then clears all cached instances.
   */
  destroy(): void {
    for (const instance of this.instances.values()) {
      if (
        instance !== null &&
        typeof instance === 'object' &&
        typeof (instance as { onDestroy?: () => void }).onDestroy === 'function'
      ) {
        (instance as { onDestroy: () => void }).onDestroy();
      }
    }
    this.instances.clear();
    this.providers.clear();
  }
}

// ---------------------------------------------------------------------------
// Root injector (app-level singleton)
// ---------------------------------------------------------------------------

let _rootInjector: Injector | null = null;

export function getRootInjector(): Injector {
  if (!_rootInjector) {
    _rootInjector = new Injector();
  }
  return _rootInjector;
}

/**
 * Bootstraps the application by creating the root injector with the given
 * providers. Should be called once at app startup.
 *
 * @example
 * bootstrapApp([
 *   { provide: API_URL, useValue: 'https://api.example.com' },
 * ]);
 */
export function bootstrapApp(providers: Provider<unknown>[] = []): Injector {
  _rootInjector = new Injector(providers);
  return _rootInjector;
}

/** Resets the root injector — primarily useful in tests. */
export function resetRootInjector(): void {
  _rootInjector?.destroy();
  _rootInjector = null;
}

// ---------------------------------------------------------------------------
// Injection context
// ---------------------------------------------------------------------------

/**
 * The active injector context for inject() calls.
 * Set during component/service instantiation.
 */
let activeInjector: Injector | null = null;

/**
 * Runs a function within a specific injector context, making inject() calls
 * inside resolve against that injector.
 */
export function runInContext<T>(injector: Injector, fn: () => T): T {
  const prev = activeInjector;
  activeInjector = injector;
  try {
    return fn();
  } finally {
    activeInjector = prev;
  }
}

/**
 * Returns the currently active injector, or null if called outside an
 * injection context.
 */
export function getActiveInjector(): Injector | null {
  return activeInjector;
}

// ---------------------------------------------------------------------------
// inject()
// ---------------------------------------------------------------------------

/**
 * Resolves a token from the current injection context.
 * Must be called during component or service construction.
 *
 * @example
 * \@Injectable({ providedIn: 'root' })
 * class DashboardComponent {
 *   private users = inject(UserService);
 *   private apiUrl = inject(API_URL);
 * }
 */
export function inject<T>(token: Token<T>, options?: { optional?: false }): T;
export function inject<T>(token: Token<T>, options: { optional: true }): T | null;
export function inject<T>(
  token: Token<T>,
  options: { optional?: boolean } = {}
): T | null {
  if (!activeInjector) {
    throw new Error(
      `[Forge DI] inject() called outside of an injection context. ` +
      `inject() can only be used during component or service construction.`
    );
  }
  return activeInjector.get(token, options.optional as true) as T | null;
}

// ---------------------------------------------------------------------------
// Helper: resolve token display name for error messages
// ---------------------------------------------------------------------------

function tokenName(token: Token<unknown>): string {
  if (token instanceof InjectionToken) return token.toString();
  if (typeof token === 'function') return token.name || '(anonymous class)';
  return String(token);
}

// ---------------------------------------------------------------------------
// onDestroy() — lifecycle hook helper for services
// ---------------------------------------------------------------------------

/**
 * Registers a cleanup callback to run when the injector that owns this
 * service instance is destroyed.
 *
 * Call this inside a service constructor (within an injection context).
 *
 * @example
 * \@Injectable({ providedIn: 'root' })
 * class WebSocketService {
 *   #ws: WebSocket;
 *   constructor() {
 *     this.#ws = new WebSocket('wss://...');
 *     onDestroy(() => this.#ws.close());
 *   }
 * }
 */
export function onDestroy(fn: () => void): void {
  if (!activeInjector) {
    throw new Error('[Forge DI] onDestroy() must be called within an injection context.');
  }
  // Attach the cleanup to a sentinel object in the injector under a unique token
  const token = new InjectionToken<DestroyRef>(`__destroyRef__`);
  // We piggyback on a shared DestroyRef list attached to the active injector
  getOrCreateDestroyRef(activeInjector).callbacks.push(fn);
}

// ---------------------------------------------------------------------------
// DestroyRef — internal lifecycle tracking
// ---------------------------------------------------------------------------

interface DestroyRef {
  callbacks: (() => void)[];
}

const destroyRefs = new WeakMap<Injector, DestroyRef>();

function getOrCreateDestroyRef(injector: Injector): DestroyRef {
  if (!destroyRefs.has(injector)) {
    destroyRefs.set(injector, { callbacks: [] });
  }
  return destroyRefs.get(injector)!;
}

/**
 * Runs all onDestroy callbacks registered against an injector.
 * Called automatically by Injector.destroy(), but also exported for
 * use in the component runtime.
 */
export function runDestroyCallbacks(injector: Injector): void {
  const ref = destroyRefs.get(injector);
  if (ref) {
    for (const cb of ref.callbacks) cb();
    ref.callbacks = [];
  }
}
