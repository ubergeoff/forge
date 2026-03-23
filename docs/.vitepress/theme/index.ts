import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import ForgePlayground from './components/ForgePlayground.vue'
import './styles/custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ForgePlayground', ForgePlayground)
  },
} satisfies Theme
