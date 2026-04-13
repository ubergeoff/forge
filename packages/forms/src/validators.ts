// =============================================================================
// @forge/forms — Built-in Validators
// =============================================================================

import type { ValidatorFn, ValidationErrors } from './types.js';

// ---------------------------------------------------------------------------
// Validators namespace
// ---------------------------------------------------------------------------

export const Validators = {
  /**
   * Fails if the value is null, undefined, or an empty string.
   */
  required(value: unknown): ValidationErrors | null {
    if (value === null || value === undefined || value === '') {
      return { required: true };
    }
    return null;
  },

  /**
   * Fails if the string length is less than `min`.
   * Empty/nullish values pass (combine with `required` to reject them).
   */
  minLength(min: number): ValidatorFn {
    return (value: unknown): ValidationErrors | null => {
      if (value === null || value === undefined || value === '') return null;
      const actual = String(value).length;
      return actual < min ? { minLength: { required: min, actual } } : null;
    };
  },

  /**
   * Fails if the string length exceeds `max`.
   */
  maxLength(max: number): ValidatorFn {
    return (value: unknown): ValidationErrors | null => {
      if (value === null || value === undefined || value === '') return null;
      const actual = String(value).length;
      return actual > max ? { maxLength: { required: max, actual } } : null;
    };
  },

  /**
   * Fails if the numeric value is less than `minimum`.
   */
  min(minimum: number): ValidatorFn {
    return (value: unknown): ValidationErrors | null => {
      if (value === null || value === undefined || value === '') return null;
      const actual = Number(value);
      if (isNaN(actual)) return { min: { min: minimum, actual: value } };
      return actual < minimum ? { min: { min: minimum, actual } } : null;
    };
  },

  /**
   * Fails if the numeric value exceeds `maximum`.
   */
  max(maximum: number): ValidatorFn {
    return (value: unknown): ValidationErrors | null => {
      if (value === null || value === undefined || value === '') return null;
      const actual = Number(value);
      if (isNaN(actual)) return { max: { max: maximum, actual: value } };
      return actual > maximum ? { max: { max: maximum, actual } } : null;
    };
  },

  /**
   * Fails if the value is not a well-formed email address.
   * Empty/nullish values pass.
   */
  email(value: unknown): ValidationErrors | null {
    if (value === null || value === undefined || value === '') return null;
    // Basic RFC-5322 inspired pattern
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(value)) ? null : { email: true };
  },

  /**
   * Fails if the value does not match the given `regex`.
   * Empty/nullish values pass.
   */
  pattern(regex: RegExp | string): ValidatorFn {
    const re = typeof regex === 'string' ? new RegExp(`^${regex}$`) : regex;
    return (value: unknown): ValidationErrors | null => {
      if (value === null || value === undefined || value === '') return null;
      return re.test(String(value))
        ? null
        : { pattern: { requiredPattern: re.source, actual: value } };
    };
  },
} as const;

// ---------------------------------------------------------------------------
// compose()
// ---------------------------------------------------------------------------

/**
 * Composes multiple validators into one. Runs each in order and merges all
 * errors into a single object. Returns null if all pass.
 *
 * @example
 * const nameValidator = compose(Validators.required, Validators.minLength(2));
 */
export function compose(...validators: ValidatorFn[]): ValidatorFn {
  return (value: unknown): ValidationErrors | null => {
    let combined: ValidationErrors | null = null;
    for (const v of validators) {
      const err = v(value);
      if (err !== null) {
        combined ??= {};
        Object.assign(combined, err);
      }
    }
    return combined;
  };
}
