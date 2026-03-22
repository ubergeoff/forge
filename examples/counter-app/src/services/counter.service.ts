// =============================================================================
// CounterService — demonstrates @forge/core DI + signals
// =============================================================================

import { Injectable, onDestroy } from '@forge/core';
import { signal, computed, effect } from '@forge/core';

@Injectable({ providedIn: 'root' })
export class CounterService {
  readonly #count = signal(0);
  readonly #step = signal(1);

  /** Public readonly signals exposed to consumers */
  readonly count = this.#count.asReadonly();
  readonly step = this.#step.asReadonly();
  readonly doubled = computed(() => this.#count() * 2);
  readonly canDecrement = computed(() => this.#count() > 0);

  constructor() {
    // Demonstrate onDestroy cleanup
    const handle = effect(() => {
      console.log(`[CounterService] count=${this.#count()}, doubled=${this.doubled()}`);
    });
    onDestroy(() => {
      handle.destroy();
      console.log('[CounterService] destroyed — effect cleaned up');
    });
  }

  increment(): void {
    this.#count.update(n => n + this.#step());
  }

  decrement(): void {
    if (this.canDecrement()) {
      this.#count.update(n => n - this.#step());
    }
  }

  reset(): void {
    this.#count.set(0);
  }

  setStep(step: number): void {
    if (step < 1) throw new RangeError('Step must be >= 1');
    this.#step.set(step);
  }
}
