import { Suspense } from 'react';
import { getAdapters } from '../../adapters';
import { requireMember } from '../../identity/session';
import { getDb } from '../../db/client';
import { listShares } from '../../shares/shares';
import { buildFeed } from '../../feed/build-feed';
import { FeedCards } from '../../components/cards/FeedCards';
import { firstName } from '../../components/cards/format';
import { redirect } from 'next/navigation';
import { getOrganization } from '../../org/organization';
import { isAdmin } from '../../org/members';
import styles from './home.module.css';

async function HomeFeed() {
  const member = await requireMember();
  const org = await getOrganization(getDb());
  // A fresh install starts with the setup conversation for admins.
  if (!org?.setupCompletedAt && isAdmin(member) && process.env.MEMBER_APP_ADAPTERS === 'live') redirect('/setup');
  const now = new Date();
  const shares = (await listShares(getDb(), { limit: 3 })).map((share) => ({
    ...share,
    isMine: share.authorExternalId === member.externalId,
  }));
  const cards = await buildFeed(getAdapters(), member, shares, now);

  return (
    <>
      <header className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small static SVG logos swapped by theme */}
        <img className={`logo-night ${styles.lockup}`} src="/logos/inertia-lockup-on-dark.svg" alt="Inertia" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`logo-day ${styles.lockup}`} src="/logos/inertia-lockup-on-light.svg" alt="Inertia" />
        <h1 className={styles.greeting}>Welcome, {firstName(member.displayName)}</h1>
        <p className={styles.subtitle}>Here&apos;s what&apos;s happening in {org?.name ?? 'the DAO'}.</p>
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
