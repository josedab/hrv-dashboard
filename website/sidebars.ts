import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

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
        'core-concepts/advanced-metrics',
        'core-concepts/privacy-and-encryption',
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
        'guides/cloud-sync',
        'guides/importing-data',
        'guides/coach-sharing',
        'guides/camera-ppg',
        'guides/workout-generation',
        'guides/plugins',
        'guides/health-integrations',
        'guides/morning-protocol',
        'guides/multi-athlete-profiles',
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
        'api/sync-and-crypto',
        'api/plugins',
        'api/integrations',
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
        'architecture/security',
      ],
    },
    'troubleshooting',
    'comparison',
    'changelog',
    'contributing',
  ],
};

export default sidebars;
