import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import VorraPlayground from './components/VorraPlayground.vue'
import './styles/custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('VorraPlayground', VorraPlayground)
  },
} satisfies Theme
