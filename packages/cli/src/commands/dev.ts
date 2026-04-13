// =============================================================================
// @vorra/cli — forge dev
// Development server: Rolldown one-shot builds + fs.watch for source changes +
// Server-Sent Events (SSE) for component-level HMR.
//
// We intentionally do NOT use Rolldown's watch() API because its native
// file-watcher does not reliably exclude the output directory on Windows,
// causing every build write to trigger another rebuild (infinite loop).
// Instead we use Node's built-in fs.watch() restricted to source files only.
//
// HMR strategy:
//   - Each .forge file is split into its own output chunk (stable name).
//   - fs.watch tracks which .forge files changed during a quiet period.
//   - If ONLY .forge files changed, an 'hmr-update' SSE event is sent so the
//     browser can hot-swap individual components without a full page reload.
//   - If any non-.forge source file also changed, a full 'reload' is sent
//     (e.g. a service dependency changed — the whole app must restart).
// =============================================================================

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { build } from 'rolldown';
import type { RolldownPlugin, OutputOptions } from 'rolldown';
import { forgePlugin, generateScopeId } from '@vorra/compiler';
import { loadConfig } from '../utils/config.js';
import { forgeDedupePlugin } from '../utils/forge-dedupe-plugin.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HMR_ENDPOINT = '/__forge_hmr';

/**
 * Injected before </body> in every HTML response.
 *
 * Sets up window.__forge_hmr with an instance registry, then opens an SSE
 * connection to receive either component-level HMR updates or full reloads.
 *
 * 'hmr-update' — one or more .forge chunks changed; each is re-imported with
 *   a cache-busting timestamp. The new chunk calls window.__forge_hmr.accept()
 *   which triggers the in-place component swap implemented in @vorra/core.
 *
 * 'reload' — a non-component file changed; fall back to a full page reload.
 */
const HMR_CLIENT_SCRIPT = `<script type="module">
(function () {
  if (!window.__forge_hmr) window.__forge_hmr = {};
  var hmr = window.__forge_hmr;
  if (!hmr.instances) hmr.instances = new Map();

  var es = new EventSource('${HMR_ENDPOINT}');

  es.addEventListener('hmr-update', function (e) {
    var data = JSON.parse(e.data);
    data.updates.forEach(function (update) {
      console.log('[forge hmr] updating component ' + update.id);
      import(update.url + '?t=' + Date.now()).catch(function (err) {
        console.error('[forge hmr] failed to load update, falling back to reload', err);
        location.reload();
      });
    });
  });

  es.addEventListener('reload', function () {
    console.log('[forge hmr] full reload');
    location.reload();
  });

  es.addEventListener('error', function () { es.close(); });
})();
</script>`;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Starts the forge development server.
 *
 * CLI flags (override forge.config.js):
 *   --port <number>   Dev server port (default: 3000)
 *   --entry <path>    Entry file (default: src/main.ts)
 *   --outDir <path>   Output directory (default: dist)
 */
