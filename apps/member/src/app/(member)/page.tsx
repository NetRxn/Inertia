import { Suspense, use } from 'react';
import { adapterMode, getAdapters, type Initiative } from '../../adapters';
import { requireMember } from '../../identity/session';
import { getDb } from '../../db/client';
import { listShares } from '../../shares/shares';
import { buildTimeline, loadTimelineInput, type TimelineItem } from '../../feed/timeline';
import { listOrgInitiatives } from '../../work/org-initiatives';
import { byPriority } from '../../work/initiatives';
import { firstName, plural } from '../../components/cards/format';
import { WaitingCard } from '../../components/cards/WaitingCard';
import { ComingUpCard } from '../../components/cards/ComingUpCard';
import { RecentlySharedCard } from '../../components/cards/RecentlySharedCard';
import { AskCard } from '../../components/cards/AskCard';
import { InitiativesStrip } from '../../components/InitiativesStrip';
import { SectionTabs } from '../../components/SectionTabs';
import { Timeline } from '../../components/Timeline';
import { WorkList } from '../../components/WorkList';
import { AddToInertia } from '../../components/OrgControls';
import { ShareComposer } from '../../components/ShareComposer';
import { redirect } from 'next/navigation';
import { getOrganization } from '../../org/organization';
import { isAdmin } from '../../org/members';
import cardStyles from '../../components/cards/cards.module.css';
import styles from './home.module.css';

// Filters and paging come from the query string.
export const instant = false;

const PAGE = 30;
const GENERAL: Initiative = { id: 'general', title: 'General', status: 'active' };
const DAY_MS = 24 * 60 * 60 * 1000;

type Show = 'all' | 'work' | 'meetings' | 'shared';
const SHOW: { show: Show; label: string; kinds?: TimelineItem['kind'][] }[] = [
  { show: 'all', label: 'All' },
  { show: 'work', label: 'Work', kinds: ['task-done'] },
  { show: 'meetings', label: 'Meetings', kinds: ['meeting'] },
  { show: 'shared', label: 'Shared', kinds: ['share'] },
];

type HomeParams = { show?: string; initiative?: string; pages?: string };

function homeHref(params: { show: Show; initiative: string | null; pages?: number }): string {
  const query = new URLSearchParams();
  if (params.show !== 'all') query.set('show', params.show);
  if (params.initiative) query.set('initiative', params.initiative);
  if (params.pages && params.pages > 1) query.set('pages', String(params.pages));
  const text = query.toString();
  return text ? `/?${text}` : '/';
}

