# @forge/forms

Reactive, signal-based form controls for Forge. Every form state value is a signal — validation, touched/dirty status, and the value itself — making your templates naturally reactive.

```bash
npm install @forge/forms
```

## formControl()

Creates a signal-based control for a single field.

```ts
function formControl<T>(
  initialValue: T,
  validators?: ValidatorFn[],
  asyncValidators?: AsyncValidatorFn[]
): FormControl<T>
```

**Example:**
```ts
import { formControl, Validators } from '@forge/forms'

const email = formControl('', [Validators.required, Validators.email])
```

---

## FormControl\<T\>

The interface returned by `formControl()`.

### State signals

| Signal | Type | Description |
|--------|------|-------------|
| `value` | `ReadonlySignal<T>` | Current field value |
| `valid` | `ReadonlySignal<boolean>` | All validators pass |
| `invalid` | `ReadonlySignal<boolean>` | At least one validator fails |
| `pending` | `ReadonlySignal<boolean>` | Async validation in progress |
| `disabled` | `ReadonlySignal<boolean>` | Control is disabled |
| `enabled` | `ReadonlySignal<boolean>` | Not disabled |
| `errors` | `ReadonlySignal<ValidationErrors \| null>` | Merged sync + async errors |
| `status` | `ReadonlySignal<FormStatus>` | `'VALID'`, `'INVALID'`, `'PENDING'`, `'DISABLED'` |
| `touched` | `ReadonlySignal<boolean>` | User has focused this field |
| `untouched` | `ReadonlySignal<boolean>` | User has not focused |
| `dirty` | `ReadonlySignal<boolean>` | Value has changed from initial |
| `pristine` | `ReadonlySignal<boolean>` | Value has not changed |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setValue` | `(value: T) => void` | Set value, mark dirty, run async validators |
| `patchValue` | `(value: T) => void` | Alias for `setValue` |
| `reset` | `(value?: T) => void` | Reset to initial (or provided) value; clears touched/dirty |
| `markAsTouched` | `() => void` | |
| `markAsUntouched` | `() => void` | |
| `markAsDirty` | `() => void` | |
| `markAsPristine` | `() => void` | |
| `disable` | `() => void` | |
| `enable` | `() => void` | |
| `setValidators` | `(validators: ValidatorFn[]) => void` | Replace validators and re-validate |
| `addValidators` | `(validators: ValidatorFn[]) => void` | Append validators |
| `clearValidators` | `() => void` | Remove all validators |

---

## formGroup()

Creates a signal-based form group that aggregates named child controls.

```ts
function formGroup<C extends ControlsConfig>(
  controls: C,
  validators?: ValidatorFn[]
): FormGroup<C>
```

**Example:**
```ts
const form = formGroup({
  name: formControl('', [Validators.required]),
  email: formControl('', [Validators.required, Validators.email]),
})
```

---

## FormGroup\<C\>

### State signals

| Signal | Type | Description |
|--------|------|-------------|
| `value` | `ReadonlySignal<GroupValue<C>>` | Aggregate value of all child controls |
| `valid` | `ReadonlySignal<boolean>` | All children valid, no group errors |
| `invalid` | `ReadonlySignal<boolean>` | |
| `pending` | `ReadonlySignal<boolean>` | Any child is pending |
| `disabled` | `ReadonlySignal<boolean>` | All children disabled |
| `errors` | `ReadonlySignal<ValidationErrors \| null>` | Group-level errors only |
| `status` | `ReadonlySignal<FormStatus>` | |
| `touched` | `ReadonlySignal<boolean>` | Any child is touched |
| `dirty` | `ReadonlySignal<boolean>` | Any child is dirty |

### Members

| Member | Description |
|--------|-------------|
| `controls` | The child controls map (`C`) |
| `setValue(v)` | Set all child values — all keys required |
| `patchValue(v)` | Set only provided fields |
| `reset(v?)` | Reset all children |
| `get(name)` | Type-safe access to a child control |
| `addControl(name, ctrl)` | Add a control dynamically |
| `removeControl(name)` | Remove a control dynamically |
| `contains(name)` | Check if a control exists |
| `setValidators(v)` | Set group-level validators |
| `addValidators(v)` | Append group-level validators |
| `clearValidators()` | Remove group-level validators |

---

## formArray()

Creates a signal-based form array for a dynamic list of controls.

```ts
function formArray<T>(
  initialControls?: FormControl<T>[],
  validators?: ValidatorFn[]
): FormArray<T>
```

**Example:**
```ts
const tags = formArray([
  formControl('typescript'),
  formControl('forge'),
])
```

---

## FormArray\<T\>

### State signals

| Signal | Type | Description |
|--------|------|-------------|
| `controls` | `ReadonlySignal<ReadonlyArray<FormControl<T>>>` | Array of child controls |
| `value` | `ReadonlySignal<T[]>` | Array of child values |
| `length` | `ReadonlySignal<number>` | Number of controls |
| `valid / invalid / pending / disabled` | `ReadonlySignal<boolean>` | Aggregate status |
| `errors` | `ReadonlySignal<ValidationErrors \| null>` | Array-level errors only |
| `status` | `ReadonlySignal<FormStatus>` | |
| `touched / dirty` | `ReadonlySignal<boolean>` | Any child is touched/dirty |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `at` | `(index: number) => FormControl<T>` | Access by index — throws if out of bounds |
| `push` | `(ctrl: FormControl<T>) => void` | Append a control |
| `insert` | `(index: number, ctrl: FormControl<T>) => void` | Insert at index |
| `removeAt` | `(index: number) => void` | Remove at index |
| `clear` | `() => void` | Remove all controls |
| `setValue` | `(values: T[]) => void` | Set all child values — lengths must match |
| `patchValue` | `(values: T[]) => void` | Set values for existing controls |
| `reset` | `(values?: T[]) => void` | Reset all children |

---

## Validators

Built-in synchronous validators. All validators follow the `ValidatorFn` signature.

```ts
type ValidatorFn = (value: unknown) => ValidationErrors | null
```

### Validators.required

Fails when the value is `null`, `undefined`, or `''`.

```ts
formControl('', [Validators.required])
// errors: { required: true }
```

### Validators.minLength(min)

Fails when the string length is less than `min`. Passes for empty/nullish values.

```ts
formControl('ab', [Validators.minLength(3)])
// errors: { minLength: { required: 3, actual: 2 } }
```

### Validators.maxLength(max)

Fails when the string length exceeds `max`.

```ts
formControl('hello', [Validators.maxLength(4)])
// errors: { maxLength: { required: 4, actual: 5 } }
```

### Validators.min(minimum)

Fails when the numeric value is less than `minimum`.

```ts
formControl(-1, [Validators.min(0)])
// errors: { min: { min: 0, actual: -1 } }
```

### Validators.max(maximum)

Fails when the numeric value exceeds `maximum`.

```ts
formControl(101, [Validators.max(100)])
// errors: { max: { max: 100, actual: 101 } }
```

### Validators.email

Fails when the value is not a well-formed email address (basic RFC-5322 pattern). Passes for empty/nullish values.

```ts
formControl('not-an-email', [Validators.email])
// errors: { email: true }
```

### Validators.pattern(regex)

Fails when the value does not match the given pattern. Passes for empty/nullish values.

```ts
formControl('ABC', [Validators.pattern(/^[a-z]+$/)])
// errors: { pattern: { requiredPattern: '^[a-z]+$', actual: 'ABC' } }

