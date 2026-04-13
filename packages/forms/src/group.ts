// =============================================================================
// @forge/forms — FormGroup
// =============================================================================

import { signal, computed } from '@forge/core';
import type { ReadonlySignal } from '@forge/core';
import type { ValidationErrors, ValidatorFn, FormStatus } from './types.js';
import type { FormControl } from './control.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A map of control names to FormControl instances. */
export type ControlsConfig = Record<string, FormControl<unknown>>;

/** Extracts the value shape from a controls config type. */
export type GroupValue<C extends ControlsConfig> = {
  [K in keyof C]: C[K] extends FormControl<infer T> ? T : never;
};

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface FormGroup<C extends ControlsConfig = ControlsConfig> {
  /** The child controls. Access individual controls via `controls.fieldName`. */
  readonly controls: C;

  /** Computed aggregate value of all child controls. */
  readonly value: ReadonlySignal<GroupValue<C>>;
  /** True when all child controls are valid and there are no group-level errors. */
  readonly valid: ReadonlySignal<boolean>;
  readonly invalid: ReadonlySignal<boolean>;
  readonly pending: ReadonlySignal<boolean>;
  readonly disabled: ReadonlySignal<boolean>;
  /** Group-level validation errors (not child errors). */
  readonly errors: ReadonlySignal<ValidationErrors | null>;
  readonly status: ReadonlySignal<FormStatus>;
  /** True if any child control is touched. */
  readonly touched: ReadonlySignal<boolean>;
  /** True if any child control is dirty. */
  readonly dirty: ReadonlySignal<boolean>;

  /**
   * Set the value of every control in the group.
   * All keys in the group must be present in `value`.
   */
  setValue(value: GroupValue<C>): void;
  /** Set only the provided fields, leaving others unchanged. */
  patchValue(value: Partial<GroupValue<C>>): void;
  /** Reset all controls to their initial values (or provided values). */
  reset(value?: Partial<GroupValue<C>>): void;

  markAsTouched(): void;
  markAsUntouched(): void;
  markAsDirty(): void;
  markAsPristine(): void;
  disable(): void;
  enable(): void;

  /** Type-safe access to a child control by name. */
  get<K extends keyof C>(name: K): C[K];
  /** Add a control dynamically (the group's TypeScript type will not change). */
  addControl(name: string, control: FormControl<unknown>): void;
  /** Remove a control dynamically. */
  removeControl(name: string): void;
  /** Check whether a control exists with the given name. */
  contains(name: string): boolean;

  setValidators(validators: ValidatorFn[]): void;
  addValidators(validators: ValidatorFn[]): void;
  clearValidators(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a signal-based form group that aggregates named child controls.
 *
 * @example
 * const form = formGroup({
 *   name: formControl('', [Validators.required]),
 *   email: formControl('', [Validators.required, Validators.email]),
 * });
 *
 * form.value()  // { name: '', email: '' }
 * form.valid()  // false
 *
 * form.controls.name.setValue('Alice');
 * form.controls.email.setValue('alice@example.com');
 * form.valid()  // true
 */
export function formGroup<C extends ControlsConfig>(
  controls: C,
  validators: ValidatorFn[] = [],
): FormGroup<C> {
  // Internal mutable controls map (supports addControl / removeControl).
  const _controls = signal<Record<string, FormControl<unknown>>>({ ...controls });
  const _validators = signal<ValidatorFn[]>(validators);

  const value = computed(() => {
    const ctrls = _controls();
    const result: Record<string, unknown> = {};
    for (const [k, ctrl] of Object.entries(ctrls)) {
      result[k] = ctrl.value();
    }
    return result as GroupValue<C>;
  });

  const groupErrors = computed<ValidationErrors | null>(() => {
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
    const ctrls = Object.values(_controls());
    if (ctrls.some(c => c.status() === 'PENDING')) return 'PENDING';
    if (groupErrors() !== null || ctrls.some(c => c.status() === 'INVALID')) return 'INVALID';
    if (ctrls.length > 0 && ctrls.every(c => c.status() === 'DISABLED')) return 'DISABLED';
    return 'VALID';
  });

  return {
    get controls(): C { return _controls() as C; },

    value,
    valid: computed(() => status() === 'VALID'),
    invalid: computed(() => status() === 'INVALID'),
    pending: computed(() => status() === 'PENDING'),
    disabled: computed(() => status() === 'DISABLED'),
    errors: groupErrors,
    status,
    touched: computed(() => Object.values(_controls()).some(c => c.touched())),
    dirty: computed(() => Object.values(_controls()).some(c => c.dirty())),

    setValue(v: GroupValue<C>): void {
      const ctrls = _controls();
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        ctrls[k]?.setValue(val);
      }
    },

    patchValue(v: Partial<GroupValue<C>>): void {
      const ctrls = _controls();
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (val !== undefined) ctrls[k]?.setValue(val);
      }
    },

    reset(v?: Partial<GroupValue<C>>): void {
      const ctrls = _controls();
      const vals = v as Record<string, unknown> | undefined;
      for (const [k, ctrl] of Object.entries(ctrls)) {
        ctrl.reset(vals?.[k]);
      }
    },

    markAsTouched(): void { Object.values(_controls()).forEach(c => c.markAsTouched()); },
    markAsUntouched(): void { Object.values(_controls()).forEach(c => c.markAsUntouched()); },
    markAsDirty(): void { Object.values(_controls()).forEach(c => c.markAsDirty()); },
    markAsPristine(): void { Object.values(_controls()).forEach(c => c.markAsPristine()); },
    disable(): void { Object.values(_controls()).forEach(c => c.disable()); },
    enable(): void { Object.values(_controls()).forEach(c => c.enable()); },

    get<K extends keyof C>(name: K): C[K] {
      const ctrl = _controls()[name as string];
      if (ctrl === undefined) throw new Error(`FormGroup: control '${String(name)}' not found`);
      return ctrl as C[K];
    },

    addControl(name: string, control: FormControl<unknown>): void {
      _controls.update(c => ({ ...c, [name]: control }));
    },

    removeControl(name: string): void {
      _controls.update(c => {
        const next = { ...c };
        delete next[name];
        return next;
      });
    },

    contains(name: string): boolean {
      return name in _controls();
    },

    setValidators(v: ValidatorFn[]): void { _validators.set([...v]); },
    addValidators(v: ValidatorFn[]): void { _validators.update(cur => [...cur, ...v]); },
    clearValidators(): void { _validators.set([]); },
  };
}
