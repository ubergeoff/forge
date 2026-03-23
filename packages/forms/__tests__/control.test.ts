import { describe, it, expect, vi } from 'vitest';
import { formControl } from '../src/control.js';
import { Validators } from '../src/validators.js';
import { effect } from '@forge/core';

describe('formControl — initial state', () => {
  it('returns the initial value', () => {
    const ctrl = formControl('hello');
    expect(ctrl.value()).toBe('hello');
  });

  it('is valid with no validators', () => {
    const ctrl = formControl('');
    expect(ctrl.valid()).toBe(true);
    expect(ctrl.invalid()).toBe(false);
    expect(ctrl.errors()).toBeNull();
    expect(ctrl.status()).toBe('VALID');
  });

  it('is invalid when validators fail on initial value', () => {
    const ctrl = formControl('', [Validators.required]);
    expect(ctrl.valid()).toBe(false);
    expect(ctrl.invalid()).toBe(true);
    expect(ctrl.errors()).toEqual({ required: true });
    expect(ctrl.status()).toBe('INVALID');
  });

  it('starts untouched and pristine', () => {
    const ctrl = formControl('');
    expect(ctrl.touched()).toBe(false);
    expect(ctrl.untouched()).toBe(true);
    expect(ctrl.dirty()).toBe(false);
    expect(ctrl.pristine()).toBe(true);
  });

  it('is enabled by default', () => {
    const ctrl = formControl('');
    expect(ctrl.disabled()).toBe(false);
    expect(ctrl.enabled()).toBe(true);
  });
});

describe('formControl — setValue', () => {
  it('updates the value', () => {
    const ctrl = formControl('');
    ctrl.setValue('world');
    expect(ctrl.value()).toBe('world');
  });

  it('marks the control dirty', () => {
    const ctrl = formControl('');
    ctrl.setValue('x');
    expect(ctrl.dirty()).toBe(true);
    expect(ctrl.pristine()).toBe(false);
  });

  it('re-runs validators after setValue', () => {
    const ctrl = formControl('', [Validators.required]);
    expect(ctrl.valid()).toBe(false);
    ctrl.setValue('Alice');
    expect(ctrl.valid()).toBe(true);
    expect(ctrl.errors()).toBeNull();
  });

  it('value is reactive — effects re-run on change', () => {
    const ctrl = formControl(0);
    const seen: number[] = [];
    const handle = effect(() => { seen.push(ctrl.value()); });
    ctrl.setValue(1);
    ctrl.setValue(2);
    handle.destroy();
    expect(seen).toEqual([0, 1, 2]);
  });
});

describe('formControl — patchValue', () => {
  it('is an alias for setValue on a leaf control', () => {
    const ctrl = formControl('');
    ctrl.patchValue('patched');
    expect(ctrl.value()).toBe('patched');
    expect(ctrl.dirty()).toBe(true);
  });
});

describe('formControl — reset', () => {
  it('resets to initial value', () => {
    const ctrl = formControl('initial');
    ctrl.setValue('changed');
    ctrl.markAsTouched();
    ctrl.reset();
    expect(ctrl.value()).toBe('initial');
    expect(ctrl.touched()).toBe(false);
    expect(ctrl.dirty()).toBe(false);
    expect(ctrl.pristine()).toBe(true);
  });

  it('resets to a provided value', () => {
    const ctrl = formControl('initial');
    ctrl.reset('override');
    expect(ctrl.value()).toBe('override');
  });
});

describe('formControl — touch / dirty', () => {
  it('markAsTouched / markAsUntouched toggle touched', () => {
    const ctrl = formControl('');
    ctrl.markAsTouched();
    expect(ctrl.touched()).toBe(true);
    ctrl.markAsUntouched();
    expect(ctrl.touched()).toBe(false);
  });

  it('markAsDirty / markAsPristine toggle dirty', () => {
    const ctrl = formControl('');
    ctrl.markAsDirty();
    expect(ctrl.dirty()).toBe(true);
    ctrl.markAsPristine();
    expect(ctrl.dirty()).toBe(false);
  });
});

