import { describe, it, expect } from 'vitest';
import { formGroup } from '../src/group.js';
import { formControl } from '../src/control.js';
import { Validators } from '../src/validators.js';
import { effect } from '@forge/core';

function makeLoginForm() {
  return formGroup({
    username: formControl('', [Validators.required]),
    password: formControl('', [Validators.required, Validators.minLength(8)]),
  });
}

describe('formGroup — initial state', () => {
  it('exposes typed controls', () => {
    const form = makeLoginForm();
    expect(form.controls.username.value()).toBe('');
    expect(form.controls.password.value()).toBe('');
  });

  it('is invalid when any child is invalid', () => {
    const form = makeLoginForm();
    expect(form.valid()).toBe(false);
    expect(form.invalid()).toBe(true);
    expect(form.status()).toBe('INVALID');
  });

  it('is valid when all children are valid', () => {
    const form = makeLoginForm();
    form.controls.username.setValue('alice');
    form.controls.password.setValue('s3cretPwd!');
    expect(form.valid()).toBe(true);
    expect(form.status()).toBe('VALID');
  });

  it('value() returns the aggregate value object', () => {
    const form = formGroup({
      name: formControl('Alice'),
      age: formControl(30),
    });
    expect(form.value()).toEqual({ name: 'Alice', age: 30 });
  });
});

describe('formGroup — value reactivity', () => {
  it('value() updates when a child changes', () => {
    const form = formGroup({ x: formControl(0) });
    const seen: number[] = [];
    const handle = effect(() => { seen.push((form.value() as { x: number }).x); });
    form.controls.x.setValue(1);
    form.controls.x.setValue(2);
    handle.destroy();
    expect(seen).toEqual([0, 1, 2]);
  });
});

describe('formGroup — setValue', () => {
  it('sets all child values at once', () => {
    const form = makeLoginForm();
    form.setValue({ username: 'bob', password: 'pass1234' });
    expect(form.controls.username.value()).toBe('bob');
    expect(form.controls.password.value()).toBe('pass1234');
  });

  it('marks children dirty after setValue', () => {
    const form = makeLoginForm();
    form.setValue({ username: 'bob', password: 'pass1234' });
    expect(form.controls.username.dirty()).toBe(true);
  });
});

describe('formGroup — patchValue', () => {
  it('updates only the provided fields', () => {
    const form = formGroup({ a: formControl('A'), b: formControl('B') });
    form.patchValue({ a: 'updated' });
    expect(form.controls.a.value()).toBe('updated');
    expect(form.controls.b.value()).toBe('B');
  });
});

describe('formGroup — reset', () => {
  it('resets all children to their initial values', () => {
    const form = makeLoginForm();
    form.setValue({ username: 'alice', password: 'somepassword' });
    form.markAsTouched();
    form.reset();
    expect(form.controls.username.value()).toBe('');
    expect(form.controls.password.value()).toBe('');
    expect(form.touched()).toBe(false);
  });

  it('resets to provided values', () => {
    const form = makeLoginForm();
    form.reset({ username: 'preset' });
    expect(form.controls.username.value()).toBe('preset');
    expect(form.controls.password.value()).toBe('');
  });
});

describe('formGroup — markAsTouched / markAsDirty', () => {
  it('propagates to all children', () => {
    const form = makeLoginForm();
    expect(form.touched()).toBe(false);
    form.markAsTouched();
    expect(form.touched()).toBe(true);
    expect(form.controls.username.touched()).toBe(true);
    expect(form.controls.password.touched()).toBe(true);
  });

  it('dirty is true when any child is dirty', () => {
    const form = makeLoginForm();
    form.controls.username.markAsDirty();
    expect(form.dirty()).toBe(true);
  });

  it('markAsDirty marks all children', () => {
    const form = makeLoginForm();
    form.markAsDirty();
    expect(form.controls.password.dirty()).toBe(true);
  });
});

describe('formGroup — disable / enable', () => {
  it('disables all children', () => {
    const form = makeLoginForm();
    form.disable();
    expect(form.controls.username.disabled()).toBe(true);
    expect(form.controls.password.disabled()).toBe(true);
    expect(form.status()).toBe('DISABLED');
  });

  it('enables all children', () => {
    const form = makeLoginForm();
    form.disable();
    form.enable();
    expect(form.controls.username.enabled()).toBe(true);
  });
});

describe('formGroup — dynamic controls', () => {
  it('addControl makes the control available', () => {
    const form = formGroup({ name: formControl('Alice') });
    form.addControl('email', formControl(''));
    expect(form.contains('email')).toBe(true);
    expect(form.value()).toEqual({ name: 'Alice', email: '' });
  });

  it('removeControl removes the control', () => {
    const form = formGroup({ a: formControl('x'), b: formControl('y') });
    form.removeControl('b');
    expect(form.contains('b')).toBe(false);
    expect(form.value()).toEqual({ a: 'x' });
  });

  it('contains returns false for unknown keys', () => {
    const form = formGroup({ x: formControl(0) });
    expect(form.contains('z')).toBe(false);
  });
});

describe('formGroup — get()', () => {
  it('returns the typed control', () => {
    const form = makeLoginForm();
    const usernameCtrl = form.get('username');
    usernameCtrl.setValue('via-get');
    expect(form.controls.username.value()).toBe('via-get');
  });

  it('throws for unknown key', () => {
    const form = formGroup({ a: formControl('') });
    // TypeScript would normally prevent this, but test runtime guard
    expect(() => form.get('nonexistent' as 'a')).toThrow();
  });
});

describe('formGroup — group-level validators', () => {
  it('reports group-level errors', () => {
    const passwordMatch = (v: unknown) => {
      const val = v as { password: string; confirm: string };
      return val.password !== val.confirm ? { passwordMismatch: true } : null;
    };
    const form = formGroup(
      { password: formControl('abc'), confirm: formControl('xyz') },
      [passwordMatch],
    );
    expect(form.errors()).toEqual({ passwordMismatch: true });
    expect(form.valid()).toBe(false);
  });

  it('group is valid when group validators pass', () => {
    const passwordMatch = (v: unknown) => {
      const val = v as { password: string; confirm: string };
      return val.password !== val.confirm ? { passwordMismatch: true } : null;
    };
    const form = formGroup(
      { password: formControl('secret'), confirm: formControl('secret') },
      [passwordMatch],
    );
    expect(form.errors()).toBeNull();
    expect(form.valid()).toBe(true);
  });

  it('setValidators / clearValidators work on group', () => {
    const alwaysFail = () => ({ bad: true });
    const form = formGroup({ x: formControl('ok') }, [alwaysFail]);
    expect(form.errors()).toEqual({ bad: true });
    form.clearValidators();
    expect(form.errors()).toBeNull();
  });
});

describe('formGroup — pending status', () => {
  it('is PENDING when any child has async validation in-flight', async () => {
    let resolve!: (v: null) => void;
    const asyncVal = () => new Promise<null>(r => { resolve = r; });
    const form = formGroup({ name: formControl('', [], [asyncVal]) });
    expect(form.status()).toBe('PENDING');
    resolve(null);
    await new Promise(r => setTimeout(r, 0));
    expect(form.status()).toBe('VALID');
  });
});
