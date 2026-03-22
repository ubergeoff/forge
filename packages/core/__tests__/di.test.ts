// =============================================================================
// Forge DI System — Test Suite (Vitest)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Injectable,
  Inject,
  InjectionToken,
  Injector,
  inject,
  runInContext,
  bootstrapApp,
  resetRootInjector,
  getRootInjector,
  onDestroy,
  runDestroyCallbacks,
} from '../src/di.js';

// Reset root injector before each test for isolation
beforeEach(() => {
  resetRootInjector();
});

// ---------------------------------------------------------------------------
// InjectionToken
// ---------------------------------------------------------------------------

describe('InjectionToken', () => {
  it('creates a unique token with a description', () => {
    const TOKEN = new InjectionToken<string>('MY_TOKEN');
    expect(TOKEN.description).toBe('MY_TOKEN');
    expect(TOKEN.toString()).toBe('InjectionToken(MY_TOKEN)');
  });

  it('two tokens with same description are not equal', () => {
    const A = new InjectionToken<string>('TOKEN');
    const B = new InjectionToken<string>('TOKEN');
    expect(A).not.toBe(B);
  });

  it('resolves via factory when provided', () => {
    const TOKEN = new InjectionToken<number>('ANSWER', {
      providedIn: 'root',
      factory: () => 42,
    });
    const injector = bootstrapApp();
    const value = runInContext(injector, () => inject(TOKEN));
    expect(value).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// @Injectable decorator
// ---------------------------------------------------------------------------

describe('@Injectable', () => {
  it('registers a class as injectable', () => {
    @Injectable({ providedIn: 'root' })
    class MyService {}

    const injector = bootstrapApp();
    const instance = runInContext(injector, () => inject(MyService));
    expect(instance).toBeInstanceOf(MyService);
  });

  it('returns the same singleton instance on repeated gets', () => {
    @Injectable({ providedIn: 'root' })
    class SingletonService {}

    const injector = bootstrapApp();
    const a = runInContext(injector, () => inject(SingletonService));
    const b = runInContext(injector, () => inject(SingletonService));
    expect(a).toBe(b);
  });

  it('creates a fresh instance per child injector when providedIn: component', () => {
    @Injectable({ providedIn: 'component' })
    class ScopedService {}

    const root = bootstrapApp();
    const child1 = root.createChild();
    const child2 = root.createChild();

    const a = runInContext(child1, () => inject(ScopedService));
    const b = runInContext(child2, () => inject(ScopedService));
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// @Inject (deps declaration)
// ---------------------------------------------------------------------------

describe('@Inject', () => {
  it('injects constructor dependencies', () => {
    @Injectable({ providedIn: 'root' })
    class EngineService {
      name = 'V8';
    }

    @Injectable({ providedIn: 'root' })
    @Inject([EngineService])
    class CarService {
      constructor(public engine: EngineService) {}
    }

    const injector = bootstrapApp();
    const car = runInContext(injector, () => inject(CarService));
    expect(car.engine).toBeInstanceOf(EngineService);
    expect(car.engine.name).toBe('V8');
  });

  it('supports multi-level dependency chains', () => {
    @Injectable({ providedIn: 'root' })
    class A { value = 'A'; }

    @Injectable({ providedIn: 'root' })
    @Inject([A])
    class B { constructor(public a: A) {} }

    @Injectable({ providedIn: 'root' })
    @Inject([B])
    class C { constructor(public b: B) {} }

    const injector = bootstrapApp();
    const c = runInContext(injector, () => inject(C));
    expect(c.b.a.value).toBe('A');
  });
});

// ---------------------------------------------------------------------------
// Injector — explicit providers
// ---------------------------------------------------------------------------

describe('Injector — providers', () => {
  it('resolves a useValue provider', () => {
    const TOKEN = new InjectionToken<string>('BASE_URL');
    const injector = bootstrapApp([
      { provide: TOKEN, useValue: 'https://api.example.com' },
    ]);
    const val = runInContext(injector, () => inject(TOKEN));
    expect(val).toBe('https://api.example.com');
  });

  it('resolves a useFactory provider', () => {
    const TOKEN = new InjectionToken<number>('RANDOM');
    const injector = bootstrapApp([
      { provide: TOKEN, useFactory: () => 7 },
    ]);
    const val = runInContext(injector, () => inject(TOKEN));
    expect(val).toBe(7);
  });

  it('resolves a useFactory provider with deps', () => {
    const MULTIPLIER = new InjectionToken<number>('MULTIPLIER');
    const RESULT = new InjectionToken<number>('RESULT');

    const injector = bootstrapApp([
      { provide: MULTIPLIER, useValue: 5 },
      { provide: RESULT, useFactory: (m: number) => m * 2, deps: [MULTIPLIER] },
    ]);

    const val = runInContext(injector, () => inject(RESULT));
    expect(val).toBe(10);
  });

  it('resolves a useClass provider', () => {
    class Base { greet() { return 'base'; } }
    class Extended extends Base { greet() { return 'extended'; } }

    const injector = bootstrapApp([
      { provide: Base, useClass: Extended },
    ]);

    const instance = runInContext(injector, () => inject(Base));
    expect(instance.greet()).toBe('extended');
  });

  it('resolves a useExisting (alias) provider', () => {
    const TOKEN_A = new InjectionToken<string>('A');
    const TOKEN_B = new InjectionToken<string>('B');

    const injector = bootstrapApp([
      { provide: TOKEN_A, useValue: 'hello' },
      { provide: TOKEN_B, useExisting: TOKEN_A },
    ]);

    const a = runInContext(injector, () => inject(TOKEN_A));
    const b = runInContext(injector, () => inject(TOKEN_B));
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Injector — hierarchy
// ---------------------------------------------------------------------------

describe('Injector hierarchy', () => {
  it('child resolves tokens from parent', () => {
    const TOKEN = new InjectionToken<string>('TOKEN');
    const root = bootstrapApp([{ provide: TOKEN, useValue: 'from-root' }]);
    const child = root.createChild();

    const val = runInContext(child, () => inject(TOKEN));
    expect(val).toBe('from-root');
  });

  it('child provider shadows parent provider', () => {
    const TOKEN = new InjectionToken<string>('TOKEN');
    const root = bootstrapApp([{ provide: TOKEN, useValue: 'root' }]);
    const child = root.createChild([{ provide: TOKEN, useValue: 'child' }]);

    expect(runInContext(root, () => inject(TOKEN))).toBe('root');
    expect(runInContext(child, () => inject(TOKEN))).toBe('child');
  });

  it('sibling injectors are isolated', () => {
    @Injectable({ providedIn: 'component' })
    class ScopedService { id = Math.random(); }

    const root = bootstrapApp();
    const child1 = root.createChild();
    const child2 = root.createChild();

    const s1 = runInContext(child1, () => inject(ScopedService));
    const s2 = runInContext(child2, () => inject(ScopedService));
    expect(s1).not.toBe(s2);
  });
});

// ---------------------------------------------------------------------------
// inject() context guards
// ---------------------------------------------------------------------------

describe('inject() context guards', () => {
  it('throws when called outside injection context', () => {
    const TOKEN = new InjectionToken<string>('TOKEN');
    expect(() => inject(TOKEN)).toThrow('[Forge DI] inject() called outside');
  });

  it('returns null for optional missing token', () => {
    const TOKEN = new InjectionToken<string>('MISSING');
    const injector = bootstrapApp();
    const val = runInContext(injector, () => inject(TOKEN, { optional: true }));
    expect(val).toBeNull();
  });

  it('throws for non-optional missing token', () => {
    const TOKEN = new InjectionToken<string>('MISSING');
    const injector = bootstrapApp();
    expect(() =>
      runInContext(injector, () => inject(TOKEN))
    ).toThrow('[Forge DI] No provider found');
  });
});

// ---------------------------------------------------------------------------
// Circular dependency detection
// ---------------------------------------------------------------------------

describe('circular dependency detection', () => {
  it('throws a clear error on circular deps', () => {
    // We simulate a circular dep by manually building conflicting providers
    const TOKEN_A = new InjectionToken<unknown>('A');
    const TOKEN_B = new InjectionToken<unknown>('B');

    const injector = bootstrapApp([
      { provide: TOKEN_A, useFactory: (b: unknown) => b, deps: [TOKEN_B] },
      { provide: TOKEN_B, useFactory: (a: unknown) => a, deps: [TOKEN_A] },
    ]);

    expect(() =>
      runInContext(injector, () => inject(TOKEN_A))
    ).toThrow('Circular dependency');
  });
});

// ---------------------------------------------------------------------------
// Injector.destroy()
// ---------------------------------------------------------------------------

describe('Injector.destroy()', () => {
  it('calls onDestroy() on instances that implement it', () => {
    const spy = vi.fn();

    @Injectable({ providedIn: 'root' })
    class DestroyableService {
      onDestroy() { spy(); }
    }

    const injector = bootstrapApp();
    runInContext(injector, () => inject(DestroyableService));
    injector.destroy();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clears all instances after destroy', () => {
    @Injectable({ providedIn: 'root' })
    class MyService {}

    const injector = bootstrapApp();
    const before = runInContext(injector, () => inject(MyService));
    injector.destroy();

    // After destroy, should create a fresh instance
    const after = runInContext(injector, () => inject(MyService));
    expect(before).not.toBe(after);
  });
});

// ---------------------------------------------------------------------------
// onDestroy() hook
// ---------------------------------------------------------------------------

describe('onDestroy()', () => {
  it('registers and runs a cleanup callback', () => {
    const spy = vi.fn();

    @Injectable({ providedIn: 'root' })
    class CleanupService {
      constructor() {
        onDestroy(spy);
      }
    }

    const injector = bootstrapApp();
    runInContext(injector, () => inject(CleanupService));
    runDestroyCallbacks(injector);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('throws when called outside injection context', () => {
    expect(() => onDestroy(() => {})).toThrow(
      '[Forge DI] onDestroy() must be called within an injection context.'
    );
  });
});

// ---------------------------------------------------------------------------
// bootstrapApp() / resetRootInjector()
// ---------------------------------------------------------------------------

describe('bootstrapApp()', () => {
  it('sets up the root injector with providers', () => {
    const TOKEN = new InjectionToken<string>('TOKEN');
    bootstrapApp([{ provide: TOKEN, useValue: 'hello' }]);
    const val = runInContext(getRootInjector(), () => inject(TOKEN));
    expect(val).toBe('hello');
  });

  it('reset creates a fresh root injector', () => {
    @Injectable({ providedIn: 'root' })
    class AppService {}

    const injector1 = bootstrapApp();
    const a = runInContext(injector1, () => inject(AppService));

    resetRootInjector();

    const injector2 = bootstrapApp();
    const b = runInContext(injector2, () => inject(AppService));

    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Integration — DI + signals
// ---------------------------------------------------------------------------

describe('integration: DI + signals', () => {
  it('a service can expose signals and components can consume them', async () => {
    const { signal, computed, effect } = await import('../src/reactivity.js');

    @Injectable({ providedIn: 'root' })
    class CounterService {
      readonly #count = signal(0);
      readonly count = this.#count.asReadonly();

      increment() { this.#count.update(n => n + 1); }
    }

    const injector = bootstrapApp();

    const svc = runInContext(injector, () => inject(CounterService));
    const doubled = computed(() => svc.count() * 2);

    const log: number[] = [];
    const handle = effect(() => log.push(doubled()));

    svc.increment();
    svc.increment();

    expect(log).toEqual([0, 2, 4]);
    handle.destroy();
  });
});
