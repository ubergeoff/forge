import { describe, it, expect } from 'vitest';
import { Validators, compose } from '../src/validators.js';

describe('Validators.required', () => {
  it('returns error for empty string', () => {
    expect(Validators.required('')).toEqual({ required: true });
  });

  it('returns error for null', () => {
    expect(Validators.required(null)).toEqual({ required: true });
  });

  it('returns error for undefined', () => {
    expect(Validators.required(undefined)).toEqual({ required: true });
  });

  it('returns null for non-empty string', () => {
    expect(Validators.required('hello')).toBeNull();
  });

  it('returns null for 0', () => {
    expect(Validators.required(0)).toBeNull();
  });

  it('returns null for false', () => {
    expect(Validators.required(false)).toBeNull();
  });
});

describe('Validators.minLength', () => {
  const min3 = Validators.minLength(3);

  it('returns error when string is too short', () => {
    expect(min3('ab')).toEqual({ minLength: { required: 3, actual: 2 } });
  });

  it('returns null when string meets minimum', () => {
    expect(min3('abc')).toBeNull();
  });

  it('returns null when string exceeds minimum', () => {
    expect(min3('abcd')).toBeNull();
  });

  it('passes empty/nullish values (combine with required)', () => {
    expect(min3('')).toBeNull();
    expect(min3(null)).toBeNull();
    expect(min3(undefined)).toBeNull();
  });
});

describe('Validators.maxLength', () => {
  const max5 = Validators.maxLength(5);

  it('returns error when string exceeds max', () => {
    expect(max5('toolong')).toEqual({ maxLength: { required: 5, actual: 7 } });
  });

  it('returns null when string is within limit', () => {
    expect(max5('hello')).toBeNull();
    expect(max5('hi')).toBeNull();
  });

  it('passes empty/nullish values', () => {
    expect(max5('')).toBeNull();
  });
});

describe('Validators.email', () => {
  it('returns error for invalid email', () => {
    expect(Validators.email('notanemail')).toEqual({ email: true });
    expect(Validators.email('missing@tld')).toEqual({ email: true });
  });

  it('returns null for valid email', () => {
    expect(Validators.email('user@example.com')).toBeNull();
    expect(Validators.email('a.b+c@domain.org')).toBeNull();
  });

  it('passes empty/nullish values', () => {
    expect(Validators.email('')).toBeNull();
    expect(Validators.email(null)).toBeNull();
  });
});

describe('Validators.min', () => {
  const min5 = Validators.min(5);

  it('returns error when value is below minimum', () => {
    expect(min5(3)).toEqual({ min: { min: 5, actual: 3 } });
  });

  it('returns null when value meets minimum', () => {
    expect(min5(5)).toBeNull();
    expect(min5(10)).toBeNull();
  });

  it('passes empty/nullish values', () => {
    expect(min5('')).toBeNull();
    expect(min5(null)).toBeNull();
  });
});

describe('Validators.max', () => {
  const max10 = Validators.max(10);

  it('returns error when value exceeds maximum', () => {
    expect(max10(11)).toEqual({ max: { max: 10, actual: 11 } });
  });

  it('returns null when value is within maximum', () => {
    expect(max10(10)).toBeNull();
    expect(max10(5)).toBeNull();
  });
});

describe('Validators.pattern', () => {
  const alphanumeric = Validators.pattern(/^[a-z0-9]+$/i);

  it('returns error when value does not match pattern', () => {
    expect(alphanumeric('hello world')).not.toBeNull();
    expect(alphanumeric('hello-world')).not.toBeNull();
  });

  it('returns null when value matches pattern', () => {
    expect(alphanumeric('hello123')).toBeNull();
  });

  it('accepts a string pattern', () => {
    const hex = Validators.pattern('[0-9a-fA-F]+');
    expect(hex('ff00cc')).toBeNull();
    expect(hex('xyz')).not.toBeNull();
  });

  it('passes empty/nullish values', () => {
    expect(alphanumeric('')).toBeNull();
  });
});

describe('compose()', () => {
  it('merges errors from multiple validators', () => {
    const validator = compose(Validators.required, Validators.minLength(5));
    expect(validator('')).toEqual({ required: true });
  });

  it('returns null when all validators pass', () => {
    const validator = compose(Validators.required, Validators.minLength(3));
    expect(validator('hello')).toBeNull();
  });

  it('collects all errors, not just the first', () => {
    // Use a value that triggers both min and max errors via custom validators
    const alwaysFails1 = () => ({ err1: true });
    const alwaysFails2 = () => ({ err2: true });
    const validator = compose(alwaysFails1, alwaysFails2);
    expect(validator('anything')).toEqual({ err1: true, err2: true });
  });
});
