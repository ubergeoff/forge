// =============================================================================
// @forge/router — Public API
// =============================================================================

// Router service + DI tokens
export { Router, ROUTER, ROUTES, provideRouter } from './router.js';

// RouterOutlet
export { createRouterOutlet } from './outlet.js';

// RouterLink
export { createRouterLink } from './link.js';

// Component factories for use in .forge templates
export { RouterLink, RouterOutlet } from './components.js';

// Lazy loading helper
export { lazy, isLazyComponent } from './types.js';

// Types
export type {
  RouteConfig,
  ResolvedRoute,
  NavigationExtras,
  ComponentFactory,
  LazyComponentLoader,
  RouteComponent,
} from './types.js';
