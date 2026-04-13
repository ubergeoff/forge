# Forms

`@forge/forms` provides a reactive, signal-based forms system. Every aspect of a form field — its value, validation state, touched/dirty status — is a signal that your templates can bind to directly.

## Installation

```bash
npm install @forge/forms
```

## FormControl

`formControl` is the building block. It manages a single field's value and validation:

```ts
import { formControl, Validators } from '@forge/forms'

const name = formControl('', [Validators.required, Validators.minLength(2)])

// Read reactive state
name.value()    // → '' (current value)
name.valid()    // → false (required fails)
name.invalid()  // → true
name.errors()   // → { required: true }
name.touched()  // → false (user hasn't focused yet)
name.dirty()    // → false (user hasn't typed yet)
name.status()   // → 'INVALID'

// Update the value programmatically
name.setValue('Alice')
name.valid()    // → true
name.errors()   // → null
```

### Binding to a template

Use the `[formControl]` directive for two-way binding:

```forge
<script lang="ts">
import { formControl, Validators } from '@forge/forms'

const name = formControl('', [Validators.required, Validators.minLength(2)])
</script>

<template>
  <div class="field">
    <label>Name</label>
    <input [formControl]={name} type="text" />
    <span class="error" :show={name.invalid() && name.touched()}>
      {name.errors()?.required
        ? 'Name is required.'
        : `Minimum 2 characters (${name.value().length}/2).`}
    </span>
  </div>
</template>
```

The `[formControl]` directive:
1. Binds the input's value to `ctrl.value()`
2. Calls `ctrl.setValue()` on `input` events
3. Calls `ctrl.markAsTouched()` on `blur`

### FormControl API

| Member | Type | Description |
|--------|------|-------------|
| `value` | `ReadonlySignal<T>` | Current field value |
| `valid` | `ReadonlySignal<boolean>` | Passes all validators |
| `invalid` | `ReadonlySignal<boolean>` | Fails at least one validator |
| `pending` | `ReadonlySignal<boolean>` | Async validation in progress |
| `disabled` | `ReadonlySignal<boolean>` | Control is disabled |
| `enabled` | `ReadonlySignal<boolean>` | Control is not disabled |
| `errors` | `ReadonlySignal<ValidationErrors \| null>` | Merged sync + async errors |
| `status` | `ReadonlySignal<FormStatus>` | `'VALID'`, `'INVALID'`, `'PENDING'`, `'DISABLED'` |
| `touched` | `ReadonlySignal<boolean>` | User has focused this field |
| `untouched` | `ReadonlySignal<boolean>` | User has not focused |
| `dirty` | `ReadonlySignal<boolean>` | Value has been changed |
| `pristine` | `ReadonlySignal<boolean>` | Value has not been changed |
| `setValue(v)` | `void` | Set value, mark dirty, run async validators |
| `patchValue(v)` | `void` | Alias for `setValue` on leaf controls |
| `reset(v?)` | `void` | Reset to initial (or provided) value |
| `markAsTouched()` | `void` | |
| `markAsUntouched()` | `void` | |
| `markAsDirty()` | `void` | |
| `markAsPristine()` | `void` | |
| `disable()` | `void` | |
| `enable()` | `void` | |
| `setValidators(v)` | `void` | Replace validators and re-validate |
| `addValidators(v)` | `void` | Append validators |
| `clearValidators()` | `void` | Remove all validators |

## FormGroup

`formGroup` aggregates named controls into a logical unit:

```ts
import { formControl, formGroup, Validators } from '@forge/forms'

const loginForm = formGroup({
  email: formControl('', [Validators.required, Validators.email]),
  password: formControl('', [Validators.required, Validators.minLength(8)]),
})

loginForm.value()        // → { email: '', password: '' }
loginForm.valid()        // → false
loginForm.controls.email.setValue('alice@example.com')
loginForm.controls.password.setValue('s3cr3t123')
loginForm.valid()        // → true
loginForm.value()        // → { email: 'alice@example.com', password: 's3cr3t123' }
```

### Group-level validators

Pass validators as the second argument to validate the group as a whole (e.g., password confirmation):

```ts
function passwordsMatch(value: unknown): ValidationErrors | null {
  const { password, confirm } = value as { password: string; confirm: string }
  return password === confirm ? null : { mismatch: true }
}

const form = formGroup(
  {
    password: formControl('', [Validators.required]),
    confirm: formControl('', [Validators.required]),
  },
  [passwordsMatch]
)
```

### FormGroup API

| Member | Description |
|--------|-------------|
| `controls` | The child controls object |
| `value` | Aggregated value signal |
| `valid / invalid / pending / disabled` | Aggregate status signals |
| `errors` | Group-level (not child) errors |
| `touched` | True if any child is touched |
| `dirty` | True if any child is dirty |
| `setValue(v)` | Set all child values |
| `patchValue(v)` | Set only provided fields |
| `reset(v?)` | Reset all children |
| `get(name)` | Type-safe access to a child control |
| `addControl(name, ctrl)` | Add a control dynamically |
| `removeControl(name)` | Remove a control dynamically |
| `contains(name)` | Check if a control exists |

