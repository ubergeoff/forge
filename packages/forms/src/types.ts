// =============================================================================
// @forge/forms — Shared Types
// =============================================================================

/** Map of validation error keys to error detail values. */
export type ValidationErrors = Record<string, unknown>;

/** A synchronous validator function. Returns errors or null if valid. */
export type ValidatorFn = (value: unknown) => ValidationErrors | null;

/** An async validator function. Returns a promise of errors or null. */
export type AsyncValidatorFn = (value: unknown) => Promise<ValidationErrors | null>;

/** The validity status of a control or group. */
export type FormStatus = 'VALID' | 'INVALID' | 'PENDING' | 'DISABLED';
