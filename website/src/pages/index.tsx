import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <div className={styles.heroLogo}>❤️‍🩹</div>
        <Heading as="h1" className={styles.heroTitle}>
          {siteConfig.title}
        </Heading>
        <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
        <div className={styles.heroCode}>
          <code>npm install &amp;&amp; npx expo start</code>
        </div>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/getting-started">
            Get Started →
          </Link>
          <Link
            className="button button--outline button--lg"
            to="https://github.com/josedab/hrv-dashboard">
            GitHub ⭐
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
            { step: '1', icon: '📱', title: 'Strap On', desc: 'Put on your Polar H10 or any BLE heart rate monitor.' },
            { step: '2', icon: '⏱️', title: 'Record', desc: '5-minute recording captures RR intervals via Bluetooth.' },
            { step: '3', icon: '🧮', title: 'Analyze', desc: 'HRV metrics computed on-device: rMSSD, SDNN, pNN50.' },
            { step: '4', icon: '✅', title: 'Decide', desc: 'Get a clear verdict: Go Hard, Moderate, or Rest.' },
          ].map(({step, icon, title, desc}) => (
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

export default function Home(): ReactNode {
  return (
    <Layout
      title="HRV Morning Readiness Dashboard"
      description="React Native app for morning HRV readiness assessment. Connect a BLE heart rate monitor, compute HRV metrics, and get an actionable training verdict.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <HowItWorks />
      </main>
    </Layout>
  );
}
