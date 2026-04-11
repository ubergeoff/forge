import 'forge:css';
import { bootstrapApp } from '@forge/core';
import { mountComponent, createComponent } from '@forge/core/dom';
import App from './App.forge';

const ctx = createComponent(bootstrapApp([]));
const container = document.getElementById('app');
if (!container) throw new Error('[Forge] No #app element found');
mountComponent(App, container, ctx);