async function HomeFeed({ params }: { params: HomeParams }) {
  const member = await requireMember();
  const db = getDb();
  const org = await getOrganization(db);
  // A fresh install starts with the setup conversation for admins.
  if (!org?.setupCompletedAt && isAdmin(member) && adapterMode() === 'live') redirect('/setup');
  const now = new Date();
  const adapters = getAdapters();

  const [initiatives, shares, events] = await Promise.all([
    listOrgInitiatives(db, adapters.work),
    listShares(db, { limit: 50 }),
    adapters.events.listUpcoming(now, 4),
  ]);
  const ranked = initiatives.filter((i) => i.status !== 'done').sort(byPriority);
  const input = await loadTimelineInput(adapters, db, initiatives, shares);

  const show = SHOW.find((s) => s.show === params.show) ?? SHOW[0];
  const focus = ranked.some((i) => i.id === params.initiative) ? params.initiative! : null;
  const pages = Math.min(Math.max(Number.parseInt(params.pages ?? '1', 10) || 1, 1), 20);

  // Your claimed tasks and open ones; other members' claims never reach the client.
  const yours = input.humanTasks.filter((t) => t.status === 'claimed' && t.claimedBy === member.externalId);
  // Tasks under goals the organization didn't accept still need people; they group as General.
  const known = new Set(ranked.map((i) => i.id));
  const doable = input.humanTasks
    .filter((t) => (t.status === 'open' || yours.includes(t)) && (!focus || t.initiativeId === focus))
    .map((t) => (known.has(t.initiativeId) ? t : { ...t, initiativeId: GENERAL.id }));
  const open = input.humanTasks.filter((t) => t.status === 'open');
  const counts = new Map(ranked.map((i) => [i.id, plural(open.filter((t) => t.initiativeId === i.id).length, 'open task')]));

  const kinds = show.kinds;
  const { items: all, nextBefore } = buildTimeline(input, { limit: PAGE * pages, actors: ['member', 'organization'] });
  const items = all.filter((item) => (!kinds || kinds.includes(item.kind)) && (!focus || item.initiative?.id === focus));
  const moreHref = nextBefore ? homeHref({ show: show.show, initiative: focus, pages: pages + 1 }) : null;
  const comingUp = events.filter((e) => new Date(e.startsAt).getTime() < now.getTime() + 14 * DAY_MS);

  return (
    <>
      <header className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small static SVG logos swapped by theme */}
        <img className={`logo-night ${styles.lockup}`} src="/logos/inertia-lockup-on-dark.svg" alt="Inertia" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`logo-day ${styles.lockup}`} src="/logos/inertia-lockup-on-light.svg" alt="Inertia" />
        <h1 className={styles.greeting}>Welcome, {firstName(member.displayName)}</h1>
        <p className={styles.subtitle}>Here&apos;s what&apos;s happening in {org?.name ?? 'the organization'}.</p>
      </header>

      <InitiativesStrip
        initiatives={ranked}
        counts={counts}
        current={focus}
        hrefFor={(i) => homeHref({ show: show.show, initiative: focus === i.id ? null : i.id })}
      />

      <div className={cardStyles.feed}>
        {yours.length > 0 ? (
          <AskCard question="What do I need to do for my tasks?">
            <WaitingCard tasks={yours} />
          </AskCard>
        ) : null}

        <section id="your-work" className={styles.section} aria-labelledby="your-work-title">
          <h2 id="your-work-title" className={`in-label ${cardStyles.eyebrowMoss}`}>
            {focus ? `Open in ${ranked.find((i) => i.id === focus)!.title}` : 'You could help with'}
          </h2>
          <WorkList initiatives={[...ranked, GENERAL]} tasks={doable} memberExternalId={member.externalId} />
        </section>

        {comingUp.length > 0 ? (
          <AskCard question="What's coming up in the next two weeks?">
            <ComingUpCard events={comingUp} />
          </AskCard>
        ) : null}

        <details className={`in-glass ${cardStyles.card} ${styles.add}`}>
          <summary className={`in-label ${cardStyles.eyebrow}`}>Add to Inertia: notes, transcripts, links</summary>
          <AddToInertia />
        </details>

        <section className={styles.section} aria-labelledby="happening-title">
          <h2 id="happening-title" className={`in-label ${cardStyles.eyebrow}`}>What&apos;s been happening</h2>
          <SectionTabs
            variant="chips"
            label="Show"
            tabs={SHOW.map((s) => ({ href: homeHref({ show: s.show, initiative: focus }), label: s.label, current: s.show === show.show }))}
          />
          {show.show === 'shared' ? (
            // Shares keep their own card: link previews, files, and Delete for your own posts.
            <RecentlySharedCard shares={shares.map((s) => ({ ...s, isMine: s.authorExternalId === member.externalId }))} now={now} label="Shared" showDelete />
          ) : (
            <Timeline
              items={items}
              now={now}
              moreHref={moreHref}
              empty="Nothing has happened here yet. Add a meeting, link or note to get started."
            />
          )}
        </section>
      </div>

      <ShareComposer />
    </>
  );
}

export default function HomePage({ searchParams }: { searchParams: Promise<HomeParams> }) {
  const params = use(searchParams);
  return (
    <Suspense fallback={<p className="in-mono">Loading…</p>}>
      <HomeFeed params={params} />
    </Suspense>
  );
}