// String patterns are anchored (^...$) automatically:
formControl('hello world', [Validators.pattern('[a-z]+')])
// errors: { pattern: ... }  — space not matched
```

---

## compose()

Composes multiple validators into a single `ValidatorFn`. Runs each in order and merges all errors.

```ts
function compose(...validators: ValidatorFn[]): ValidatorFn
```

**Example:**
```ts
import { compose, Validators } from '@forge/forms'

const nameValidator = compose(
  Validators.required,
  Validators.minLength(2),
  Validators.maxLength(50)
)

const name = formControl('', [nameValidator])
```

---

## Async Validators

Async validators are passed as the third argument to `formControl`.

```ts
type AsyncValidatorFn = (value: unknown) => Promise<ValidationErrors | null>
```

**Example:**
```ts
const uniqueEmail: AsyncValidatorFn = async (value) => {
  const exists = await checkEmail(String(value))
  return exists ? { emailTaken: true } : null
}

const email = formControl('', [Validators.required, Validators.email], [uniqueEmail])
```

While async validators are running, `ctrl.pending()` is `true` and `ctrl.status()` is `'PENDING'`.

---

## Types

### ValidationErrors

```ts
type ValidationErrors = Record<string, unknown>
```

### FormStatus

```ts
type FormStatus = 'VALID' | 'INVALID' | 'PENDING' | 'DISABLED'
```

### ControlsConfig

```ts
type ControlsConfig = Record<string, FormControl<unknown>>
```

### GroupValue\<C\>

Extracts the aggregate value type from a `ControlsConfig`:

```ts
type GroupValue<C extends ControlsConfig> = {
  [K in keyof C]: C[K] extends FormControl<infer T> ? T : never
}
```
