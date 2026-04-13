import 'forge:css';
import { bootstrapApp } from '@vorra/core';
import { mountComponent, createComponent } from '@vorra/core/dom';
import { provideRouter } from '@vorra/router';
import App from './App.forge';
import HomePage from './pages/HomePage.forge';
import ForPage from './pages/ForPage.forge';

const app = bootstrapApp([
  ...provideRouter([
    { path: '/',    component: HomePage, title: 'Home — Forge Hello World' },
    { path: '/for', component: ForPage,  title: '@for Demo — Forge Hello World' },
    { path: '**',   redirectTo: '/' },
  ]),
]);

const ctx = createComponent(app);
const container = document.getElementById('app');
if (!container) throw new Error('[Forge] No #app element found');
mountComponent(App, container, ctx);
