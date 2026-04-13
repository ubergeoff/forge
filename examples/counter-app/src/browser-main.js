import { bootstrapApp } from '@vorra/core';
import { createComponent, mountComponent } from '@vorra/core/dom';
import { provideRouter } from '@vorra/router';
import AppShell from './app-shell.vorra';
// ---------------------------------------------------------------------------
// Lazy-loaded page factories
// ---------------------------------------------------------------------------
// Each route uses a dynamic import so the page code is split into its own
// chunk and only downloaded when the user first visits that route.
import { lazy } from '@vorra/router';
const HomePage = lazy(() => import('./pages/home-page.vorra'));
const CounterPage = lazy(() => import('./pages/counter-page.vorra'));
const AboutPage = lazy(() => import('./pages/about-page.vorra'));
// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const app = bootstrapApp([
    ...provideRouter([
        { path: '/', component: HomePage, title: 'Home — Vorra Demo' },
        { path: '/counter', component: CounterPage, title: 'Counter — Vorra Demo' },
        { path: '/about', component: AboutPage, title: 'About — Vorra Demo' },
        { path: '**', redirectTo: '/' },
    ]),
]);
const ctx = createComponent(app);
const container = document.getElementById('app');
if (!container)
    throw new Error('[Vorra] No #app element found in the document');
mountComponent(AppShell, container, ctx);
//# sourceMappingURL=browser-main.js.map