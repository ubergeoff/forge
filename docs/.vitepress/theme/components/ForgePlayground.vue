<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

interface Props {
  defaultCode?: string
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  defaultCode: `<script lang="ts">
import { signal } from '@forge/core';

const count = signal(0);
const doubled = () => count() * 2;

function increment() {
  count.update(n => n + 1);
}
<\/script>

<template>
  <div class="counter">
    <h2>Count: {count()}</h2>
    <p>Doubled: {doubled()}</p>
    <button @click={increment}>Increment</button>
  </div>
</template>

<style>
.counter {
  font-family: sans-serif;
  padding: 24px;
  text-align: center;
}
button {
  padding: 8px 20px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}
button:hover { background: #4f46e5; }
</style>`,
  height: '480px',
})

const editorCode = ref('')
const iframeSrc = ref('')
const compileError = ref('')
const isCompiling = ref(false)
const monacoReady = ref(false)
const editorContainer = ref<HTMLElement | null>(null)

let editorInstance: any = null
let prevBlobUrl = ''
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------

onMounted(async () => {
  // Restore from URL hash if present, else use default
  const hash = location.hash.slice(1)
  if (hash) {
    try {
      editorCode.value = decodeURIComponent(atob(hash))
    } catch {
      editorCode.value = props.defaultCode
    }
  } else {
    editorCode.value = props.defaultCode
  }

  await loadMonaco()
  await compile()
})

// ---------------------------------------------------------------------------
// Monaco setup
// ---------------------------------------------------------------------------

async function loadMonaco() {
  const loader = await import('@monaco-editor/loader')
  const monaco = await loader.default.init()

  // Register 'forge' as a language with HTML-like syntax highlighting
  monaco.languages.register({ id: 'forge' })
  monaco.languages.setMonarchTokensProvider('forge', {
    defaultToken: '',
    tokenizer: {
      root: [
        [/<script[^>]*>/, { token: 'tag', next: '@script' }],
        [/<template>/, { token: 'tag', next: '@template' }],
        [/<style[^>]*>/, { token: 'tag', next: '@style' }],
        [/<\/[^>]+>/, 'tag'],
        [/<[^>]+>/, 'tag'],
      ],
      script: [
        [/<\/script>/, { token: 'tag', next: '@pop' }],
        [/.+/, 'source.ts'],
      ],
      template: [
        [/<\/template>/, { token: 'tag', next: '@pop' }],
        [/\{[^}]+\}/, 'variable.interpolation'],
        [/@[\w-]+/, 'attribute.event'],
        [/:[\w-]+/, 'attribute.reactive'],
        [/[^<{@:]+/, ''],
      ],
      style: [
        [/<\/style>/, { token: 'tag', next: '@pop' }],
        [/.+/, 'source.css'],
      ],
    },
  })

  if (!editorContainer.value) return

  editorInstance = monaco.editor.create(editorContainer.value, {
    value: editorCode.value,
    language: 'forge',
    theme: document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs',
    fontSize: 13,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    wordWrap: 'on',
    automaticLayout: true,
    tabSize: 2,
    padding: { top: 12 },
  })

  editorInstance.onDidChangeModelContent(() => {
    editorCode.value = editorInstance.getValue()
  })

  monacoReady.value = true
}

// ---------------------------------------------------------------------------
// Compilation
// Forge runtime is pre-bundled to /forge/{core,core-dom,forms}.js by
// docs/scripts/build-runtime.mjs and served as static assets. The iframe
// uses an import map pointing to those local files.
// ---------------------------------------------------------------------------