export async function runDev(args: string[]): Promise<void> {
  const cwd = process.cwd();
  const config = await loadConfig(cwd);

  // Parse CLI flags.
  const portIdx = args.indexOf('--port');
  const entryIdx = args.indexOf('--entry');
  const outDirIdx = args.indexOf('--outDir');

  const port =
    portIdx !== -1
      ? parseInt(args[portIdx + 1] ?? '3000', 10)
      : (config.port ?? 3000);
  const entry =
    (entryIdx !== -1 ? args[entryIdx + 1] : undefined) ?? config.entry ?? 'src/main.ts';
  const outDir =
    (outDirIdx !== -1 ? args[outDirIdx + 1] : undefined) ?? config.devOutDir ?? '.forge';

  const entryAbs = path.join(cwd, entry);
  const outDirAbs = path.join(cwd, outDir);
  // Normalise to forward-slash for reliable prefix checks on Windows.
  const outDirNorm = outDirAbs.replace(/\\/g, '/') + '/';
  const outDirRel = path.relative(cwd, outDirAbs).replace(/\\/g, '/');

  const userPlugins = (config.plugins ?? []) as RolldownPlugin[];
  // Replace the __forge_dev compile-time constant with `true` so the HMR
  // runtime block in @vorra/core/dom.ts is included (and dead code in
  // production builds is tree-shaken when the constant is `false`).
  // Rolldown's programmatic build() API does not accept a top-level `define`
  // option, so we use a minimal transform plugin instead.
  const devDefinePlugin: RolldownPlugin = {
    name: 'forge-dev-define',
    transform(code: string) {
      if (!code.includes('__forge_dev')) return null;
      // Strip TypeScript `declare const __forge_dev` ambient declarations so that
      // Rolldown resolving workspace packages to their TypeScript source (via root
      // tsconfig `paths`) doesn't produce invalid syntax like `declare const true`.
      let result = code.replace(/declare\s+const\s+__forge_dev\b[^\n]*\n?/g, '');
      result = result.replaceAll('__forge_dev', 'true');
      return { code: result };
    },
  };
  const plugins: RolldownPlugin[] = [
    forgeDedupePlugin,
    forgePlugin({
      hmr: true,
      ...(config.css ? { css: path.join(cwd, config.css) } : {}),
      ...(config.postcss ? { postcss: config.postcss } : {}),
    }) as RolldownPlugin,
    devDefinePlugin,
    ...userPlugins,
  ];

  // Ensure output directory exists before the first build.
  fs.mkdirSync(outDirAbs, { recursive: true });

  // -------------------------------------------------------------------------
  // SSE clients
  // -------------------------------------------------------------------------

  const clients = new Set<http.ServerResponse>();

  /** Broadcasts an SSE event to all connected browser clients. */
  function broadcast(event: string, data: string): void {
    for (const client of clients) {
      try {
        client.write(`event: ${event}\ndata: ${data}\n\n`);
      } catch {
        // Dead connection — remove it.
        clients.delete(client);
      }
    }
  }

  // -------------------------------------------------------------------------
  // HMR change tracking
  //
  // The fs.watch callback populates these sets as files change. runBuild()
  // drains them at the start of each build to decide whether to send a
  // component-level HMR update or a full page reload.
  // -------------------------------------------------------------------------

  /** Absolute paths of .forge files that changed since the last build. */
  const changedForgeFiles = new Set<string>();
  /** True if any non-.forge source file changed since the last build. */
  let hasNonForgeChanges = false;

  // -------------------------------------------------------------------------
  // One-shot Rolldown build
  // -------------------------------------------------------------------------

  let isBuilding = false;
  let pendingRebuild = false;

  // Each .forge component gets its own output chunk (stable name so the
  // browser can cache-bust with ?t=timestamp on HMR update).
  // manualChunks is part of Rolldown's Rollup-compatible surface but is not
  // in its native OutputOptions type yet; cast through unknown to suppress.
  const devOutput: OutputOptions = {
    dir: outDirAbs,
    format: 'es',
    sourcemap: true,
    entryFileNames: '[name].js',
    // Stable chunk names (no content hash) so the browser can predict the URL.
    chunkFileNames: '[name].js',
    ...(({
      manualChunks(id: string): string | undefined {
        // Each .forge component becomes its own chunk so only the changed
        // component needs to be re-fetched on HMR update.
        if (id.endsWith('.forge')) {
          return path.relative(cwd, id).replace(/\\/g, '/').replace('.forge', '');
        }
        // Bundle all @vorra/* runtime into a single stable shared chunk.
        if (id.includes(path.join('node_modules', '@vorra'))) {
          return 'forge-runtime';
        }
        return undefined;
      },
    }) as unknown as Partial<OutputOptions>),
  };

  async function runBuild(): Promise<void> {
    if (isBuilding) {
      // A build is already in flight; schedule a follow-up instead of stacking.
      pendingRebuild = true;
      return;
    }
    isBuilding = true;
    pendingRebuild = false;

    // Snapshot and clear the change sets before the async build starts so
    // any edits made during the build are captured in the next cycle.
    const currentForgeChanges = new Set(changedForgeFiles);
    const currentHasNonForge = hasNonForgeChanges;
    changedForgeFiles.clear();
    hasNonForgeChanges = false;

    try {
      await build({
        input: entryAbs,
        plugins,
        output: devOutput,
      });

      if (currentForgeChanges.size > 0 && !currentHasNonForge) {
        // Only .forge files changed — perform component-level HMR.
        const updates = Array.from(currentForgeChanges).map((filePath) => {
          const id = generateScopeId(filePath);
          const rel = path.relative(cwd, filePath).replace(/\\/g, '/').replace('.forge', '');
          // URL the browser will request; the static server resolves it from outDirAbs.
          const url = `/${path.join(outDir, rel).replace(/\\/g, '/')}.js`;
          return { id, url };
        });
        console.log(`[forge hmr] Hot-updating ${updates.length} component(s)...`);
        broadcast('hmr-update', JSON.stringify({ updates }));
      } else {
        // Non-.forge source changed (service, utility, config, etc.) — full reload.
        console.log('[forge dev] Rebuilt — notifying clients...');
        broadcast('reload', '{}');
      }
    } catch {
      console.error('[forge dev] Build error — check the terminal above for details.');
    } finally {
      isBuilding = false;
      if (pendingRebuild) {
        void runBuild();
      }
    }
  }

  // -------------------------------------------------------------------------
  // Source file watcher (fs.watch, source files only)
  // -------------------------------------------------------------------------
  //
  // We watch the entire project root but skip anything inside the output
  // directory and node_modules. This avoids the Rolldown-watcher bug where
  // the native exclude option does not reliably prevent dist/ writes from
  // re-triggering a rebuild on Windows.

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const fsWatcher = fs.watch(cwd, { recursive: true }, (_event, filename) => {
    if (!filename) return;

    // Normalise to forward slashes for consistent prefix matching.
    const rel = filename.replace(/\\/g, '/');

    // Ignore output directory and node_modules.
    if (rel.startsWith(outDirRel + '/')) return;
    if (rel.startsWith('node_modules/')) return;

    // Also guard against absolute paths that lie inside outDir (Windows edge case).
    const abs = path.resolve(cwd, filename).replace(/\\/g, '/') + '/';
    if (abs.startsWith(outDirNorm)) return;

    // Track file type for HMR decision.
    // Only recognised source extensions should trigger a rebuild — everything
    // else (editor temp files, OS metadata, TypeScript build-info, etc.) is
    // ignored entirely, including the debounce, so it cannot cause a spurious
    // empty rebuild that falls to the full-reload branch.
    const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.html', '.css'];
    if (filename.endsWith('.forge')) {
      changedForgeFiles.add(path.resolve(cwd, filename));
    } else if (SOURCE_EXTENSIONS.some((ext) => filename.endsWith(ext))) {
      hasNonForgeChanges = true;
    } else {
      // Not a source file we care about — skip debounce entirely.
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void runBuild();
    }, 80);
  });

  // Derive the entry script URL so we can auto-inject it into HTML responses
  // when the user's index.html has no <script type="module"> tag.
  const entryName = path.basename(entry, path.extname(entry));
  const devScriptSrc = `/${outDir}/${entryName}.js`;

  // Initial build on startup.
  console.log(`[forge dev] Server:  http://localhost:${port}`);
  console.log(`[forge dev] Entry:   ${entry}`);
  console.log(`[forge dev] Output:  ${outDir}/`);
  console.log('[forge dev] HMR:     enabled');
  console.log('[forge dev] Building...');
  await runBuild();
  console.log('[forge dev] Watching for changes...\n');

  // -------------------------------------------------------------------------
  // HTTP server
  // -------------------------------------------------------------------------

  const server = http.createServer((req, res) => {
    const rawUrl = req.url ?? '/';

    // SSE endpoint — browsers connect here to receive HMR / reload events.
    if (rawUrl === HMR_ENDPOINT) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      // Initial comment keeps the connection alive in some browsers.
      res.write(':\n\n');
      clients.add(res);
      // res.on('close') is more reliable than req.on('close') for detecting
      // client disconnection on a streaming (never-ended) response.
      res.on('close', () => {
        clients.delete(res);
      });
      return;
    }

    // Strip query string (allows cache-busting via ?t=timestamp).
    const urlPath = rawUrl.split('?')[0] ?? '/';

    // Resolve to a file on disk.
    const filePath = resolveFilePath(urlPath, cwd, outDirAbs);

    if (filePath === null) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not found: ${urlPath}`);
      return;
    }

    serveFile(filePath, res, devScriptSrc);
  });

  server.listen(port);

  // -------------------------------------------------------------------------
  // Graceful shutdown
  // -------------------------------------------------------------------------

  process.on('SIGINT', () => {
    console.log('\n[forge dev] Stopping...');
    fsWatcher.close();
    // Close all open SSE connections so server.close() callback fires immediately.
    for (const client of clients) {
      try { client.destroy(); } catch { /* ignore */ }
    }
    clients.clear();
    server.closeAllConnections();
    server.close(() => process.exit(0));
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a URL path to a file on disk.
 *
 * Search order:
 *   1. `<cwd>/<urlPath>`   — public assets, index.html in project root
 *   2. `<outDir>/<urlPath>` — compiled JS / CSS output
 *   3. `<cwd>/index.html`  — SPA fallback for unknown paths
 *
 * Returns null if no file is found anywhere.
 */
function resolveFilePath(
  urlPath: string,
  cwd: string,
  outDirAbs: string,
): string | null {
  const normalized = urlPath === '/' ? '/index.html' : urlPath;

  const fromCwd = path.join(cwd, normalized);
  if (fs.existsSync(fromCwd) && fs.statSync(fromCwd).isFile()) return fromCwd;

  const fromDist = path.join(outDirAbs, normalized);
  if (fs.existsSync(fromDist) && fs.statSync(fromDist).isFile()) return fromDist;

  // SPA fallback — serve index.html so client-side routing works.
  const indexHtml = path.join(cwd, 'index.html');
  if (fs.existsSync(indexHtml)) return indexHtml;

  return null;
}

/**
 * Reads a file from disk and writes it to the HTTP response.
 *
 * For HTML files, two scripts are injected before </body>:
 *   1. The compiled entry module — only when no <script type="module"> is
 *      already present in the file, so users don't need to add the tag
 *      manually; the framework adds it for them.
 *   2. The HMR client — always present in dev mode.
 */
function serveFile(filePath: string, res: http.ServerResponse, entryScript?: string): void {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';

  let body: Buffer;
  try {
    body = fs.readFileSync(filePath);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal server error');
    return;
  }

  // Inject entry script + HMR client into HTML responses.
  if (ext === '.html') {
    let html = body.toString('utf8');

    // Auto-inject the entry module script if the HTML has no module script tag.
    if (entryScript && !/<script\s[^>]*type=["']module["']/i.test(html)) {
      const tag = `<script type="module" src="${entryScript}"></script>`;
      html = html.includes('</body>') ? html.replace('</body>', `${tag}\n</body>`) : html + tag;
    }

    const injected = html.includes('</body>')
      ? html.replace('</body>', `${HMR_CLIENT_SCRIPT}\n</body>`)
      : html + HMR_CLIENT_SCRIPT;
    const injectedBuf = Buffer.from(injected, 'utf8');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': injectedBuf.length,
    });
    res.end(injectedBuf);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': body.length,
  });
  res.end(body);
}
