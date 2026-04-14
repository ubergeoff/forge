// =============================================================================
// @vorra/cli — vorra dev
// Development server: Rolldown DevEngine (watch + incremental build) +
// Server-Sent Events (SSE) for component-level HMR.
//
// We use Rolldown's experimental DevEngine instead of a manual fs.watch +
// build() loop. DevEngine runs Rolldown's own Rust file-watcher internally,
// which correctly excludes the output directory and avoids the
// infinite-rebuild bug that affected the old fs.watch approach on Windows.
//
// HMR strategy:
//   - Each .vorra file is split into its own output chunk (stable name).
//   - DevEngine calls onHmrUpdates with changedFiles after every change.
//   - If ONLY .vorra files changed, an 'hmr-update' SSE event is sent so the
//     browser can hot-swap individual components without a full page reload.
//   - If any non-.vorra source file also changed, a full 'reload' is sent
//     (e.g. a service dependency changed — the whole app must restart).
// =============================================================================

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { dev } from 'rolldown/experimental';
import type { RolldownPlugin, OutputOptions } from 'rolldown';
import { vorraPlugin, generateScopeId } from '@vorra/compiler';
import { loadConfig } from '../utils/config.js';
import { vorraDedupePlugin } from '../utils/vorra-dedupe-plugin.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HMR_ENDPOINT = '/__vorra_hmr';

/**
 * Injected before </body> in every HTML response.
 *
 * Sets up window.__vorra_hmr with an instance registry, then opens an SSE
 * connection to receive either component-level HMR updates or full reloads.
 *
 * 'hmr-update' — one or more .vorra chunks changed; each is re-imported with
 *   a cache-busting timestamp. The new chunk calls window.__vorra_hmr.accept()
 *   which triggers the in-place component swap implemented in @vorra/core.
 *
 * 'reload' — a non-component file changed; fall back to a full page reload.
 */
