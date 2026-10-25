import { Suspense, use } from 'react';
import Link from 'next/link';
import { getAdapters } from '../../../adapters';
import { requireMember } from '../../../identity/session';
import { WorkList } from '../../../components/WorkList';
import { PrioritiesCard } from '../../../components/cards/PrioritiesCard';
import cardStyles from '../../../components/cards/cards.module.css';
import styles from './work.module.css';

// Allow blocking route for searchParams access
export const instant = false;

type Segment = 'needs-person' | 'initiatives' | 'ideas';

async function WorkContent({ segment }: { segment: Segment }) {
  const member = await requireMember();
  const adapters = getAdapters();
  const [initiatives, allTasks] = await Promise.all([
    adapters.work.listInitiatives(),
    adapters.work.listHumanTasks(),
  ]);

  // Sort initiatives by priority
  const sortedInitiatives = initiatives
    .filter((i) => i.status === 'active')
    .sort((a, b) => a.priority - b.priority);

  if (segment === 'initiatives') {
    return <PrioritiesCard initiatives={sortedInitiatives} />;
  }

  if (segment === 'ideas') {
    return (
      <section className={`in-glass in-tex in-tex--stars ${cardStyles.card}`} aria-labelledby="ideas-placeholder">
        <p id="ideas-placeholder" className={cardStyles.meta}>
          What should we work on together?
        </p>
      </section>
    );
  }

  // Filter tasks that need a person: open OR claimed by current member (not done)
  // Do this server-side so other members' externalIds are never serialized to the client
  const tasks = allTasks.filter(
    (t) => t.status === 'open' || (t.status === 'claimed' && t.claimedBy === member.externalId)
  );

  // Default: needs-person segment
  return <WorkList initiatives={sortedInitiatives} tasks={tasks} memberExternalId={member.externalId} />;
}

export default function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Read the segment from search params (awaiting the promise per Next.js conventions)
  const params = use(searchParams);
  const segment: Segment = (params.tab === 'initiatives' || params.tab === 'ideas')
    ? params.tab
    : 'needs-person';

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Work</h1>
        <p className={cardStyles.meta}>Tasks and initiatives across the DAO.</p>
      </header>

      <nav className={styles.tabs} aria-label="Work sections">
        <Link
          href="/work"
          aria-current={segment === 'needs-person' ? 'page' : undefined}
          className={styles.tab}
        >
          Needs a person
        </Link>
        <Link
          href="/work?tab=initiatives"
          aria-current={segment === 'initiatives' ? 'page' : undefined}
          className={styles.tab}
        >
          Initiatives
        </Link>
        <Link
          href="/work?tab=ideas"
          aria-current={segment === 'ideas' ? 'page' : undefined}
          className={styles.tab}
        >
          Ideas
        </Link>
      </nav>

      <Suspense fallback={<p className="in-mono">Loading…</p>}>
        <WorkContent segment={segment} />
      </Suspense>
    </>
  );
}
