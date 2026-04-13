import 'vorra:css';
import { bootstrapApp } from '@vorra/core';
import { mountComponent, createComponent } from '@vorra/core/dom';
import { provideRouter } from '@vorra/router';
import App from './App.vorra';
import HomePage from './pages/HomePage.vorra';
import ForPage from './pages/ForPage.vorra';

const app = bootstrapApp([
  ...provideRouter([
    { path: '/',    component: HomePage, title: 'Home — Vorra Hello World' },
    { path: '/for', component: ForPage,  title: '@for Demo — Vorra Hello World' },
    { path: '**',   redirectTo: '/' },
  ]),
]);

const ctx = createComponent(app);
const container = document.getElementById('app');
if (!container) throw new Error('[Vorra] No #app element found');
mountComponent(App, container, ctx);
