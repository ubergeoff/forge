// =============================================================================
// @forge/router — shared types
// =============================================================================

import type { ComponentContext } from '@forge/core';

// ---------------------------------------------------------------------------
// Component factory types
// ---------------------------------------------------------------------------

/** A synchronous compiled component factory — matches the DOM runtime's contract. */
export type ComponentFactory = (
  ctx: ComponentContext,
  props?: Record<string, () => unknown>
) => Node;

/** A lazy component loader — returns a Promise<{ default: ComponentFactory }>. */
export interface LazyComponentLoader {
  (): Promise<{ default: ComponentFactory }>;
  readonly __lazy: true;
}

/** Either a synchronous factory or a lazy loader. */
export type RouteComponent = ComponentFactory | LazyComponentLoader;

/**
 * Wraps an async import as a lazy route component.
 *
 * @example
 * { path: '/dashboard', component: lazy(() => import('./Dashboard.js')) }
 */
export function lazy(
  loader: () => Promise<{ default: ComponentFactory }>
): LazyComponentLoader {
  Object.defineProperty(loader, '__lazy', { value: true, writable: false });
  return loader as LazyComponentLoader;
}

/** Returns true when `c` is a lazy component loader rather than an eager factory. */
export function isLazyComponent(c: RouteComponent): c is LazyComponentLoader {
  return (c as { readonly __lazy?: boolean }).__lazy === true;
}

// ---------------------------------------------------------------------------
// Route configuration
// ---------------------------------------------------------------------------

export interface RouteConfig {
  /** Path pattern — supports named params (`:id`) and wildcard (`**`). */
  path: string;
  /** Component to mount when this route is active. */
  component?: RouteComponent;
  /** Nested child routes. */
  children?: RouteConfig[];
  /** Redirect to another path when this route matches. */
  redirectTo?: string;
  /** Sets `document.title` when this route is active. */
  title?: string;
  /** Arbitrary static data attached to the route — available on `ResolvedRoute`. */
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Resolved route (runtime state)
// ---------------------------------------------------------------------------

export interface ResolvedRoute {
  /** Full URL string (pathname + query string) that was navigated to. */
  url: string;
  /** Named path params extracted from the URL — e.g. `{ id: '42' }`. */
  params: Record<string, string>;
  /** Parsed query string — e.g. `{ q: 'forge' }`. */
  query: Record<string, string>;
  /** The matched `RouteConfig` entry. */
  config: RouteConfig;
}

// ---------------------------------------------------------------------------
// Navigation options
// ---------------------------------------------------------------------------

export interface NavigationExtras {
  /** When true, replaces the current history entry instead of pushing a new one. */
  replaceUrl?: boolean;
}
