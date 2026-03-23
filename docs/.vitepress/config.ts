import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Forge',
  description: 'A compiled, signal-first JavaScript framework for enterprise applications.',
  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#6366f1' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'API', link: '/api/core', activeMatch: '/api/' },
      { text: 'Playground', link: '/playground/' },
      {
        text: 'v0.1.0',
        items: [
          { text: 'Changelog', link: 'https://github.com/your-org/forge/blob/main/CHANGELOG.md' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Your First Component', link: '/guide/your-first-component' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Reactivity', link: '/guide/reactivity' },
            { text: 'Components & SFCs', link: '/guide/components' },
            { text: 'Template Syntax', link: '/guide/templates' },
            { text: 'Dependency Injection', link: '/guide/dependency-injection' },
          ],
        },
        {
          text: 'Packages',
          items: [
            { text: 'Router', link: '/guide/router' },
            { text: 'Forms', link: '/guide/forms' },
            { text: 'CLI', link: '/guide/cli' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: '@forge/core', link: '/api/core' },
            { text: '@forge/compiler', link: '/api/compiler' },
            { text: '@forge/router', link: '/api/router' },
            { text: '@forge/forms', link: '/api/forms' },
            { text: '@forge/cli', link: '/api/cli' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/your-org/forge' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Forge Contributors',
    },

    search: {
      provider: 'local',
    },
  },

})
