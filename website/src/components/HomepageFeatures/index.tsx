import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  emoji: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: '100% Local & Private',
    emoji: '🔒',
    description: (
      <>
        All data stays on your device in SQLite. No cloud, no accounts,
        no network dependency. Your health data is yours alone.
      </>
    ),
  },
  {
    title: 'Science-Based HRV',
    emoji: '🧬',
    description: (
      <>
        Computes rMSSD, SDNN, pNN50, and mean HR with artifact detection.
        Rolling 7-day median baseline per ESC guidelines.
      </>
    ),
  },
  {
    title: 'Works With Any BLE Monitor',
    emoji: '📡',
    description: (
      <>
        Uses the standard Bluetooth Heart Rate Service (0x180D).
        Polar H10, Garmin HRM-Pro, Wahoo TICKR — any HR strap works.
      </>
    ),
  },
  {
    title: 'Actionable Verdicts',
    emoji: '🚦',
    description: (
      <>
        Three clear outcomes every morning: <strong>🟢 Go Hard</strong>,{' '}
        <strong>🟡 Moderate</strong>, or <strong>🔴 Rest</strong>.
        No guesswork needed.
      </>
    ),
  },
  {
    title: 'Cross-Platform',
    emoji: '📱',
    description: (
      <>
        React Native with Expo — one codebase for iOS and Android.
        Dark theme UI designed for morning use.
      </>
    ),
  },
  {
    title: 'Export & Own Your Data',
    emoji: '📊',
    description: (
      <>
        Export sessions to CSV anytime. Full metrics, subjective logs,
        and RR interval counts for external analysis.
      </>
    ),
  },
];

function Feature({title, emoji, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md" style={{marginBottom: '2rem'}}>
        <div style={{fontSize: '2.5rem', marginBottom: '0.5rem'}}>{emoji}</div>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
