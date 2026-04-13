# Installation

## Prerequisites

- **Node.js >= 20.0.0** — Vorra uses native ES modules and requires a modern Node.js runtime
- **npm >= 10** (or pnpm / yarn) — any package manager that supports workspaces works

## Automatic Setup (Recommended)

::: info Coming Soon
`npm create vorra-app` is planned for a future release. Until then, use the manual setup below.
:::

## Manual Setup

### 1. Create a new project directory

```bash
mkdir my-vorra-app
cd my-vorra-app
npm init -y
```

### 2. Install the packages

```bash
npm install @vorra/core @vorra/compiler @vorra/router @vorra/forms
npm install --save-dev @vorra/cli typescript
```

### 3. Create `vorra.config.ts`

```ts
// vorra.config.ts
import { defineConfig } from '@vorra/cli'

export default defineConfig({
  entry: 'src/main.ts',
  outDir: 'dist',
  port: 3000,
})
```

### 4. Create `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "experimentalDecorators": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

### 5. Create the entry point

```ts
// src/main.ts
import { bootstrapApp } from '@vorra/core'
import { createComponent, mountComponent } from '@vorra/core/dom'
import App from './App.vorra'

const injector = bootstrapApp([])
const ctx = createComponent(injector)
mountComponent(App, document.getElementById('app')!, ctx)
```

### 6. Create your first component

```vorra
<!-- src/App.vorra -->
<script lang="ts">
import { signal } from '@vorra/core'

const message = signal('Hello from Vorra!')
</script>

<template>
  <div>
    <h1>{message()}</h1>
  </div>
</template>
```

### 7. Create `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Vorra App</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### 8. Add scripts to `package.json`

```json
{
  "scripts": {
    "dev": "vorra dev",
    "build": "vorra build",
    "typecheck": "vorra typecheck"
  }
}
```

### 9. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The dev server watches your `.vorra` files and reloads on changes.

## Project Structure

A typical Vorra project looks like this:

```
my-vorra-app/
├── src/
│   ├── main.ts          # Application entry point
│   ├── App.vorra        # Root component
│   ├── components/      # Reusable components
│   │   └── Button.vorra
│   └── services/        # Injectable services
│       └── auth.ts
├── public/              # Static assets
├── index.html
├── vorra.config.ts
├── tsconfig.json
└── package.json
```

## Adding the Router

```bash
npm install @vorra/router
```

```ts
// src/main.ts
import { bootstrapApp } from '@vorra/core'
import { provideRouter } from '@vorra/router'
import { createComponent, mountComponent } from '@vorra/core/dom'
import App from './App.vorra'
import Home from './pages/Home.vorra'
import About from './pages/About.vorra'

const injector = bootstrapApp([
  ...provideRouter([
    { path: '/', component: Home },
    { path: '/about', component: About },
  ]),
])

const ctx = createComponent(injector)
mountComponent(App, document.getElementById('app')!, ctx)
```

## Next Steps

- [Your First Component](/guide/your-first-component) — build something real
- [Reactivity](/guide/reactivity) — understand signals and effects
- [CLI Reference](/guide/cli) — full CLI documentation
