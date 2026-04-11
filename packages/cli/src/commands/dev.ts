// =============================================================================
// @forge/cli — forge dev
// Development server: Rolldown watch mode + HTTP static file serving +
// Server-Sent Events (SSE) for component-level HMR.
//
// HMR strategy:
//   - Each .forge file is split into its own output chunk (stable name).
//   - When a .forge file changes, only its chunk is rebuilt and the browser
//     dynamically imports the new chunk (cache-busted with ?t=timestamp).
//   - The new chunk calls window.__forge_hmr.accept(id, factory) which swaps
//     all mounted instances of that component in-place.
//   - Non-.forge changes (services, utils) fall back to a full page reload.
// =============================================================================

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { watch } from 'rolldown';
import type { RolldownPlugin, OutputOptions } from 'rolldown';
import { forgePlugin, generateScopeId } from '@forge/compiler';
import { loadConfig } from '../utils/config.js';

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
 *   which triggers the in-place component swap implemented in @forge/core.
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
    (outDirIdx !== -1 ? args[outDirIdx + 1] : undefined) ?? config.outDir ?? 'dist';

  const entryAbs = path.join(cwd, entry);
  const outDirAbs = path.join(cwd, outDir);
  const userPlugins = (config.plugins ?? []) as RolldownPlugin[];

  // -------------------------------------------------------------------------
  // HMR file-change tracker plugin
  // Collects .forge paths that changed so the BUNDLE_END handler can send
  // targeted HMR updates instead of falling back to a full reload.
  // -------------------------------------------------------------------------

  const changedForgeFiles = new Set<string>();
  const hmrTrackerPlugin: RolldownPlugin = {
    name: 'forge-hmr-tracker',
    watchChange(id: string) {
      if (id.endsWith('.forge')) changedForgeFiles.add(id);
    },
  } as RolldownPlugin;

  const plugins: RolldownPlugin[] = [
    hmrTrackerPlugin,
    forgePlugin({ hmr: true }) as RolldownPlugin,
    ...userPlugins,
  ];

  // Ensure output directory exists before the first build.
  fs.mkdirSync(outDirAbs, { recursive: true });

  // -------------------------------------------------------------------------
  // Rolldown watch mode
  // -------------------------------------------------------------------------

  // Each .forge component gets its own output chunk (stable name so the
  // browser can cache-bust with ?t=timestamp on HMR update).
  // manualChunks is part of Rolldown's Rollup-compatible surface but is not
  // in its native OutputOptions type yet; cast through unknown to suppress.
  const devOutput: OutputOptions = {
    dir: outDirAbs,
    format: 'es',
    sourcemap: true,
    entryFileNames: '[name].js',
    chunkFileNames: '[name].js',
    ...(({
      manualChunks(id: string): string | undefined {
        if (id.endsWith('.forge')) {
          return path.relative(cwd, id).replace(/\\/g, '/').replace('.forge', '');
        }
        if (id.includes(path.join('node_modules', '@forge'))) {
          return 'forge-runtime';
        }
        return undefined;
      },
    }) as unknown as Partial<OutputOptions>),
  };

  // watch() is async — it resolves once the watcher is initialised.
  const watcher = await watch({
    input: entryAbs,
    plugins,
    // __forge_dev is a compile-time constant read by @forge/core/dom.ts to
    // set up the HMR runtime on window.__forge_hmr at startup.
    define: { __forge_dev: 'true' },
    output: devOutput,
  });

  // Track connected SSE clients for live reload / HMR.
  const clients = new Set<http.ServerResponse>();

  /** Broadcasts an SSE event to all connected browser clients. */
  function broadcast(event: string, data: string): void {
    for (const client of clients) {
      client.write(`event: ${event}\ndata: ${data}\n\n`);
    }
  }

  watcher.on('event', (ev) => {
    if (ev.code === 'BUNDLE_END') {
      if (changedForgeFiles.size > 0) {
        // Build per-component HMR update payloads.
        const updates = Array.from(changedForgeFiles).map((filePath) => {
          const id = generateScopeId(filePath);
          const rel = path.relative(cwd, filePath).replace(/\\/g, '/').replace('.forge', '');
          // The URL the browser will request; the static server resolves it
          // from outDirAbs (see resolveFilePath).
          const url = `/${path.join(outDir, rel).replace(/\\/g, '/')}.js`;
          return { id, url };
        });
        changedForgeFiles.clear();

        console.log(`[forge hmr] Hot-updating ${updates.length} component(s)...`);
        broadcast('hmr-update', JSON.stringify({ updates }));
      } else {
        // A non-.forge file changed (service, utility, etc.) — full reload.
        console.log('[forge dev] Rebuilt — notifying clients...');
        broadcast('reload', '{}');
      }
    }
    if (ev.code === 'ERROR') {
      console.error('[Forge CLI] Build error — check the terminal above for details.');
    }
  });

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
      req.on('close', () => {
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

    serveFile(filePath, res);
  });

  server.listen(port, () => {
    console.log(`[forge dev] Server:  http://localhost:${port}`);
    console.log(`[forge dev] Entry:   ${entry}`);
    console.log(`[forge dev] Output:  ${outDir}/`);
    console.log('[forge dev] HMR:     enabled');
    console.log('[forge dev] Watching for changes...\n');
  });

  // -------------------------------------------------------------------------
  // Graceful shutdown
  // -------------------------------------------------------------------------

  process.on('SIGINT', () => {
    console.log('\n[forge dev] Stopping...');
    void watcher.close().then(() => {
      server.close(() => process.exit(0));
    });
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

/** Reads a file from disk and writes it to the HTTP response. */
function serveFile(filePath: string, res: http.ServerResponse): void {
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

  // Inject HMR client script into HTML responses.
  if (ext === '.html') {
    const html = body.toString('utf8');
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
