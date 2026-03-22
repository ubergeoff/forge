// =============================================================================
// @forge/cli — forge dev
// Development server: Rolldown watch mode + HTTP static file serving +
// Server-Sent Events (SSE) for live reload.
//
// On every successful rebuild the server sends a 'reload' SSE event to all
// connected browser clients, which triggers a full-page reload.
// True module-level HMR is planned for a future step.
// =============================================================================

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { watch } from 'rolldown';
import type { RolldownPlugin } from 'rolldown';
import { forgePlugin } from '@forge/compiler';
import { loadConfig } from '../utils/config.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HMR_ENDPOINT = '/__forge_hmr';

/** Injected before </body> in every HTML response. */
const HMR_CLIENT_SCRIPT = `<script>
(function () {
  var es = new EventSource('${HMR_ENDPOINT}');
  es.addEventListener('reload', function () {
    console.log('[forge hmr] reloading...');
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
  const plugins: RolldownPlugin[] = [
    forgePlugin() as RolldownPlugin,
    ...userPlugins,
  ];

  // Ensure output directory exists before the first build.
  fs.mkdirSync(outDirAbs, { recursive: true });

  // -------------------------------------------------------------------------
  // Rolldown watch mode
  // -------------------------------------------------------------------------

  // watch() is async — it resolves once the watcher is initialised.
  const watcher = await watch({
    input: entryAbs,
    plugins,
    output: {
      dir: outDirAbs,
      format: 'es',
      sourcemap: true,
      entryFileNames: '[name].js',
      chunkFileNames: '[name]-[hash].js',
    },
  });

  // Track connected SSE clients for live reload.
  const clients = new Set<http.ServerResponse>();

  watcher.on('event', (ev) => {
    if (ev.code === 'BUNDLE_END') {
      console.log('[forge dev] Rebuilt — notifying clients...');
      for (const client of clients) {
        client.write('event: reload\ndata: {}\n\n');
      }
    }
    if (ev.code === 'ERROR') {
      // RollupWatcherEvent for ERROR doesn't expose the error field in rolldown's
      // current type definitions; log what we can.
      console.error('[Forge CLI] Build error — check the terminal above for details.');
    }
  });

  // -------------------------------------------------------------------------
  // HTTP server
  // -------------------------------------------------------------------------

  const server = http.createServer((req, res) => {
    const rawUrl = req.url ?? '/';

    // SSE endpoint — browsers connect here to receive live-reload events.
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

    // Strip query string.
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