async function compile() {
  if (isCompiling.value) return
  isCompiling.value = true
  compileError.value = ''

  try {
    const { parseSFC, compileSFC } = await import('@forge/compiler/browser')
    const source = editorCode.value
    const descriptor = parseSFC(source, 'playground.forge')
    const result = compileSFC(descriptor)

    if (result.errors.length > 0) {
      compileError.value = result.errors.map(e => e.message).join('\n')
      return
    }

    // Build the component as a blob URL.
    // Requires allow-same-origin on the iframe so the blob (parent-origin) can be loaded.
    if (prevBlobUrl) URL.revokeObjectURL(prevBlobUrl)
    const blob = new Blob([result.code], { type: 'text/javascript' })
    const componentUrl = URL.createObjectURL(blob)
    prevBlobUrl = componentUrl

    const styleHtml = result.styles
      .map(s => `<style>${s.content}</style>`)
      .join('\n')

    // origin is needed so the import map absolute paths resolve correctly
    const origin = location.origin

    const harness = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script type="importmap">
  {
    "imports": {
      "@forge/core": "${origin}/forge/forge.js",
      "@forge/core/dom": "${origin}/forge/forge.js",
      "@forge/forms": "${origin}/forge/forms.js"
    }
  }
  <\/script>
  ${styleHtml}
  <style>
    body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module">
    import factory from '${componentUrl}';
    import { bootstrapApp } from '@forge/core';
    import { createComponent, mountComponent } from '@forge/core/dom';

    window.addEventListener('error', (e) => {
      document.body.innerHTML = '<pre style="color:red;padding:16px;">' + e.message + '</pre>';
    });

    const injector = bootstrapApp([]);
    const ctx = createComponent(injector);
    mountComponent(factory, document.getElementById('app'), ctx);
  <\/script>
</body>
</html>`

    iframeSrc.value = harness
  } catch (err) {
    compileError.value = err instanceof Error ? err.message : String(err)
  } finally {
    isCompiling.value = false
  }
}

// Debounced auto-compile on code changes
watch(editorCode, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(compile, 500)
})

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function share() {
  const encoded = btoa(encodeURIComponent(editorCode.value))
  const url = `${location.origin}${location.pathname}#${encoded}`
  navigator.clipboard.writeText(url).then(() => {
    alert('Link copied to clipboard!')
  })
}

function reset() {
  editorCode.value = props.defaultCode
  if (editorInstance) {
    editorInstance.setValue(props.defaultCode)
  }
}
</script>

<template>
  <div class="forge-playground" :style="{ height: props.height }">
    <!-- Toolbar -->
    <div class="playground-toolbar">
      <span class="playground-label">Forge Playground</span>
      <div class="toolbar-actions">
        <button class="toolbar-btn" @click="compile" :disabled="isCompiling">
          {{ isCompiling ? 'Running…' : '▶ Run' }}
        </button>
        <button class="toolbar-btn" @click="share">Share</button>
        <button class="toolbar-btn secondary" @click="reset">Reset</button>
      </div>
    </div>

    <!-- Split pane -->
    <div class="playground-body">
      <div class="editor-pane">
        <div ref="editorContainer" class="monaco-container"></div>
      </div>
      <div class="preview-pane">
        <div v-if="compileError" class="compile-error">
          <pre>{{ compileError }}</pre>
        </div>
        <iframe
          v-else
          class="preview-frame"
          sandbox="allow-scripts allow-same-origin"
          :srcdoc="iframeSrc"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forge-playground {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  margin: 16px 0;
}

.playground-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
  flex-shrink: 0;
}

.playground-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.toolbar-btn {
  padding: 4px 14px;
  border-radius: 5px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
  color: white;
  transition: background 0.15s;
}

.toolbar-btn:hover:not(:disabled) {
  background: var(--vp-c-brand-2);
}

.toolbar-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toolbar-btn.secondary {
  background: transparent;
  color: var(--vp-c-text-2);
  border-color: var(--vp-c-divider);
}

.toolbar-btn.secondary:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.playground-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.editor-pane {
  flex: 1;
  min-width: 0;
  border-right: 1px solid var(--vp-c-divider);
}

.monaco-container {
  width: 100%;
  height: 100%;
}

.preview-pane {
  flex: 1;
  min-width: 0;
  background: white;
  position: relative;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: none;
}

.compile-error {
  padding: 16px;
  background: #fef2f2;
  color: #991b1b;
  height: 100%;
  overflow: auto;
}

.compile-error pre {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .playground-body {
    flex-direction: column;
  }
  .editor-pane {
    border-right: none;
    border-bottom: 1px solid var(--vp-c-divider);
    height: 50%;
  }
  .preview-pane {
    height: 50%;
  }
}
</style>
