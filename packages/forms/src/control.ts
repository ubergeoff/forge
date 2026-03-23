// =============================================================================
// @forge/forms — FormControl
// =============================================================================

import { signal, computed } from '@forge/core';
import type { ReadonlySignal } from '@forge/core';
import type { ValidationErrors, ValidatorFn, AsyncValidatorFn, FormStatus } from './types.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface FormControl<T = unknown> {
  /** The current value as a reactive signal. */
  readonly value: ReadonlySignal<T>;
  /** True when the control passes all validators. */
  readonly valid: ReadonlySignal<boolean>;
  /** True when the control fails at least one validator. */
  readonly invalid: ReadonlySignal<boolean>;
  /** True while async validation is in-flight. */
  readonly pending: ReadonlySignal<boolean>;
  /** True when the control has been explicitly disabled. */
  readonly disabled: ReadonlySignal<boolean>;
  /** True when the control is not disabled. */
  readonly enabled: ReadonlySignal<boolean>;
  /** Merged sync + async validation errors, or null if valid/disabled. */
  readonly errors: ReadonlySignal<ValidationErrors | null>;
  /** The overall validation status. */
  readonly status: ReadonlySignal<FormStatus>;
  /** True after `markAsTouched()` has been called (e.g. on blur). */
  readonly touched: ReadonlySignal<boolean>;
  /** Inverse of `touched`. */
  readonly untouched: ReadonlySignal<boolean>;
  /** True after the value has been changed by the user. */
  readonly dirty: ReadonlySignal<boolean>;
  /** Inverse of `dirty`. */
  readonly pristine: ReadonlySignal<boolean>;

  /** Set the control value and mark it dirty. Runs async validators. */
  setValue(value: T): void;
  /** Alias for `setValue` on a leaf control. */
  patchValue(value: T): void;
  /** Reset to initial value (or a provided value), clearing touched/dirty. */
  reset(value?: T): void;

  markAsTouched(): void;
  markAsUntouched(): void;
  markAsDirty(): void;
  markAsPristine(): void;
  disable(): void;
  enable(): void;

  /** Replace the validator list and re-run validation. */
  setValidators(validators: ValidatorFn[]): void;
  /** Append validators without removing existing ones. */
  addValidators(validators: ValidatorFn[]): void;
  /** Remove all validators. */
  clearValidators(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a signal-based form control for a single field.
 *
 * @example
 * const name = formControl('', [Validators.required, Validators.minLength(2)]);
 *
 * name.value()    // '' (reactive)
 * name.valid()    // false — required validator fails
 * name.errors()   // { required: true }
 *
 * name.setValue('Alice');
 * name.valid()    // true
 */
export function formControl<T>(
  initialValue: T,
  validators: ValidatorFn[] = [],
  asyncValidators: AsyncValidatorFn[] = [],
): FormControl<T> {
  const _value = signal<T>(initialValue);
  const _touched = signal(false);
  const _dirty = signal(false);
  const _disabled = signal(false);
  const _validators = signal<ValidatorFn[]>(validators);
  const _asyncErrors = signal<ValidationErrors | null>(null);
  const _pending = signal(false);

  // Computed sync errors — re-evaluates when validators or value change.
  const syncErrors = computed<ValidationErrors | null>(() => {
    const vals = _validators();
    if (vals.length === 0) return null;
    let combined: ValidationErrors | null = null;
    for (const v of vals) {
      const err = v(_value());
      if (err !== null) {
        combined ??= {};
        Object.assign(combined, err);
      }
    }
    return combined;
  });

  const errors = computed<ValidationErrors | null>(() => {
    if (_disabled()) return null;
    const se = syncErrors();
    const ae = _asyncErrors();
    if (se === null && ae === null) return null;
    return { ...(se ?? {}), ...(ae ?? {}) };
  });

  const status = computed<FormStatus>(() => {
    if (_disabled()) return 'DISABLED';
    if (_pending()) return 'PENDING';
    if (errors() !== null) return 'INVALID';
    return 'VALID';
  });

  function runAsync(value: T): void {
    if (asyncValidators.length === 0) return;
    _pending.set(true);
    Promise.all(asyncValidators.map(v => v(value)))
      .then(results => {
        let combined: ValidationErrors | null = null;
        for (const err of results) {
          if (err !== null) {
            combined ??= {};
            Object.assign(combined, err);
          }
        }
        _asyncErrors.set(combined);
        _pending.set(false);
      })
      .catch(() => {
        _pending.set(false);
      });
  }

  // Kick off async validation for the initial value.
  runAsync(initialValue);

  return {
    value: _value.asReadonly(),
    valid: computed(() => status() === 'VALID'),
    invalid: computed(() => status() === 'INVALID'),
    pending: computed(() => status() === 'PENDING'),
    disabled: computed(() => _disabled()),
    enabled: computed(() => !_disabled()),
    errors,
    status,
    touched: _touched.asReadonly(),
    untouched: computed(() => !_touched()),
    dirty: _dirty.asReadonly(),
    pristine: computed(() => !_dirty()),

    setValue(value: T): void {
      _value.set(value);
      _dirty.set(true);
      runAsync(value);
    },

    patchValue(value: T): void {
      this.setValue(value);
    },

    reset(value?: T): void {
      const v: T = value !== undefined ? (value as T) : initialValue;
      _value.set(v);
      _touched.set(false);
      _dirty.set(false);
      _asyncErrors.set(null);
      _pending.set(false);
      runAsync(v);
    },

    markAsTouched(): void { _touched.set(true); },
    markAsUntouched(): void { _touched.set(false); },
    markAsDirty(): void { _dirty.set(true); },
    markAsPristine(): void { _dirty.set(false); },
    disable(): void { _disabled.set(true); },
    enable(): void { _disabled.set(false); },

    setValidators(v: ValidatorFn[]): void { _validators.set([...v]); },
    addValidators(v: ValidatorFn[]): void { _validators.update(cur => [...cur, ...v]); },
    clearValidators(): void { _validators.set([]); },
  };
}
