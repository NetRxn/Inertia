import { Suspense } from 'react';
import { getAdapters } from '../../adapters';
import { requireMember } from '../../identity/session';
import { buildFeed } from '../../feed/build-feed';
import { FeedCards } from '../../components/cards/FeedCards';
import { firstName } from '../../components/cards/format';
import styles from './home.module.css';

async function HomeFeed() {
  const member = await requireMember();
  const now = new Date();
  // Shares arrive with Task 7; until then the feed has none.
  const cards = await buildFeed(getAdapters(), member, [], now);

  return (
    <>
      <header className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small static SVG logos swapped by theme */}
        <img className={`logo-night ${styles.lockup}`} src="/logos/inertia-lockup-on-dark.svg" alt="Inertia" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`logo-day ${styles.lockup}`} src="/logos/inertia-lockup-on-light.svg" alt="Inertia" />
        <h1 className={styles.greeting}>Welcome, {firstName(member.displayName)}</h1>
        <p className={styles.subtitle}>Here&apos;s what&apos;s happening in the DAO.</p>
      </header>
      <FeedCards cards={cards} now={now} />
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<p className="in-mono">Loading…</p>}>
      <HomeFeed />
    </Suspense>
  );
}