describe('formControl — disable / enable', () => {
  it('status becomes DISABLED when disabled', () => {
    const ctrl = formControl('', [Validators.required]);
    ctrl.disable();
    expect(ctrl.disabled()).toBe(true);
    expect(ctrl.enabled()).toBe(false);
    expect(ctrl.status()).toBe('DISABLED');
    // Errors are suppressed while disabled
    expect(ctrl.errors()).toBeNull();
  });

  it('restores status when re-enabled', () => {
    const ctrl = formControl('', [Validators.required]);
    ctrl.disable();
    ctrl.enable();
    expect(ctrl.disabled()).toBe(false);
    expect(ctrl.status()).toBe('INVALID');
  });
});

describe('formControl — validators', () => {
  it('setValidators replaces all validators', () => {
    const ctrl = formControl('', [Validators.required]);
    expect(ctrl.valid()).toBe(false);
    ctrl.setValidators([]);
    expect(ctrl.valid()).toBe(true);
  });

  it('addValidators appends without removing existing', () => {
    const ctrl = formControl('', [Validators.required]);
    ctrl.addValidators([Validators.minLength(10)]);
    ctrl.setValue('hello');
    // required passes, minLength fails
    expect(ctrl.errors()).toHaveProperty('minLength');
  });

  it('clearValidators removes all validators', () => {
    const ctrl = formControl('', [Validators.required]);
    ctrl.clearValidators();
    expect(ctrl.valid()).toBe(true);
  });
});

describe('formControl — async validators', () => {
  it('status is PENDING while async validation is in-flight', async () => {
    let resolve!: (v: null) => void;
    const asyncValidator = () => new Promise<null>(r => { resolve = r; });
    const ctrl = formControl('', [], [asyncValidator]);
    // Initially pending (async started on construction)
    expect(ctrl.status()).toBe('PENDING');
    resolve(null);
    await Promise.resolve();
    await Promise.resolve(); // extra tick for .then()
    expect(ctrl.status()).toBe('VALID');
  });

  it('surfaces async validation errors', async () => {
    const asyncValidator = async () => ({ serverError: 'taken' });
    const ctrl = formControl('alice', [], [asyncValidator]);
    await new Promise(r => setTimeout(r, 0));
    expect(ctrl.errors()).toEqual({ serverError: 'taken' });
    expect(ctrl.status()).toBe('INVALID');
  });

  it('re-runs async validators on setValue', async () => {
    let calls = 0;
    const asyncValidator = async () => { calls++; return null; };
    const ctrl = formControl('', [], [asyncValidator]);
    await new Promise(r => setTimeout(r, 0));
    expect(calls).toBe(1);
    ctrl.setValue('new');
    await new Promise(r => setTimeout(r, 0));
    expect(calls).toBe(2);
  });

  it('clears async errors on reset', async () => {
    const asyncValidator = async () => ({ bad: true });
    const ctrl = formControl('x', [], [asyncValidator]);
    await new Promise(r => setTimeout(r, 0));
    expect(ctrl.errors()).toEqual({ bad: true });
    // reset with no async validators to verify clearing
    ctrl.clearValidators();
    ctrl.reset();
    // async errors cleared immediately
    expect(ctrl.errors()).toBeNull();
  });
});

describe('formControl — reactivity', () => {
  it('valid and invalid are reactive computed signals', () => {
    const ctrl = formControl('', [Validators.required]);
    const validHistory: boolean[] = [];
    const handle = effect(() => { validHistory.push(ctrl.valid()); });
    ctrl.setValue('hello');
    ctrl.setValue('');
    handle.destroy();
    expect(validHistory).toEqual([false, true, false]);
  });

  it('multiple validators are all evaluated', () => {
    const ctrl = formControl('hi', [Validators.required, Validators.minLength(5)]);
    expect(ctrl.errors()).toEqual({ minLength: { required: 5, actual: 2 } });
  });
});

describe('formControl — numeric type', () => {
  it('works with number values', () => {
    const ctrl = formControl(0, [Validators.min(1)]);
    expect(ctrl.valid()).toBe(false);
    ctrl.setValue(5);
    expect(ctrl.valid()).toBe(true);
  });
});

describe('formControl — boolean type', () => {
  it('works with boolean values', () => {
    const agreed = formControl(false);
    expect(agreed.value()).toBe(false);
    agreed.setValue(true);
    expect(agreed.value()).toBe(true);
  });
});