const HMR_CLIENT_SCRIPT = `<script type="module">
(function () {
  if (!window.__vorra_hmr) window.__vorra_hmr = {};
  var hmr = window.__vorra_hmr;
  if (!hmr.instances) hmr.instances = new Map();

  var es = new EventSource('${HMR_ENDPOINT}');

  es.addEventListener('hmr-update', function (e) {
    var data = JSON.parse(e.data);
    data.updates.forEach(function (update) {
      console.log('[vorra hmr] updating component ' + update.id);
      import(update.url + '?t=' + Date.now()).catch(function (err) {
        console.error('[vorra hmr] failed to load update, falling back to reload', err);
        location.reload();
      });
    });
  });

  es.addEventListener('reload', function () {
    console.log('[vorra hmr] full reload');
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
 * Starts the vorra development server.
 *
 * CLI flags (override vorra.config.js):
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
    (outDirIdx !== -1 ? args[outDirIdx + 1] : undefined) ?? config.devOutDir ?? '.vorra';

  const entryAbs = path.join(cwd, entry);
  const outDirAbs = path.join(cwd, outDir);

  const userPlugins = (config.plugins ?? []) as RolldownPlugin[];
  // Replace the __vorra_dev compile-time constant with `true` so the HMR
  // runtime block in @vorra/core/dom.ts is included (and dead code in
  // production builds is tree-shaken when the constant is `false`).
  // Rolldown's programmatic build() API does not accept a top-level `define`
  // option, so we use a minimal transform plugin instead.
  const devDefinePlugin: RolldownPlugin = {
    name: 'vorra-dev-define',
    transform(code: string) {
      if (!code.includes('__vorra_dev')) return null;
      // Strip TypeScript `declare const __vorra_dev` ambient declarations so that
      // Rolldown resolving workspace packages to their TypeScript source (via root
      // tsconfig `paths`) doesn't produce invalid syntax like `declare const true`.
      let result = code.replace(/declare\s+const\s+__vorra_dev\b[^\n]*\n?/g, '');
      result = result.replaceAll('__vorra_dev', 'true');
      return { code: result };
    },
  };
  const plugins: RolldownPlugin[] = [
    vorraDedupePlugin,
    vorraPlugin({
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
  // Rolldown DevEngine output configuration
  // -------------------------------------------------------------------------

  // Each .vorra component gets its own output chunk (stable name so the
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
        // Each .vorra component becomes its own chunk so only the changed
        // component needs to be re-fetched on HMR update.
        if (id.endsWith('.vorra')) {
          return path.relative(cwd, id).replace(/\\/g, '/').replace('.vorra', '');
        }
        // Bundle all @vorra/* runtime into a single stable shared chunk.
        if (id.includes(path.join('node_modules', '@vorra'))) {
          return 'vorra-runtime';
        }
        return undefined;
      },
    }) as unknown as Partial<OutputOptions>),
  };

  // -------------------------------------------------------------------------
  // Rolldown DevEngine — watches sources, rebuilds, computes HMR boundaries
  // -------------------------------------------------------------------------
  //
  // rebuildStrategy: 'always' — every file change triggers a full incremental
  // rebuild so that output files on disk stay current and onOutput fires
  // reliably. We use onHmrUpdates.changedFiles (populated regardless of any
  // registered browser clients) to decide between HMR and full reload.

  /** Absolute source paths that changed since the last completed rebuild. */
  let pendingChangedFiles: string[] = [];
  /** Resolved when the first onOutput fires (initial build complete). */
  let resolveInitialBuild!: () => void;
  const initialBuildDone = new Promise<void>((resolve) => {
    resolveInitialBuild = resolve;
  });
  let isInitialBuild = true;

  const engine = await dev(
    { input: entryAbs, plugins },
    devOutput,
    {
      // Always trigger a rebuild after HMR updates so that output files are
      // written to disk and onOutput fires — we rely on onOutput to broadcast.
      rebuildStrategy: 'always',
      watch: {
        skipWrite: false,
        useDebounce: true,
        debounceDuration: 80,
      },

      onHmrUpdates(result) {
        if (result instanceof Error) {
          console.error('[vorra dev] HMR error:', result.message);
          return;
        }
        // Accumulate changed source files; onOutput drains this list once the
        // rebuild triggered by rebuildStrategy:'always' completes.
        pendingChangedFiles.push(...result.changedFiles);
      },

      onOutput(result) {
        if (isInitialBuild) {
          // Signal that the initial build is done so the HTTP server can start.
          isInitialBuild = false;
          resolveInitialBuild();
          if (result instanceof Error) {
            console.error('[vorra dev] Initial build failed — check errors above.');
          }
          return;
        }

        if (result instanceof Error) {
          console.error('[vorra dev] Build error — check the terminal above for details.');
          pendingChangedFiles = [];
          return;
        }

        // Drain the change list accumulated by onHmrUpdates.
        const changedFiles = pendingChangedFiles;
        pendingChangedFiles = [];

        const vorraChanges = changedFiles.filter((f) => f.endsWith('.vorra'));
        const hasNonVorra = changedFiles.some((f) => !f.endsWith('.vorra'));

        if (vorraChanges.length > 0 && !hasNonVorra) {
          // Only .vorra components changed — perform component-level HMR.
          const updates = vorraChanges.map((filePath) => {
            const id = generateScopeId(filePath);
            const rel = path.relative(cwd, filePath).replace(/\\/g, '/').replace('.vorra', '');
            // URL the browser will request; resolved from outDirAbs by the static server.
            const url = `/${path.join(outDir, rel).replace(/\\/g, '/')}.js`;
            return { id, url };
          });
          console.log(`[vorra hmr] Hot-updating ${updates.length} component(s)...`);
          broadcast('hmr-update', JSON.stringify({ updates }));
        } else {
          // Non-.vorra source changed (service, utility, config, etc.) — full reload.
          console.log('[vorra dev] Rebuilt — notifying clients...');
          broadcast('reload', '{}');
        }
      },
    },
  );

  // Derive the entry script URL so we can auto-inject it into HTML responses
  // when the user's index.html has no <script type="module"> tag.
  const entryName = path.basename(entry, path.extname(entry));
  const devScriptSrc = `/${outDir}/${entryName}.js`;

  // Start the engine (triggers initial build + begins watching).
  // We do not await run() itself — it resolves once the watcher is started,
  // not when the initial build completes. Instead we await initialBuildDone
  // which resolves inside onOutput after the first successful output.
  console.log(`[vorra dev] Server:  http://localhost:${port}`);
  console.log(`[vorra dev] Entry:   ${entry}`);
  console.log(`[vorra dev] Output:  ${outDir}/`);
  console.log('[vorra dev] HMR:     enabled');
  console.log('[vorra dev] Building...');
  void engine.run();
  await initialBuildDone;
  console.log('[vorra dev] Watching for changes...\n');

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
    console.log('\n[vorra dev] Stopping...');
    void engine.close();
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