## FormArray

`formArray` manages a dynamic list of controls:

```ts
import { formControl, formArray, Validators } from '@forge/forms'

const tags = formArray([
  formControl('typescript'),
  formControl('forge'),
])

tags.value()   // → ['typescript', 'forge']
tags.length()  // → 2

tags.push(formControl('signals'))
tags.value()   // → ['typescript', 'forge', 'signals']

tags.removeAt(0)
tags.value()   // → ['forge', 'signals']

tags.at(0).value()  // → 'forge'
```

### FormArray API

| Member | Description |
|--------|-------------|
| `controls` | `ReadonlySignal<ReadonlyArray<FormControl<T>>>` |
| `value` | `ReadonlySignal<T[]>` |
| `length` | `ReadonlySignal<number>` |
| `at(index)` | Access control by index |
| `push(ctrl)` | Append a control |
| `insert(index, ctrl)` | Insert at index |
| `removeAt(index)` | Remove at index |
| `clear()` | Remove all controls |

## Built-in Validators

All built-in validators live in the `Validators` namespace:

| Validator | Signature | Fails when |
|-----------|-----------|------------|
| `required` | `ValidatorFn` | Value is `null`, `undefined`, or `''` |
| `minLength(n)` | `(n: number) => ValidatorFn` | String length < n |
| `maxLength(n)` | `(n: number) => ValidatorFn` | String length > n |
| `min(n)` | `(n: number) => ValidatorFn` | Numeric value < n |
| `max(n)` | `(n: number) => ValidatorFn` | Numeric value > n |
| `email` | `ValidatorFn` | Value is not a well-formed email |
| `pattern(re)` | `(re: RegExp \| string) => ValidatorFn` | Value doesn't match regex |

```ts
const age = formControl(0, [
  Validators.required,
  Validators.min(0),
  Validators.max(120),
])

const username = formControl('', [
  Validators.required,
  Validators.minLength(3),
  Validators.maxLength(20),
  Validators.pattern(/^[a-z0-9_]+$/),
])
```

## compose()

Merge multiple validators into one:

```ts
import { compose, Validators } from '@forge/forms'

const strongPassword = compose(
  Validators.required,
  Validators.minLength(8),
  Validators.pattern(/[A-Z]/),  // at least one uppercase
  Validators.pattern(/[0-9]/),  // at least one digit
)

const password = formControl('', [strongPassword])
```

## Async Validators

Async validators return a `Promise<ValidationErrors | null>`. They're passed as the third argument to `formControl`:

```ts
import type { AsyncValidatorFn } from '@forge/forms'

const uniqueUsername: AsyncValidatorFn = async (value) => {
  if (!value) return null
  const taken = await checkUsernameAvailable(String(value))
  return taken ? null : { usernameTaken: true }
}

const username = formControl('', [Validators.required], [uniqueUsername])

// While async validation runs:
username.pending()  // → true
username.status()   // → 'PENDING'

// After it resolves:
username.pending()  // → false
username.errors()   // → { usernameTaken: true } or null
```

## Complete Login Form Example

```forge
<script lang="ts">
import { formControl, formGroup, Validators } from '@forge/forms'
import { inject } from '@forge/core'
import { ROUTER } from '@forge/router'
import { AuthService } from '../services/auth.service'

const router = inject(ROUTER)
const auth = inject(AuthService)

const form = formGroup({
  email: formControl('', [Validators.required, Validators.email]),
  password: formControl('', [Validators.required, Validators.minLength(8)]),
})

const isSubmitting = form.pending

async function handleSubmit(e: Event) {
  e.preventDefault()
  form.markAsTouched()
  if (form.invalid()) return

  const { email, password } = form.value()
  await auth.login(email, password)
  router.navigate('/dashboard')
}
</script>

<template>
  <form @submit={handleSubmit} class="login-form">
    <h2>Sign In</h2>

    <div class="field">
      <label>Email</label>
      <input [formControl]={form.controls.email} type="email" />
      <span class="error" :show={form.controls.email.invalid() && form.controls.email.touched()}>
        Please enter a valid email address.
      </span>
    </div>

    <div class="field">
      <label>Password</label>
      <input [formControl]={form.controls.password} type="password" />
      <span class="error" :show={form.controls.password.invalid() && form.controls.password.touched()}>
        Password must be at least 8 characters.
      </span>
    </div>

    <button type="submit" :disabled={form.invalid() || isSubmitting()}>
      {isSubmitting() ? 'Signing in…' : 'Sign In'}
    </button>
  </form>
</template>
```
