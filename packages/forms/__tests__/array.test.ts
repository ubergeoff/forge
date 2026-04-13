import { describe, it, expect } from 'vitest';
import { formArray } from '../src/array.js';
import { formControl } from '../src/control.js';
import { Validators } from '../src/validators.js';
import { effect } from '@forge/core';

describe('formArray — initial state', () => {
  it('initialises with provided controls', () => {
    const arr = formArray([formControl('a'), formControl('b')]);
    expect(arr.length()).toBe(2);
    expect(arr.value()).toEqual(['a', 'b']);
  });

  it('starts empty when no controls provided', () => {
    const arr = formArray<string>();
    expect(arr.length()).toBe(0);
    expect(arr.value()).toEqual([]);
  });

  it('is valid when all controls are valid', () => {
    const arr = formArray([formControl('hello'), formControl('world')]);
    expect(arr.valid()).toBe(true);
    expect(arr.status()).toBe('VALID');
  });

  it('is invalid when any control is invalid', () => {
    const arr = formArray([
      formControl('ok'),
      formControl('', [Validators.required]),
    ]);
    expect(arr.valid()).toBe(false);
    expect(arr.status()).toBe('INVALID');
  });
});

describe('formArray — at()', () => {
  it('returns the control at the given index', () => {
    const arr = formArray([formControl('x'), formControl('y')]);
    expect(arr.at(0).value()).toBe('x');
    expect(arr.at(1).value()).toBe('y');
  });

  it('throws for an out-of-bounds index', () => {
    const arr = formArray([formControl('x')]);
    expect(() => arr.at(5)).toThrow(RangeError);
  });
});

describe('formArray — push / insert / removeAt / clear', () => {
  it('push appends a control', () => {
    const arr = formArray([formControl('a')]);
    arr.push(formControl('b'));
    expect(arr.length()).toBe(2);
    expect(arr.value()).toEqual(['a', 'b']);
  });

  it('insert places a control at the given index', () => {
    const arr = formArray([formControl('a'), formControl('c')]);
    arr.insert(1, formControl('b'));
    expect(arr.value()).toEqual(['a', 'b', 'c']);
  });

  it('removeAt removes the control at the index', () => {
    const arr = formArray([formControl('a'), formControl('b'), formControl('c')]);
    arr.removeAt(1);
    expect(arr.value()).toEqual(['a', 'c']);
    expect(arr.length()).toBe(2);
  });

  it('clear removes all controls', () => {
    const arr = formArray([formControl('a'), formControl('b')]);
    arr.clear();
    expect(arr.length()).toBe(0);
    expect(arr.value()).toEqual([]);
  });
});

describe('formArray — reactivity', () => {
  it('value() updates when a child value changes', () => {
    const arr = formArray([formControl(0), formControl(0)]);
    const snapshots: number[][] = [];
    const handle = effect(() => { snapshots.push([...arr.value()]); });
    arr.at(0).setValue(1);
    arr.at(1).setValue(2);
    handle.destroy();
    expect(snapshots).toEqual([[0, 0], [1, 0], [1, 2]]);
  });

  it('length() updates when controls are added/removed', () => {
    const arr = formArray<string>();
    const lengths: number[] = [];
    const handle = effect(() => { lengths.push(arr.length()); });
    arr.push(formControl('x'));
    arr.push(formControl('y'));
    arr.removeAt(0);
    handle.destroy();
    expect(lengths).toEqual([0, 1, 2, 1]);
  });
});

describe('formArray — setValue / patchValue / reset', () => {
  it('setValue updates all controls', () => {
    const arr = formArray([formControl(''), formControl('')]);
    arr.setValue(['hello', 'world']);
    expect(arr.value()).toEqual(['hello', 'world']);
  });

  it('patchValue updates only matching indices', () => {
    const arr = formArray([formControl('a'), formControl('b'), formControl('c')]);
    arr.patchValue(['x', 'y']);
    expect(arr.value()).toEqual(['x', 'y', 'c']);
  });

  it('reset clears values and state', () => {
    const arr = formArray([formControl('old')]);
    arr.at(0).markAsTouched();
    arr.reset();
    expect(arr.at(0).touched()).toBe(false);
    expect(arr.at(0).value()).toBe('old'); // reset to initial
  });

  it('reset accepts new values', () => {
    const arr = formArray([formControl('a'), formControl('b')]);
    arr.reset(['x', 'y']);
    expect(arr.value()).toEqual(['x', 'y']);
  });
});

describe('formArray — touched / dirty', () => {
  it('touched is true when any control is touched', () => {
    const arr = formArray([formControl('a'), formControl('b')]);
    expect(arr.touched()).toBe(false);
    arr.at(0).markAsTouched();
    expect(arr.touched()).toBe(true);
  });

  it('markAsTouched propagates to all children', () => {
    const arr = formArray([formControl('a'), formControl('b')]);
    arr.markAsTouched();
    expect(arr.at(0).touched()).toBe(true);
    expect(arr.at(1).touched()).toBe(true);
  });

  it('dirty is true when any control is dirty', () => {
    const arr = formArray([formControl('a')]);
    arr.at(0).setValue('changed');
    expect(arr.dirty()).toBe(true);
  });
});

describe('formArray — disable / enable', () => {
  it('disables all controls', () => {
    const arr = formArray([formControl('a'), formControl('b')]);
    arr.disable();
    expect(arr.at(0).disabled()).toBe(true);
    expect(arr.at(1).disabled()).toBe(true);
    expect(arr.status()).toBe('DISABLED');
  });

  it('enables all controls', () => {
    const arr = formArray([formControl('a')]);
    arr.disable();
    arr.enable();
    expect(arr.at(0).enabled()).toBe(true);
    expect(arr.status()).toBe('VALID');
  });
});

describe('formArray — array-level validators', () => {
  it('reports array-level errors', () => {
    const minTwo = (v: unknown) => {
      const arr = v as unknown[];
      return arr.length < 2 ? { minItems: { required: 2, actual: arr.length } } : null;
    };
    const arr = formArray([formControl('only')], [minTwo]);
    expect(arr.errors()).toEqual({ minItems: { required: 2, actual: 1 } });
    expect(arr.valid()).toBe(false);
  });

  it('clears errors when condition is met', () => {
    const minTwo = (v: unknown) => {
      const a = v as unknown[];
      return a.length < 2 ? { minItems: true } : null;
    };
    const arr = formArray([formControl('a')], [minTwo]);
    expect(arr.errors()).not.toBeNull();
    arr.push(formControl('b'));
    expect(arr.errors()).toBeNull();
    expect(arr.valid()).toBe(true);
  });

  it('setValidators / clearValidators work on array', () => {
    const alwaysFail = () => ({ bad: true });
    const arr = formArray([formControl('x')], [alwaysFail]);
    expect(arr.errors()).toEqual({ bad: true });
    arr.clearValidators();
    expect(arr.errors()).toBeNull();
  });
});
