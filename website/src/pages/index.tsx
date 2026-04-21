import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <div className={styles.heroLogo}>❤️‍🩹</div>
        <Heading as="h1" className={styles.heroTitle}>
          {siteConfig.title}
        </Heading>
        <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
        <div className={styles.badges}>
          <a href="https://github.com/josedab/hrv-dashboard/actions/workflows/ci.yml">
            <img
              src="https://github.com/josedab/hrv-dashboard/actions/workflows/ci.yml/badge.svg"
              alt="CI"
            />
          </a>{' '}
          <img src="https://img.shields.io/badge/tests-1042%20passing-brightgreen" alt="Tests" />{' '}
          <img src="https://img.shields.io/badge/coverage-85%25-brightgreen" alt="Coverage" />{' '}
          <img
            src="https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript"
            alt="TypeScript"
          />{' '}
          <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" />
        </div>
        <div className={styles.heroCode}>
          <code>
            git clone https://github.com/josedab/hrv-dashboard.git &amp;&amp; npm install &amp;&amp;
            npm start
          </code>
        </div>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/getting-started">
            Get Started →
          </Link>
          <Link
            className="button button--outline button--lg"
            to="https://github.com/josedab/hrv-dashboard"
          >
            GitHub ⭐
          </Link>
          <Link className="button button--outline button--lg" to="/docs/comparison">
            Why This Project?
          </Link>
        </div>
      </div>
    </header>
  );
}

function HowItWorks() {
  return (
    <section className={styles.howItWorks}>
      <div className="container">
        <Heading as="h2" className="text--center margin-bottom--lg">
          How It Works
        </Heading>
        <div className="row">
          {[
            {
              step: '1',
              icon: '📱',
              title: 'Strap On',
              desc: 'Put on your Polar H10 or any BLE heart rate monitor.',
            },
            {
              step: '2',
              icon: '⏱️',
              title: 'Record',
              desc: '5-minute recording captures RR intervals via Bluetooth.',
            },
            {
              step: '3',
              icon: '🧮',
              title: 'Analyze',
              desc: 'HRV metrics computed on-device: rMSSD, SDNN, pNN50.',
            },
            {
              step: '4',
              icon: '✅',
              title: 'Decide',
              desc: 'Get a clear verdict: Go Hard, Moderate, or Rest.',
            },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} className="col col--3">
              <div className="text--center">
                <div className={styles.stepIcon}>{icon}</div>
                <Heading as="h3">{title}</Heading>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchitecturePreview() {
  return (
    <section className={styles.architectureSection}>
      <div className="container">
        <Heading as="h2" className="text--center margin-bottom--lg">
          Built for Privacy &amp; Performance
        </Heading>
        <div className="row">
          <div className="col col--6">
            <div className={styles.archCard}>
              <Heading as="h3">🔐 End-to-End Encrypted</Heading>
              <p>
                All sync, backup, and share operations use AES-256-GCM with scrypt KDF. The server
                never sees your plaintext health data.
              </p>
            </div>
            <div className={styles.archCard}>
              <Heading as="h3">🧩 Extensible Plugins</Heading>
              <p>
                Compute custom metrics with sandboxed JavaScript plugins. 5 built-in reference
                plugins: Poincaré, DFA-α1, FFT LF/HF, and more.
              </p>
            </div>
          </div>
          <div className="col col--6">
            <div className={styles.archCard}>
              <Heading as="h3">📊 Advanced Analytics</Heading>
              <p>
                Spectral analysis (LF/HF/VLF), Training Stress Balance (ATL/CTL/TSB), recovery
                scoring, next-day prediction, and population norms.
              </p>
            </div>
            <div className={styles.archCard}>
              <Heading as="h3">🏋️ Workout Integration</Heading>
              <p>
                Verdict-based workout prescriptions exported to Strava, TrainingPeaks, and
                Intervals.icu. Import data from Whoop, Oura, or Garmin.
              </p>
            </div>
          </div>
        </div>
        <div className="text--center margin-top--lg">
          <Link className="button button--secondary button--lg" to="/docs/architecture/overview">
            View Architecture →
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="HRV Morning Readiness Dashboard"
      description="React Native app for morning HRV readiness assessment. Connect a BLE heart rate monitor, compute HRV metrics, and get an actionable training verdict."
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <HowItWorks />
        <ArchitecturePreview />
      </main>
    </Layout>
  );
}
