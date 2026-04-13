// =============================================================================
// @forge/router — route matcher
// Path pattern → params extraction, first-match wins.
// =============================================================================

import type { RouteConfig } from './types.js';

export interface MatchResult {
  config: RouteConfig;
  params: Record<string, string>;
}

/**
 * Walks `routes` in order and returns the first match for `pathname`.
 * Returns `null` when no route matches.
 *
 * Supported patterns:
 *   - Exact segments: `/about`
 *   - Named params:   `/users/:id`
 *   - Wildcard tail:  `**`  (matches any path)
 */
export function matchRoute(
  routes: RouteConfig[],
  pathname: string
): MatchResult | null {
  for (const config of routes) {
    const params = matchPath(config.path, pathname);
    if (params !== null) {
      return { config, params };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function segmentize(path: string): string[] {
  return path.split('/').filter(s => s.length > 0);
}

function matchPath(
  pattern: string,
  pathname: string
): Record<string, string> | null {
  // Global wildcard — matches any path
  if (pattern === '**') {
    return {};
  }

  const patternSegs = segmentize(pattern);
  const pathSegs = segmentize(pathname);

  // Check for a trailing `**` wildcard segment
  const lastPat = patternSegs[patternSegs.length - 1];
  const hasWildcardTail = lastPat === '**';
  const compareLen = hasWildcardTail ? patternSegs.length - 1 : patternSegs.length;

  // Segment count must match (unless there is a wildcard tail)
  if (hasWildcardTail && pathSegs.length < compareLen) return null;
  if (!hasWildcardTail && pathSegs.length !== compareLen) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < compareLen; i++) {
    const pat = patternSegs[i]!;
    const seg = pathSegs[i]!;

    if (pat.startsWith(':')) {
      params[pat.slice(1)] = decodeURIComponent(seg);
    } else if (pat !== seg) {
      return null;
    }
  }

  return params;
}
