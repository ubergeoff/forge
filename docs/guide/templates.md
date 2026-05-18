# Template Syntax

Vorra templates are HTML-like with a set of reactive directives. The compiler transforms them into DOM runtime calls — there is no runtime template interpreter.

## Text Interpolation

Use `{expression}` to bind a JavaScript expression to a text node. The expression is re-evaluated reactively whenever any signal it reads changes.

```vorra
<template>
  <p>{message()}</p>
  <p>2 + 2 = {2 + 2}</p>
  <p>{user().name.toUpperCase()}</p>
  <p>{count() > 0 ? 'positive' : 'zero or negative'}</p>
</template>
```

Interpolations create reactive `Text` nodes. Only the text content updates when signals change — no parent element is re-rendered.

## Reactive Attribute Binding: `:attr={expr}`

Prefix an attribute name with `:` to bind it to a reactive expression. When the expression returns `null`, the attribute is removed.

```vorra
<template>
  <input :placeholder={hint()} />
  <a :href={url()}>Link</a>
  <img :src={imageUrl()} :alt={caption()} />

  <!-- Remove the attribute when null -->
  <button :disabled={isLoading() ? '' : null}>Submit</button>
</template>
```

## DOM Property Binding: `.prop={expr}`

Use `.` prefix to set a DOM property directly (bypassing attribute reflection). This is important for `value`, `checked`, `innerHTML`, and other properties that differ from their attribute equivalents.

```vorra
<template>
  <!-- Sets input.value (not the value attribute) -->
  <input .value={name()} />

  <!-- Sets checkbox.checked -->
  <input type="checkbox" .checked={isChecked()} />

  <!-- Sets element.innerHTML — use with caution! -->
  <div .innerHTML={trustedHtml()}></div>
</template>
```

## Event Listeners: `@event={handler}`

Use `@` prefix to attach DOM event listeners. The expression should be a function reference or an inline arrow function.

```vorra
<script lang="ts">
import { signal } from '@vorra/core'

const count = signal(0)

function handleClick() {
  count.update(n => n + 1)
}
</script>

<template>
  <!-- Function reference -->
  <button @click={handleClick}>Click</button>

  <!-- Inline arrow function -->
  <button @click={() => count.set(0)}>Reset</button>

  <!-- With event object -->
  <input @input={e => name.set((e.target as HTMLInputElement).value)} />

  <!-- Other DOM events -->
  <form @submit={handleSubmit}>...</form>
  <div @mouseover={highlight} @mouseout={unhighlight}></div>
</template>
```

## List Rendering: `@for={item of list()}`

Use `@for` to render an element for each item in a reactive list. The list expression is re-evaluated whenever the signals it reads change — items are added and removed from the DOM without re-rendering the whole list.

```forge
<script lang="ts">
import { signal } from '@forge/core'

const items = signal(['Apple', 'Banana', 'Cherry'])
</script>

<template>
  <ul>
    <li @for={item of items()}>{item}</li>
  </ul>
</template>
```

### Accessing the current item

The variable name before `of` is available inside the element and any of its children:

```forge
<script lang="ts">
import { signal } from '@forge/core'

interface User { id: number; name: string; email: string }

const users = signal<User[]>([
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob',   email: 'bob@example.com' },
])
</script>

<template>
  <ul>
    <li @for={user of users()}>
      <strong>{user.name}</strong> — {user.email}
    </li>
  </ul>
</template>
```

### Optional `track` hint

Append `; track <expr>` to give each item a stable identity key. This is a hint to the renderer and is parsed by the compiler (the key expression is currently recorded but not yet used for diffing):

```forge
<template>
  <li @for={user of users(); track user.id}>
    {user.name}
  </li>
</template>
```

::: tip
`@for` inserts a comment anchor node in the DOM as a stable insertion point. Items are inserted after this anchor and removed individually — the parent element is never re-rendered.
:::

::: warning
`@for` expects exactly the syntax `item of list()` (or `item of list(); track expr`). The iterable must be a signal call or any expression that returns an array — it is re-read reactively on every change.
:::

## Conditional Visibility: `:show={expr}`

`:show` toggles `display: none` on the element based on the expression. The element stays in the DOM — only its visibility changes.

```vorra
<template>
  <div :show={isLoggedIn()}>
    Welcome back, {username()}!
  </div>

  <div :show={!isLoggedIn()}>
    Please sign in.
  </div>
</template>
```

::: tip
`:show` is best for elements you toggle frequently. For elements that are conditionally mounted/unmounted entirely, use the `[formControl]` pattern described below or implement conditional rendering in the script block.
:::

## Class Bindings: `class:name={expr}`

Toggle individual CSS classes reactively:

```vorra
<template>
  <button
    class="btn"
    class:active={isActive()}
    class:loading={isLoading()}
    class:disabled={isDisabled()}
  >
    Submit
  </button>
</template>
```

You can combine static classes (via the `class` attribute) with dynamic `class:name` bindings.

## Form Control Binding: `[formControl]={ctrl}`

Bind a `FormControl` from `@vorra/forms` to an input element for two-way reactive binding:

```vorra
<script lang="ts">
import { formControl } from '@vorra/forms'
import { Validators } from '@vorra/forms'

const email = formControl('', [Validators.required, Validators.email])
</script>

<template>
  <div>
    <input [formControl]={email} type="email" placeholder="Email" />
    <span :show={email.invalid() && email.touched()}>
      {email.errors()?.required ? 'Email is required.' : 'Enter a valid email.'}
    </span>
  </div>
</template>
```

`[formControl]` automatically:
- Sets the input's value from `ctrl.value()`
- Updates `ctrl` on `input` events
- Calls `ctrl.markAsTouched()` on `blur`

## Summary of Directives

| Syntax | Purpose | Example |
|--------|---------|---------|
| `{expr}` | Reactive text interpolation | `{count()}` |
| `:attr={expr}` | Reactive attribute binding | `:disabled={null}` |
| `.prop={expr}` | DOM property binding | `.value={name()}` |
| `@event={fn}` | Event listener | `@click={handleClick}` |
| `@for={item of list()}` | Reactive list rendering | `@for={user of users()}` |
| `:show={expr}` | Conditional visibility | `:show={isLoggedIn()}` |
| `class:name={expr}` | Conditional class toggle | `class:active={isOn()}` |
| `[formControl]={ctrl}` | Two-way form binding | `[formControl]={email}` |

## Static Attributes and Classes

Attributes and classes without a reactive prefix are emitted as-is using `setAttribute`:

```vorra
<template>
  <div class="container" id="main" role="main">
    <img src="/logo.svg" alt="Logo" width="48" height="48" />
  </div>
</template>
```

## Whitespace and Fragments

Templates must have a single root element. If you need to return multiple top-level elements, wrap them in a `<div>` or a semantic container.

## Component References

Pascal-cased tags are treated as component references. Import the `.vorra` file in the script block and the compiler resolves it:

```vorra
<script lang="ts">
import Button from './Button.vorra'
import Modal from './Modal.vorra'
</script>

<template>
  <div>
    <Button @click={openModal} :label={'Open'} />
    <Modal :show={isOpen()} @close={closeModal} />
  </div>
</template>
```
