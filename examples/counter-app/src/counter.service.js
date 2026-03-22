// =============================================================================
// CounterService — demonstrates @forge/core DI + signals
// =============================================================================
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable, onDestroy } from '@forge/core';
import { signal, computed, effect } from '@forge/core';
let CounterService = class CounterService {
    #count;
    #step;
    constructor() {
        this.#count = signal(0);
        this.#step = signal(1);
        /** Public readonly signals exposed to consumers */
        this.count = this.#count.asReadonly();
        this.step = this.#step.asReadonly();
        this.doubled = computed(() => this.#count() * 2);
        this.canDecrement = computed(() => this.#count() > 0);
        // Demonstrate onDestroy cleanup
        const handle = effect(() => {
            console.log(`[CounterService] count=${this.#count()}, doubled=${this.doubled()}`);
        });
        onDestroy(() => {
            handle.destroy();
            console.log('[CounterService] destroyed — effect cleaned up');
        });
    }
    increment() {
        this.#count.update(n => n + this.#step());
    }
    decrement() {
        if (this.canDecrement()) {
            this.#count.update(n => n - this.#step());
        }
    }
    reset() {
        this.#count.set(0);
    }
    setStep(step) {
        if (step < 1)
            throw new RangeError('Step must be >= 1');
        this.#step.set(step);
    }
};
CounterService = __decorate([
    Injectable({ providedIn: 'root' })
], CounterService);
export { CounterService };
//# sourceMappingURL=counter.service.js.map