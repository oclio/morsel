import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitepress';

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('../../src', import.meta.url)),
      },
    },
  },
  title: 'morsel',
  description:
    'The only zero-dep config loader that does discovery, hierarchical merge, live-reload, and plugins.',

  // URL de base — domaine custom morsel.oclka.dev
  base: '/',

  // Nettoyage des URLs (.md → /path/)
  cleanUrls: true,

  // Ignorer les dead links générés par TypeDoc (./../README → index.md)
  ignoreDeadLinks: true,

  // Favicon
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/morsel-logo.svg' }],
  ],

  // Logo dans la navbar
  themeConfig: {
    logo: '/morsel-logo.svg',

    // Navigation principale (top bar)
    nav: [
      { text: 'Guide', link: '/getting-started/' },
      { text: 'Plugins', link: '/plugins/' },
      { text: 'API', link: '/api/' },
      { text: 'Reference', link: '/reference/SPEC' },
    ],

    // Sidebar — guide DX complet sur toutes les pages, reference séparée
    sidebar: {
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Specification', link: '/reference/SPEC' },
            {
              text: 'Architecture & Design',
              link: '/reference/DESIGN',
            },
          ],
        },
      ],
      '/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Quick Start', link: '/getting-started/' },
            {
              text: 'Resolution Cascade',
              link: '/getting-started/resolution-cascade',
            },
            {
              text: 'TypeScript & Inference',
              link: '/getting-started/typescript',
            },
          ],
        },
        {
          text: 'Configuration',
          items: [
            {
              text: 'Environments ($env)',
              link: '/configuration/environments',
            },
            {
              text: 'Inheritance (extends)',
              link: '/configuration/inheritance',
            },
            {
              text: 'Composition & Presets',
              link: '/configuration/composition',
            },
            { text: 'Bootstrapping', link: '/configuration/bootstrapping' },
          ],
        },
        {
          text: 'Reactivity',
          items: [
            { text: 'Live-Reload & Watch', link: '/reactivity/live-reload' },
            { text: 'Key-Level Events', link: '/reactivity/key-events' },
            {
              text: 'Immutability & Proxy',
              link: '/reactivity/immutability-memory',
            },
          ],
        },
        {
          text: 'Extensibility',
          items: [
            {
              text: 'Lifecycle Hooks',
              link: '/extensibility/lifecycle-hooks',
            },
            { text: 'Validation', link: '/extensibility/validation' },
            {
              text: 'Authoring Plugins',
              link: '/extensibility/authoring-plugins',
            },
          ],
        },
        {
          text: 'Advanced',
          items: [
            {
              text: 'Debug & Resilience',
              link: '/advanced/debug-resilience',
            },
            {
              text: 'Standalone Utilities',
              link: '/advanced/standalone-utilities',
            },
          ],
        },
        {
          text: 'Recipes',
          items: [
            { text: 'Production Patterns', link: '/recipes/monorepo' },
            { text: 'Migration Guide', link: '/recipes/migration' },
          ],
        },
        {
          text: 'API',
          items: [
            { text: 'Overview', link: '/api/' },
            {
              text: 'Functions',
              items: [
                { text: 'loadConfig', link: '/api/functions/loadConfig' },
                {
                  text: 'loadConfigSync',
                  link: '/api/functions/loadConfigSync',
                },
                { text: 'watchConfig', link: '/api/functions/watchConfig' },
                { text: 'defineConfig', link: '/api/functions/defineConfig' },
                { text: 'mergeConfig', link: '/api/functions/mergeConfig' },
                { text: 'resolvePaths', link: '/api/functions/resolvePaths' },
                { text: 'initConfig', link: '/api/functions/initConfig' },
                { text: 'deepMerge', link: '/api/functions/deepMerge' },
                { text: 'diffKeys', link: '/api/functions/diffKeys' },
                { text: 'flatten', link: '/api/functions/flatten' },
                {
                  text: 'getRegistry',
                  link: '/api/functions/getRegistry',
                },
                {
                  text: 'clearRegistry',
                  link: '/api/functions/clearRegistry',
                },
              ],
            },
            {
              text: 'Classes',
              items: [
                {
                  text: 'MorselError',
                  link: '/api/classes/MorselError',
                },
                {
                  text: 'MorselNoPluginError',
                  link: '/api/classes/MorselNoPluginError',
                },
                {
                  text: 'MorselValidationError',
                  link: '/api/classes/MorselValidationError',
                },
              ],
            },
            {
              text: 'Interfaces',
              items: [
                {
                  text: 'MorselOptions',
                  link: '/api/interfaces/MorselOptions',
                },
                {
                  text: 'MorselStore',
                  link: '/api/interfaces/MorselStore',
                },
                { text: 'MorselLayer', link: '/api/interfaces/MorselLayer' },
                {
                  text: 'ConfigResult',
                  link: '/api/interfaces/ConfigResult',
                },
                {
                  text: 'MorselFormatPlugin',
                  link: '/api/interfaces/MorselFormatPlugin',
                },
                {
                  text: 'MorselValidationPlugin',
                  link: '/api/interfaces/MorselValidationPlugin',
                },
                { text: 'MorselHook', link: '/api/interfaces/MorselHook' },
                {
                  text: 'MorselWatchableHook',
                  link: '/api/interfaces/MorselWatchableHook',
                },
                {
                  text: 'HookContext',
                  link: '/api/interfaces/HookContext',
                },
                { text: 'KeyChange', link: '/api/interfaces/KeyChange' },
              ],
            },
          ],
        },
      ],
    },

    // Recherche locale (flexsearch, zéro backend)
    search: {
      provider: 'local',
    },

    // Footer global — UNE SEULE FOIS dans la config
    footer: {
      message:
        'Released under the <a href="https://github.com/oclio/morsel/blob/main/LICENSE">MIT License</a> · <a href="https://github.com/sponsors/oclio">GitHub Sponsors</a> · <a href="https://buymeacoffee.com/oclio">Buy Me a Coffee</a>',
      copyright:
        'Copyright © 2026 <a href="https://oclka.dev">@oclio</a> — TypeScript Engineer · Lean, pragmatic, test-driven',
    },

    // Liens sociaux
    socialLinks: [{ icon: 'github', link: 'https://github.com/oclio/morsel' }],

    // Edit this page link
    editLink: {
      pattern: 'https://github.com/oclio/morsel/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
});
