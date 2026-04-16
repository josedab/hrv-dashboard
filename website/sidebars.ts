import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: 'Core Concepts',
      collapsed: false,
      items: [
        'core-concepts/hrv-basics',
        'core-concepts/recording-flow',
        'core-concepts/verdicts-and-baseline',
        'core-concepts/artifact-detection',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/daily-routine',
        'guides/understanding-your-data',
        'guides/exporting-data',
        'guides/settings-and-customization',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/hrv-engine',
        'api/ble-layer',
        'api/database',
        'api/utilities',
        'api/types',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/data-flow',
        'architecture/database-schema',
        'architecture/design-decisions',
      ],
    },
    'troubleshooting',
    'contributing',
  ],
};

export default sidebars;
