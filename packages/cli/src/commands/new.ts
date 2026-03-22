// =============================================================================
// @forge/cli — forge new
// Scaffolds a new Forge application in a subdirectory of cwd.
// =============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Scaffolds a new project.
 *
 * Usage: forge new <project-name>
 *
 * Creates the following structure:
 *   <name>/
 *     .gitignore
 *     index.html
 *     forge.config.js
 *     package.json
 *     tsconfig.json
 *     src/
 *       env.d.ts
 *       main.ts
 *       App.forge
 */
export function runNew(args: string[]): void {
  const name = args[0];

  if (!name) {
    console.error('[Forge CLI] Usage: forge new <project-name>');
    process.exit(1);
    return;
  }

  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error(
      '[Forge CLI] Project name must be lowercase letters/digits/hyphens, starting with a letter.',
    );
    process.exit(1);
    return;
  }

  const projectDir = path.join(process.cwd(), name);

  if (fs.existsSync(projectDir)) {
    console.error(`[Forge CLI] Directory "${name}" already exists.`);
    process.exit(1);
    return;
  }

  console.log(`\n  Scaffolding Forge app: ${name}\n`);

  // Create directory tree.
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });

  // Write each template file.
  write(projectDir, 'package.json', tplPackageJson(name));
  write(projectDir, 'tsconfig.json', tplTsconfig());
  write(projectDir, 'forge.config.js', tplForgeConfig());
  write(projectDir, 'index.html', tplIndexHtml(name));
  write(projectDir, '.gitignore', tplGitignore());
  write(projectDir, 'src/env.d.ts', tplEnvDts());
  write(projectDir, 'src/main.ts', tplMainTs());
  write(projectDir, 'src/App.forge', tplAppForge());

  const files = [
    'package.json',
    'tsconfig.json',
    'forge.config.js',
    'index.html',
    '.gitignore',
    'src/env.d.ts',
    'src/main.ts',
    'src/App.forge',
  ];

  for (const f of files) {
    console.log(`  \u2713 ${name}/${f}`);
  }

  console.log(`
  Done! Next steps:

    cd ${name}
    npm install
    npm run dev
`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function write(dir: string, filename: string, content: string): void {
  fs.writeFileSync(path.join(dir, filename), content, 'utf8');
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function tplPackageJson(name: string): string {
  return JSON.stringify(
    {
      name,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'forge dev',
        build: 'forge build',
        typecheck: 'forge typecheck',
      },
      dependencies: {
        '@forge/core': '^0.1.0',
      },
      devDependencies: {
        '@forge/cli': '^0.1.0',
        '@forge/compiler': '^0.1.0',
        rolldown: '^0.14.0',
        typescript: '^5.4.0',
      },
      engines: {
        node: '>=20.0.0',
      },
    },
    null,
    2,
  );
}

function tplTsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        exactOptionalPropertyTypes: true,
        noUncheckedIndexedAccess: true,
        experimentalDecorators: true,
        useDefineForClassFields: false,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ['src'],
    },
    null,
    2,
  );
}

function tplForgeConfig(): string {
  return `// forge.config.js
import { defineConfig } from '@forge/cli';

export default defineConfig({
  entry: 'src/main.ts',
  outDir: 'dist',
  port: 3000,
});
`;
}

function tplIndexHtml(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./dist/main.js"></script>
  </body>
</html>
`;
}

function tplGitignore(): string {
  return `node_modules/
dist/
*.tsbuildinfo
`;
}

function tplEnvDts(): string {
  return `// Type declarations for .forge single-file components.
import type { ComponentContext } from '@forge/core';

declare module '*.forge' {
  const component: (ctx: ComponentContext) => Node;
  export default component;
}
`;
}

function tplMainTs(): string {
  return `import { bootstrapApp } from '@forge/core';
import { createComponent, mountComponent } from '@forge/core';
import App from './App.forge';

const appEl = document.getElementById('app');
if (appEl === null) throw new Error('[App] #app element not found in index.html');

const root = bootstrapApp();
const ctx = createComponent(root);
mountComponent(App, appEl, ctx);
`;
}

function tplAppForge(): string {
  return `<script>
import { signal } from '@forge/core';

const count = signal(0);

function increment(): void {
  count.update((n) => n + 1);
}
</script>

<template>
  <div class="app">
    <h1>Welcome to Forge ⚡</h1>
    <p class="counter">Count: {count()}</p>
    <button @click="increment">Increment</button>
  </div>
</template>

<style scoped>
.app {
  font-family: system-ui, sans-serif;
  max-width: 480px;
  margin: 4rem auto;
  padding: 0 1rem;
  text-align: center;
}

h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.counter {
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
}

button {
  padding: 0.5rem 1.5rem;
  font-size: 1rem;
  cursor: pointer;
  border: 2px solid currentColor;
  border-radius: 6px;
  background: transparent;
  transition: background 0.2s;
}

button:hover {
  background: #f0f0f0;
}
</style>
`;
}
