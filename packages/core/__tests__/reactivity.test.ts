// =============================================================================
// Forge Reactivity Core — Test Suite (Vitest)
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import {
  signal,
  computed,
  effect,
  batch,
  untrack,
  isSignal,
} from '../src/reactivity.js';

// ---------------------------------------------------------------------------
// signal()
// ---------------------------------------------------------------------------

describe('signal()', () => {
  it('returns the initial value', () => {
    const count = signal(0);
    expect(count()).toBe(0);
  });

  it('updates via .set()', () => {
    const count = signal(0);
    count.set(5);
    expect(count()).toBe(5);
  });

  it('updates via .update()', () => {
    const count = signal(3);
    count.update(n => n * 2);
    expect(count()).toBe(6);
  });

  it('does not notify if value is identical (Object.is)', () => {
    const count = signal(1);
    const spy = vi.fn();
    effect(() => { count(); spy(); });
    spy.mockClear();

    count.set(1); // same value
    expect(spy).not.toHaveBeenCalled();
  });

  it('supports custom equality', () => {
    const arr = signal([1, 2, 3], { equals: (a, b) => a.length === b.length });
    const spy = vi.fn();
    effect(() => { arr(); spy(); });
    spy.mockClear();

    arr.set([4, 5, 6]); // same length → no notification
    expect(spy).not.toHaveBeenCalled();

    arr.set([1, 2]); // different length → notification
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('asReadonly() prevents external writes', () => {
    const count = signal(0);
    const ro = count.asReadonly();
    expect(ro()).toBe(0);
    expect((ro as any).set).toBeUndefined();
    expect((ro as any).update).toBeUndefined();
  });

  it('asReadonly() reflects updates from the writable signal', () => {
    const count = signal(0);
    const ro = count.asReadonly();
    count.set(99);
    expect(ro()).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// computed()
// ---------------------------------------------------------------------------

describe('computed()', () => {
  it('derives a value from signals', () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a() + b());
    expect(sum()).toBe(5);
  });

  it('updates when a dependency changes', () => {
    const a = signal(1);
    const doubled = computed(() => a() * 2);
    expect(doubled()).toBe(2);
    a.set(5);
    expect(doubled()).toBe(10);
  });

  it('is lazy — does not compute until read', () => {
    const a = signal(1);
    const spy = vi.fn(() => a() * 2);
    const doubled = computed(spy);
    expect(spy).not.toHaveBeenCalled();
    doubled();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('caches — does not recompute if deps unchanged', () => {
    const a = signal(1);
    const spy = vi.fn(() => a() * 2);
    const doubled = computed(spy);

    doubled();
    doubled();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('recomputes after a dependency changes', () => {
    const a = signal(1);
    const spy = vi.fn(() => a() * 2);
    const doubled = computed(spy);

    doubled();
    a.set(2);
    doubled();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('supports chained computed values', () => {
    const a = signal(2);
    const b = computed(() => a() * 2);  // 4
    const c = computed(() => b() + 1);  // 5
    expect(c()).toBe(5);
    a.set(3);
    expect(c()).toBe(7);
  });

  it('drops subscriptions to signals no longer accessed', () => {
    const toggle = signal(true);
    const a = signal('a');
    const b = signal('b');
    const spy = vi.fn();

    const result = computed(() => {
      spy();
      return toggle() ? a() : b();
    });

    result(); // reads toggle + a
    spy.mockClear();

    toggle.set(false);
    result(); // now reads toggle + b, unsubscribes from a
    spy.mockClear();

    a.set('a2'); // should NOT trigger recompute
    result();
    expect(spy).not.toHaveBeenCalled();

    b.set('b2'); // SHOULD trigger recompute
    result();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// effect()
// ---------------------------------------------------------------------------

describe('effect()', () => {
  it('runs immediately on creation', () => {
    const spy = vi.fn();
    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('re-runs when a dependency changes', () => {
    const count = signal(0);
    const spy = vi.fn();
    effect(() => { count(); spy(); });
    expect(spy).toHaveBeenCalledTimes(1);

    count.set(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not re-run after destroy()', () => {
    const count = signal(0);
    const spy = vi.fn();
    const handle = effect(() => { count(); spy(); });
    spy.mockClear();

    handle.destroy();
    count.set(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it('calls cleanup before re-running', () => {
    const count = signal(0);
    const log: string[] = [];

    effect(() => {
      count();
      log.push('run');
      return () => log.push('cleanup');
    });

    expect(log).toEqual(['run']);
    count.set(1);
    expect(log).toEqual(['run', 'cleanup', 'run']);
  });

  it('calls cleanup on destroy()', () => {
    const log: string[] = [];
    const handle = effect(() => {
      return () => log.push('cleanup');
    });

    handle.destroy();
    expect(log).toEqual(['cleanup']);
  });

  it('does not double-cleanup after destroy()', () => {
    const log: string[] = [];
    const handle = effect(() => () => log.push('cleanup'));
    handle.destroy();
    handle.destroy(); // second call is a no-op
    expect(log).toEqual(['cleanup']);
  });

  it('dynamically tracks dependencies', () => {
    const toggle = signal(true);
    const a = signal('a');
    const b = signal('b');
    const spy = vi.fn();

    effect(() => {
      spy(toggle() ? a() : b());
    });

    spy.mockClear();
    b.set('b2'); // b not yet tracked — should NOT trigger
    expect(spy).not.toHaveBeenCalled();

    toggle.set(false); // now b is tracked
    spy.mockClear();

    b.set('b3'); // now it SHOULD trigger
    expect(spy).toHaveBeenCalledTimes(1);

    a.set('a2'); // a no longer tracked — should NOT trigger
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// batch()
// ---------------------------------------------------------------------------

describe('batch()', () => {
  it('defers effects until the batch completes', () => {
    const a = signal(0);
    const b = signal(0);
    const spy = vi.fn();

    effect(() => { a(); b(); spy(); });
    spy.mockClear();

    batch(() => {
      a.set(1);
      b.set(2);
    });

    // Effect should have run exactly once, not once per signal write
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('supports nested batches', () => {
    const a = signal(0);
    const spy = vi.fn();

    effect(() => { a(); spy(); });
    spy.mockClear();

    batch(() => {
      batch(() => {
        a.set(1);
        a.set(2);
      });
      a.set(3);
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(a()).toBe(3);
  });

  it('flushes effects synchronously after the batch', () => {
    const a = signal(0);
    const log: number[] = [];

    effect(() => log.push(a()));
    log.length = 0;

    batch(() => { a.set(10); });

    // After batch, the effect has already flushed
    expect(log).toEqual([10]);
  });
});

// ---------------------------------------------------------------------------
// untrack()
// ---------------------------------------------------------------------------

describe('untrack()', () => {
  it('reads a signal without creating a subscription', () => {
    const trigger = signal(0);
    const other = signal(100);
    const spy = vi.fn();

    effect(() => {
      trigger(); // subscribed
      const val = untrack(() => other()); // NOT subscribed
      spy(val);
    });

    spy.mockClear();

    other.set(200); // should NOT re-run the effect
    expect(spy).not.toHaveBeenCalled();

    trigger.set(1); // SHOULD re-run, reads latest `other` value
    expect(spy).toHaveBeenCalledWith(200);
  });

  it('returns the value from the function', () => {
    const a = signal(42);
    const result = untrack(() => a());
    expect(result).toBe(42);
  });

  it('restores the active context after running', () => {
    const a = signal(0);
    const b = signal(0);
    const spy = vi.fn();

    effect(() => {
      untrack(() => {}); // should not disturb tracking
      a(); // still tracked
      spy();
    });

    spy.mockClear();
    a.set(1);
    expect(spy).toHaveBeenCalledTimes(1);

    b.set(1); // b was never tracked
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// isSignal()
// ---------------------------------------------------------------------------

describe('isSignal()', () => {
  it('returns true for a writable signal', () => {
    expect(isSignal(signal(0))).toBe(true);
  });

  it('returns true for a readonly signal', () => {
    expect(isSignal(signal(0).asReadonly())).toBe(true);
  });

  it('returns true for a computed signal', () => {
    expect(isSignal(computed(() => 1))).toBe(true);
  });

  it('returns false for plain functions', () => {
    expect(isSignal(() => 1)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isSignal(42)).toBe(false);
    expect(isSignal('hello')).toBe(false);
    expect(isSignal(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------

describe('integration', () => {
  it('signal → computed → effect pipeline', () => {
    const firstName = signal('John');
    const lastName = signal('Doe');
    const fullName = computed(() => `${firstName()} ${lastName()}`);
    const log: string[] = [];

    effect(() => log.push(fullName()));

    expect(log).toEqual(['John Doe']);

    firstName.set('Jane');
    expect(log).toEqual(['John Doe', 'Jane Doe']);

    batch(() => {
      firstName.set('Bob');
      lastName.set('Smith');
    });
    expect(log).toEqual(['John Doe', 'Jane Doe', 'Bob Smith']);
  });

  it('effect cleanup prevents stale subscription after destroy', () => {
    const a = signal(0);
    const calls: number[] = [];
    const handle = effect(() => calls.push(a()));

    a.set(1);
    handle.destroy();
    a.set(2);
    a.set(3);

    expect(calls).toEqual([0, 1]); // stopped after destroy
  });
});
