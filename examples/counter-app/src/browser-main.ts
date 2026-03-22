import { bootstrapApp } from '@forge/core';
import { createComponent, mountComponent } from '@forge/core/dom';
import { provideRouter } from '@forge/router';
import AppShell from './app-shell.forge';

// ---------------------------------------------------------------------------
// Lazy-loaded page factories
// ---------------------------------------------------------------------------
// Each route uses a dynamic import so the page code is split into its own
// chunk and only downloaded when the user first visits that route.

import { lazy } from '@forge/router';

const HomePage    = lazy(() => import('./pages/home-page.forge'));
const CounterPage = lazy(() => import('./pages/counter-page.forge'));
const AboutPage   = lazy(() => import('./pages/about-page.forge'));

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const app = bootstrapApp([
  ...provideRouter([
    { path: '/',        component: HomePage,    title: 'Home — Forge Demo' },
    { path: '/counter', component: CounterPage, title: 'Counter — Forge Demo' },
    { path: '/about',   component: AboutPage,   title: 'About — Forge Demo' },
    { path: '**',       redirectTo: '/' },
  ]),
]);

const ctx = createComponent(app);

const container = document.getElementById('app');
if (!container) throw new Error('[Forge] No #app element found in the document');

mountComponent(AppShell, container, ctx);
