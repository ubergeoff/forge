// =============================================================================
// @forge/forms — FormArray
// =============================================================================

import { signal, computed } from '@forge/core';
import type { ReadonlySignal } from '@forge/core';
import type { ValidationErrors, ValidatorFn, FormStatus } from './types.js';
import type { FormControl } from './control.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface FormArray<T = unknown> {
  /** The current array of child controls as a reactive signal. */
  readonly controls: ReadonlySignal<ReadonlyArray<FormControl<T>>>;
  /** Computed array of all child values. */
  readonly value: ReadonlySignal<T[]>;
  readonly valid: ReadonlySignal<boolean>;
  readonly invalid: ReadonlySignal<boolean>;
  readonly pending: ReadonlySignal<boolean>;
  readonly disabled: ReadonlySignal<boolean>;
  /** Array-level validation errors (not child errors). */
  readonly errors: ReadonlySignal<ValidationErrors | null>;
  readonly status: ReadonlySignal<FormStatus>;
  /** True if any child control is touched. */
  readonly touched: ReadonlySignal<boolean>;
  /** True if any child control is dirty. */
  readonly dirty: ReadonlySignal<boolean>;
  /** Reactive count of controls. */
  readonly length: ReadonlySignal<number>;

  /** Access a control by index. Throws if out of bounds. */
  at(index: number): FormControl<T>;
  /** Append a control to the end. */
  push(control: FormControl<T>): void;
  /** Insert a control at the given index. */
  insert(index: number, control: FormControl<T>): void;
  /** Remove the control at the given index. */
  removeAt(index: number): void;
  /** Remove all controls. */
  clear(): void;

  /** Set the value of every control. The array length must match. */
  setValue(values: T[]): void;
  /** Set values for controls that exist; mismatched indices are ignored. */
  patchValue(values: T[]): void;
  /** Reset all controls (optionally to provided values). */
  reset(values?: T[]): void;

  markAsTouched(): void;
  markAsUntouched(): void;
  markAsDirty(): void;
  markAsPristine(): void;
  disable(): void;
  enable(): void;

  setValidators(validators: ValidatorFn[]): void;
  addValidators(validators: ValidatorFn[]): void;
  clearValidators(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a signal-based form array for a dynamic list of controls.
 *
 * @example
 * const tags = formArray([formControl('typescript'), formControl('forge')]);
 *
 * tags.value()   // ['typescript', 'forge']
 * tags.length()  // 2
 *
 * tags.push(formControl('signals'));
 * tags.value()   // ['typescript', 'forge', 'signals']
 *
 * tags.removeAt(0);
 * tags.value()   // ['forge', 'signals']
 */
export function formArray<T>(
  initialControls: FormControl<T>[] = [],
  validators: ValidatorFn[] = [],
): FormArray<T> {
  const _controls = signal<FormControl<T>[]>([...initialControls]);
  const _validators = signal<ValidatorFn[]>(validators);

  const value = computed<T[]>(() => _controls().map(c => c.value()));

  const arrayErrors = computed<ValidationErrors | null>(() => {
    const vals = _validators();
    if (vals.length === 0) return null;
    let combined: ValidationErrors | null = null;
    for (const v of vals) {
      const err = v(value());
      if (err !== null) {
        combined ??= {};
        Object.assign(combined, err);
      }
    }
    return combined;
  });

  const status = computed<FormStatus>(() => {
    const ctrls = _controls();
    if (ctrls.some(c => c.status() === 'PENDING')) return 'PENDING';
    if (arrayErrors() !== null || ctrls.some(c => c.status() === 'INVALID')) return 'INVALID';
    if (ctrls.length > 0 && ctrls.every(c => c.status() === 'DISABLED')) return 'DISABLED';
    return 'VALID';
  });

  return {
    controls: computed(() => _controls() as ReadonlyArray<FormControl<T>>),
    value,
    valid: computed(() => status() === 'VALID'),
    invalid: computed(() => status() === 'INVALID'),
    pending: computed(() => status() === 'PENDING'),
    disabled: computed(() => status() === 'DISABLED'),
    errors: arrayErrors,
    status,
    touched: computed(() => _controls().some(c => c.touched())),
    dirty: computed(() => _controls().some(c => c.dirty())),
    length: computed(() => _controls().length),

    at(index: number): FormControl<T> {
      const ctrl = _controls()[index];
      if (ctrl === undefined) throw new RangeError(`FormArray: index ${index} is out of bounds`);
      return ctrl;
    },

    push(control: FormControl<T>): void {
      _controls.update(arr => [...arr, control]);
    },

    insert(index: number, control: FormControl<T>): void {
      _controls.update(arr => {
        const next = [...arr];
        next.splice(index, 0, control);
        return next;
      });
    },

    removeAt(index: number): void {
      _controls.update(arr => {
        const next = [...arr];
        next.splice(index, 1);
        return next;
      });
    },

    clear(): void {
      _controls.set([]);
    },

    setValue(values: T[]): void {
      const ctrls = _controls();
      for (let i = 0; i < values.length; i++) {
        ctrls[i]?.setValue(values[i] as T);
      }
    },

    patchValue(values: T[]): void {
      const ctrls = _controls();
      for (let i = 0; i < Math.min(values.length, ctrls.length); i++) {
        ctrls[i]?.setValue(values[i] as T);
      }
    },

    reset(values?: T[]): void {
      _controls().forEach((ctrl, i) => ctrl.reset(values?.[i]));
    },

    markAsTouched(): void { _controls().forEach(c => c.markAsTouched()); },
    markAsUntouched(): void { _controls().forEach(c => c.markAsUntouched()); },
    markAsDirty(): void { _controls().forEach(c => c.markAsDirty()); },
    markAsPristine(): void { _controls().forEach(c => c.markAsPristine()); },
    disable(): void { _controls().forEach(c => c.disable()); },
    enable(): void { _controls().forEach(c => c.enable()); },

    setValidators(v: ValidatorFn[]): void { _validators.set([...v]); },
    addValidators(v: ValidatorFn[]): void { _validators.update(cur => [...cur, ...v]); },
    clearValidators(): void { _validators.set([]); },
  };
}
