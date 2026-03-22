// =============================================================================
// Forge DI System — Test Suite (Vitest)
// =============================================================================
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injectable, Inject, InjectionToken, inject, runInContext, bootstrapApp, resetRootInjector, getRootInjector, onDestroy, runDestroyCallbacks, } from '../src/di.js';
// Reset root injector before each test for isolation
beforeEach(() => {
    resetRootInjector();
});
// ---------------------------------------------------------------------------
// InjectionToken
// ---------------------------------------------------------------------------
describe('InjectionToken', () => {
    it('creates a unique token with a description', () => {
        const TOKEN = new InjectionToken('MY_TOKEN');
        expect(TOKEN.description).toBe('MY_TOKEN');
        expect(TOKEN.toString()).toBe('InjectionToken(MY_TOKEN)');
    });
    it('two tokens with same description are not equal', () => {
        const A = new InjectionToken('TOKEN');
        const B = new InjectionToken('TOKEN');
        expect(A).not.toBe(B);
    });
    it('resolves via factory when provided', () => {
        const TOKEN = new InjectionToken('ANSWER', {
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
        let MyService = class MyService {
        };
        MyService = __decorate([
            Injectable({ providedIn: 'root' })
        ], MyService);
        const injector = bootstrapApp();
        const instance = runInContext(injector, () => inject(MyService));
        expect(instance).toBeInstanceOf(MyService);
    });
    it('returns the same singleton instance on repeated gets', () => {
        let SingletonService = class SingletonService {
        };
        SingletonService = __decorate([
            Injectable({ providedIn: 'root' })
        ], SingletonService);
        const injector = bootstrapApp();
        const a = runInContext(injector, () => inject(SingletonService));
        const b = runInContext(injector, () => inject(SingletonService));
        expect(a).toBe(b);
    });
    it('creates a fresh instance per child injector when providedIn: component', () => {
        let ScopedService = class ScopedService {
        };
        ScopedService = __decorate([
            Injectable({ providedIn: 'component' })
        ], ScopedService);
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
        let EngineService = class EngineService {
            constructor() {
                this.name = 'V8';
            }
        };
        EngineService = __decorate([
            Injectable({ providedIn: 'root' })
        ], EngineService);
        let CarService = class CarService {
            constructor(engine) {
                this.engine = engine;
            }
        };
        CarService = __decorate([
            Injectable({ providedIn: 'root' }),
            Inject([EngineService])
        ], CarService);
        const injector = bootstrapApp();
        const car = runInContext(injector, () => inject(CarService));
        expect(car.engine).toBeInstanceOf(EngineService);
        expect(car.engine.name).toBe('V8');
    });
    it('supports multi-level dependency chains', () => {
        let A = class A {
            constructor() {
                this.value = 'A';
            }
        };
        A = __decorate([
            Injectable({ providedIn: 'root' })
        ], A);
        let B = class B {
            constructor(a) {
                this.a = a;
            }
        };
        B = __decorate([
            Injectable({ providedIn: 'root' }),
            Inject([A])
        ], B);
        let C = class C {
            constructor(b) {
                this.b = b;
            }
        };
        C = __decorate([
            Injectable({ providedIn: 'root' }),
            Inject([B])
        ], C);
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
        const TOKEN = new InjectionToken('BASE_URL');
        const injector = bootstrapApp([
            { provide: TOKEN, useValue: 'https://api.example.com' },
        ]);
        const val = runInContext(injector, () => inject(TOKEN));
        expect(val).toBe('https://api.example.com');
    });
    it('resolves a useFactory provider', () => {
        const TOKEN = new InjectionToken('RANDOM');
        const injector = bootstrapApp([
            { provide: TOKEN, useFactory: () => 7 },
        ]);
        const val = runInContext(injector, () => inject(TOKEN));
        expect(val).toBe(7);
    });
    it('resolves a useFactory provider with deps', () => {
        const MULTIPLIER = new InjectionToken('MULTIPLIER');
        const RESULT = new InjectionToken('RESULT');
        const injector = bootstrapApp([
            { provide: MULTIPLIER, useValue: 5 },
            { provide: RESULT, useFactory: (m) => m * 2, deps: [MULTIPLIER] },
        ]);
        const val = runInContext(injector, () => inject(RESULT));
        expect(val).toBe(10);
    });
    it('resolves a useClass provider', () => {
        class Base {
            greet() { return 'base'; }
        }
        class Extended extends Base {
            greet() { return 'extended'; }
        }
        const injector = bootstrapApp([
            { provide: Base, useClass: Extended },
        ]);
        const instance = runInContext(injector, () => inject(Base));
        expect(instance.greet()).toBe('extended');
    });
    it('resolves a useExisting (alias) provider', () => {
        const TOKEN_A = new InjectionToken('A');
        const TOKEN_B = new InjectionToken('B');
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
        const TOKEN = new InjectionToken('TOKEN');
        const root = bootstrapApp([{ provide: TOKEN, useValue: 'from-root' }]);
        const child = root.createChild();
        const val = runInContext(child, () => inject(TOKEN));
        expect(val).toBe('from-root');
    });
    it('child provider shadows parent provider', () => {
        const TOKEN = new InjectionToken('TOKEN');
        const root = bootstrapApp([{ provide: TOKEN, useValue: 'root' }]);
        const child = root.createChild([{ provide: TOKEN, useValue: 'child' }]);
        expect(runInContext(root, () => inject(TOKEN))).toBe('root');
        expect(runInContext(child, () => inject(TOKEN))).toBe('child');
    });
    it('sibling injectors are isolated', () => {
        let ScopedService = class ScopedService {
            constructor() {
                this.id = Math.random();
            }
        };
        ScopedService = __decorate([
            Injectable({ providedIn: 'component' })
        ], ScopedService);
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
        const TOKEN = new InjectionToken('TOKEN');
        expect(() => inject(TOKEN)).toThrow('[Forge DI] inject() called outside');
    });
    it('returns null for optional missing token', () => {
        const TOKEN = new InjectionToken('MISSING');
        const injector = bootstrapApp();
        const val = runInContext(injector, () => inject(TOKEN, { optional: true }));
        expect(val).toBeNull();
    });
    it('throws for non-optional missing token', () => {
        const TOKEN = new InjectionToken('MISSING');
        const injector = bootstrapApp();
        expect(() => runInContext(injector, () => inject(TOKEN))).toThrow('[Forge DI] No provider found');
    });
});
// ---------------------------------------------------------------------------
// Circular dependency detection
// ---------------------------------------------------------------------------
describe('circular dependency detection', () => {
    it('throws a clear error on circular deps', () => {
        // We simulate a circular dep by manually building conflicting providers
        const TOKEN_A = new InjectionToken('A');
        const TOKEN_B = new InjectionToken('B');
        const injector = bootstrapApp([
            { provide: TOKEN_A, useFactory: (b) => b, deps: [TOKEN_B] },
            { provide: TOKEN_B, useFactory: (a) => a, deps: [TOKEN_A] },
        ]);
        expect(() => runInContext(injector, () => inject(TOKEN_A))).toThrow('Circular dependency');
    });
});
// ---------------------------------------------------------------------------
// Injector.destroy()
// ---------------------------------------------------------------------------
describe('Injector.destroy()', () => {
    it('calls onDestroy() on instances that implement it', () => {
        const spy = vi.fn();
        let DestroyableService = class DestroyableService {
            onDestroy() { spy(); }
        };
        DestroyableService = __decorate([
            Injectable({ providedIn: 'root' })
        ], DestroyableService);
        const injector = bootstrapApp();
        runInContext(injector, () => inject(DestroyableService));
        injector.destroy();
        expect(spy).toHaveBeenCalledTimes(1);
    });
    it('clears all instances after destroy', () => {
        let MyService = class MyService {
        };
        MyService = __decorate([
            Injectable({ providedIn: 'root' })
        ], MyService);
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
        let CleanupService = class CleanupService {
            constructor() {
                onDestroy(spy);
            }
        };
        CleanupService = __decorate([
            Injectable({ providedIn: 'root' })
        ], CleanupService);
        const injector = bootstrapApp();
        runInContext(injector, () => inject(CleanupService));
        runDestroyCallbacks(injector);
        expect(spy).toHaveBeenCalledTimes(1);
    });
    it('throws when called outside injection context', () => {
        expect(() => onDestroy(() => { })).toThrow('[Forge DI] onDestroy() must be called within an injection context.');
    });
});
// ---------------------------------------------------------------------------
// bootstrapApp() / resetRootInjector()
// ---------------------------------------------------------------------------
describe('bootstrapApp()', () => {
    it('sets up the root injector with providers', () => {
        const TOKEN = new InjectionToken('TOKEN');
        bootstrapApp([{ provide: TOKEN, useValue: 'hello' }]);
        const val = runInContext(getRootInjector(), () => inject(TOKEN));
        expect(val).toBe('hello');
    });
    it('reset creates a fresh root injector', () => {
        let AppService = class AppService {
        };
        AppService = __decorate([
            Injectable({ providedIn: 'root' })
        ], AppService);
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
        let CounterService = class CounterService {
            constructor() {
                this.#count = signal(0);
                this.count = this.#count.asReadonly();
            }
            #count;
            increment() { this.#count.update(n => n + 1); }
        };
        CounterService = __decorate([
            Injectable({ providedIn: 'root' })
        ], CounterService);
        const injector = bootstrapApp();
        const svc = runInContext(injector, () => inject(CounterService));
        const doubled = computed(() => svc.count() * 2);
        const log = [];
        const handle = effect(() => log.push(doubled()));
        svc.increment();
        svc.increment();
        expect(log).toEqual([0, 2, 4]);
        handle.destroy();
    });
});
//# sourceMappingURL=di.test.js.map