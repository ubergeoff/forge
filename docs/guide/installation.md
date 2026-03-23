# Installation

## Prerequisites

- **Node.js >= 20.0.0** — Forge uses native ES modules and requires a modern Node.js runtime
- **npm >= 10** (or pnpm / yarn) — any package manager that supports workspaces works

## Automatic Setup (Recommended)

::: info Coming Soon
`npm create forge-app` is planned for a future release. Until then, use the manual setup below.
:::

## Manual Setup

### 1. Create a new project directory

```bash
mkdir my-forge-app
cd my-forge-app
npm init -y
```

### 2. Install the packages

```bash
npm install @forge/core @forge/compiler @forge/router @forge/forms
npm install --save-dev @forge/cli typescript
```

### 3. Create `forge.config.ts`

```ts
// forge.config.ts
import { defineConfig } from '@forge/cli'

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
import { bootstrapApp } from '@forge/core'
import { createComponent, mountComponent } from '@forge/core/dom'
import App from './App.forge'

const injector = bootstrapApp([])
const ctx = createComponent(injector)
mountComponent(App, document.getElementById('app')!, ctx)
```

### 6. Create your first component

```forge
<!-- src/App.forge -->
<script lang="ts">
import { signal } from '@forge/core'

const message = signal('Hello from Forge!')
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
  <title>My Forge App</title>
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
    "dev": "forge dev",
    "build": "forge build",
    "typecheck": "forge typecheck"
  }
}
```

### 9. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The dev server watches your `.forge` files and reloads on changes.

## Project Structure

A typical Forge project looks like this:

```
my-forge-app/
├── src/
│   ├── main.ts          # Application entry point
│   ├── App.forge        # Root component
│   ├── components/      # Reusable components
│   │   └── Button.forge
│   └── services/        # Injectable services
│       └── auth.ts
├── public/              # Static assets
├── index.html
├── forge.config.ts
├── tsconfig.json
└── package.json
```

## Adding the Router

```bash
npm install @forge/router
```

```ts
// src/main.ts
import { bootstrapApp } from '@forge/core'
import { provideRouter } from '@forge/router'
import { createComponent, mountComponent } from '@forge/core/dom'
import App from './App.forge'
import Home from './pages/Home.forge'
import About from './pages/About.forge'

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
