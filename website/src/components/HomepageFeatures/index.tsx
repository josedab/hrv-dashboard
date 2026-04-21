import type { ReactNode } from 'react';
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
        All data stays on your device in SQLite. Optional E2E encrypted sync uses AES-256-GCM +
        scrypt — the server never sees your data.
      </>
    ),
  },
  {
    title: 'Science-Based HRV',
    emoji: '🧬',
    description: (
      <>
        rMSSD, SDNN, pNN50, mean HR, plus frequency-domain spectral analysis (LF/HF/VLF). Rolling
        median baseline per ESC guidelines.
      </>
    ),
  },
  {
    title: 'Works With Any BLE Monitor',
    emoji: '📡',
    description: (
      <>
        Standard Bluetooth Heart Rate Service (0x180D). Polar H10, Garmin HRM-Pro, Wahoo TICKR — or
        use camera PPG as a fallback.
      </>
    ),
  },
  {
    title: 'Actionable Verdicts',
    emoji: '🚦',
    description: (
      <>
        Three clear outcomes: <strong>🟢 Go Hard</strong>, <strong>🟡 Moderate</strong>, or{' '}
        <strong>🔴 Rest</strong>. Fixed or adaptive thresholds with AI coach narrative.
      </>
    ),
  },
  {
    title: 'Workout & Platform Export',
    emoji: '🏋️',
    description: (
      <>
        Verdict-based workout prescriptions exported to Strava, TrainingPeaks, and Intervals.icu.
        Import from Whoop, Oura, Garmin.
      </>
    ),
  },
  {
    title: 'Extensible Plugin System',
    emoji: '🧩',
    description: (
      <>
        Sandboxed custom metric plugins: Poincaré, DFA-α1, FFT LF/HF, Recovery Velocity, Weekly
        Z-Score — or write your own.
      </>
    ),
  },
];

function Feature({ title, emoji, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md" style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{emoji}</div>
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
