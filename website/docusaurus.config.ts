import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'HRV Readiness Dashboard',
  tagline: 'Know when to push hard and when to recover — every morning, in under 5 minutes.',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://josedab.github.io',
  baseUrl: '/hrv-dashboard/',

  organizationName: 'josedab',
  projectName: 'hrv-dashboard',

  onBrokenLinks: 'throw',

  markdown: {
    mermaid: true,
    format: 'md',
  },
  themes: ['@docusaurus/theme-mermaid', '@easyops-cn/docusaurus-search-local'],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/josedab/hrv-dashboard/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'HRV Readiness',
      logo: {
        alt: 'HRV Readiness Dashboard Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/josedab/hrv-dashboard',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Getting Started', to: '/docs/getting-started' },
            { label: 'Core Concepts', to: '/docs/core-concepts/hrv-basics' },
            { label: 'API Reference', to: '/docs/api/hrv-engine' },
            { label: 'Architecture', to: '/docs/architecture/overview' },
          ],
        },
        {
          title: 'Guides',
          items: [
            { label: 'Cloud Sync', to: '/docs/guides/cloud-sync' },
            { label: 'Plugins', to: '/docs/guides/plugins' },
            { label: 'Workout Generation', to: '/docs/guides/workout-generation' },
            { label: 'Importing Data', to: '/docs/guides/importing-data' },
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/josedab/hrv-dashboard',
            },
            {
              label: 'Issues',
              href: 'https://github.com/josedab/hrv-dashboard/issues',
            },
            {
              label: 'Why This Project?',
              to: '/docs/comparison',
            },
            {
              label: 'Changelog',
              to: '/docs/changelog',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Contributing',
              to: '/docs/contributing',
            },
            {
              label: 'License (MIT)',
              href: 'https://github.com/josedab/hrv-dashboard/blob/main/LICENSE',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} HRV Readiness Dashboard. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
