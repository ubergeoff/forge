# Template Syntax

Forge templates are HTML-like with a set of reactive directives. The compiler transforms them into DOM runtime calls — there is no runtime template interpreter.

## Text Interpolation

Use `{expression}` to bind a JavaScript expression to a text node. The expression is re-evaluated reactively whenever any signal it reads changes.

```forge
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

```forge
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

```forge
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

```forge
<script lang="ts">
import { signal } from '@forge/core'

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

## Conditional Visibility: `:show={expr}`

`:show` toggles `display: none` on the element based on the expression. The element stays in the DOM — only its visibility changes.

```forge
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

```forge
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

Bind a `FormControl` from `@forge/forms` to an input element for two-way reactive binding:

```forge
<script lang="ts">
import { formControl } from '@forge/forms'
import { Validators } from '@forge/forms'

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
| `:show={expr}` | Conditional visibility | `:show={isLoggedIn()}` |
| `class:name={expr}` | Conditional class toggle | `class:active={isOn()}` |
| `[formControl]={ctrl}` | Two-way form binding | `[formControl]={email}` |

## Static Attributes and Classes

Attributes and classes without a reactive prefix are emitted as-is using `setAttribute`:

```forge
<template>
  <div class="container" id="main" role="main">
    <img src="/logo.svg" alt="Logo" width="48" height="48" />
  </div>
</template>
```

## Whitespace and Fragments

Templates must have a single root element. If you need to return multiple top-level elements, wrap them in a `<div>` or a semantic container.

## Component References

Pascal-cased tags are treated as component references. Import the `.forge` file in the script block and the compiler resolves it:

```forge
<script lang="ts">
import Button from './Button.forge'
import Modal from './Modal.forge'
</script>

<template>
  <div>
    <Button @click={openModal} :label={'Open'} />
    <Modal :show={isOpen()} @close={closeModal} />
  </div>
</template>
```
