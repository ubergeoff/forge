// =============================================================================
// @vorra/cli — vorra new
// Scaffolds a new Vorra application in a subdirectory of cwd.
// =============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Scaffolds a new project.
 *
 * Usage: vorra new <project-name>
 *
 * Creates the following structure:
 *   <name>/
 *     .gitignore
 *     index.html
 *     vorra.config.js
 *     package.json
 *     tsconfig.json
 *     src/
 *       env.d.ts
 *       main.ts
 *       App.vorra
 */
export function runNew(args: string[]): void {
  const name = args[0];

  if (!name) {
    console.error('[Vorra CLI] Usage: vorra new <project-name>');
    process.exit(1);
    return;
  }

  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error(
      '[Vorra CLI] Project name must be lowercase letters/digits/hyphens, starting with a letter.',
    );
    process.exit(1);
    return;
  }

  const projectDir = path.join(process.cwd(), name);

  if (fs.existsSync(projectDir)) {
    console.error(`[Vorra CLI] Directory "${name}" already exists.`);
    process.exit(1);
    return;
  }

  console.log(`\n  Scaffolding Vorra app: ${name}\n`);

  // Create directory tree.
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });

  // Write each template file.
  write(projectDir, 'package.json', tplPackageJson(name));
  write(projectDir, 'tsconfig.json', tplTsconfig());
  write(projectDir, 'vorra.config.js', tplVorraConfig());
  write(projectDir, 'index.html', tplIndexHtml(name));
  write(projectDir, '.gitignore', tplGitignore());
  write(projectDir, 'src/env.d.ts', tplEnvDts());
  write(projectDir, 'src/main.ts', tplMainTs());
  write(projectDir, 'src/App.vorra', tplAppVorra());

  const files = [
    'package.json',
    'tsconfig.json',
    'vorra.config.js',
    'index.html',
    '.gitignore',
    'src/env.d.ts',
    'src/main.ts',
    'src/App.vorra',
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
        dev: 'vorra dev',
        build: 'vorra build',
        typecheck: 'vorra typecheck',
      },
      dependencies: {
        '@vorra/core': '^0.1.0',
      },
      devDependencies: {
        '@vorra/cli': '^0.1.0',
        '@vorra/compiler': '^0.1.0',
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

function tplVorraConfig(): string {
  return `// vorra.config.js
import { defineConfig } from '@vorra/cli';

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
    <!-- entry script injected automatically by vorra dev / vorra build -->
  </body>
</html>
`;
}

function tplGitignore(): string {
  return `node_modules/
dist/
.vorra/
*.tsbuildinfo
`;
}

function tplEnvDts(): string {
  return `// Type declarations for .vorra single-file components.
import type { ComponentContext } from '@vorra/core';

declare module '*.vorra' {
  const component: (ctx: ComponentContext) => Node;
  export default component;
}
`;
}

function tplMainTs(): string {
  return `import { bootstrapApp } from '@vorra/core';
import { createComponent, mountComponent } from '@vorra/core';
import App from './App.vorra';

const appEl = document.getElementById('app');
if (appEl === null) throw new Error('[App] #app element not found in index.html');

const root = bootstrapApp();
const ctx = createComponent(root);
mountComponent(App, appEl, ctx);
`;
}

function tplAppVorra(): string {
  return `<script>
import { signal } from '@vorra/core';

const count = signal(0);

function increment(): void {
  count.update((n) => n + 1);
}
</script>

<template>
  <div class="app">
    <h1>Welcome to Vorra ⚡</h1>
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
