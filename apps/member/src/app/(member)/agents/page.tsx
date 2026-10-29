import { Suspense, use } from 'react';
import { getAdapters } from '../../../adapters';
import { getDb } from '../../../db/client';
import { requireMember } from '../../../identity/session';
import { buildTimeline, loadTimelineInput, type TimelineItem } from '../../../feed/timeline';
import { listOrgInitiatives } from '../../../work/org-initiatives';
import { byPriority } from '../../../work/initiatives';
import { listSources } from '../../../org/ingest';
import { integrationCards, type IntegrationCard } from '../../../org/integrations';
import { isAdmin } from '../../../org/members';
import { plural } from '../../../components/cards/format';
import { CheckConnections } from '../../../components/OrgControls';
import { InitiativesStrip } from '../../../components/InitiativesStrip';
import { SectionTabs } from '../../../components/SectionTabs';
import { Timeline } from '../../../components/Timeline';
import cardStyles from '../../../components/cards/cards.module.css';
import sectionStyles from '../sections.module.css';
import styles from './agents.module.css';

// Tabs, filters and paging come from the query string.
export const instant = false;

const PAGE = 30;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Tab = 'activity' | 'connections';
type Show = 'all' | 'work' | 'incoming';
const SHOW: { show: Show; label: string; kinds?: TimelineItem['kind'][] }[] = [
  { show: 'all', label: 'All' },
  { show: 'work', label: 'Agent work', kinds: ['agent-done', 'agent-started', 'agent-blocked'] },
  { show: 'incoming', label: 'Incoming data', kinds: ['incoming'] },
];

type AgentsParams = { tab?: string; show?: string; initiative?: string; pages?: string };

function activityHref(params: { show: Show; initiative: string | null; pages?: number }): string {
  const query = new URLSearchParams();
  if (params.show !== 'all') query.set('show', params.show);
  if (params.initiative) query.set('initiative', params.initiative);
  if (params.pages && params.pages > 1) query.set('pages', String(params.pages));
  const text = query.toString();
  return text ? `/agents?${text}` : '/agents';
}

async function ActivityTab({ params }: { params: AgentsParams }) {
  const now = new Date();
  const db = getDb();
  const adapters = getAdapters();
  const initiatives = await listOrgInitiatives(db, adapters.work);
  const ranked = initiatives.filter((i) => i.status !== 'done').sort(byPriority);
  const input = await loadTimelineInput(adapters, db, initiatives, []);

  const show = SHOW.find((s) => s.show === params.show) ?? SHOW[0];
  const focus = ranked.some((i) => i.id === params.initiative) ? params.initiative! : null;
  const pages = Math.min(Math.max(Number.parseInt(params.pages ?? '1', 10) || 1, 1), 20);

  const agents = input.agentTasks;
  const weekAgo = now.getTime() - WEEK_MS;
  const working = agents.filter((t) => t.status === 'running').length;
  const stuck = agents.filter((t) => t.status === 'blocked').length;
  const doneThisWeek = agents.filter((t) => t.status === 'done' && new Date(t.updatedAt).getTime() >= weekAgo).length;
  const counts = new Map(ranked.map((i) => [i.id, plural(agents.filter((t) => t.initiativeId === i.id && t.status !== 'done').length, 'agent task')]));
  const engine = adapters.work.engine;

  const kinds = show.kinds;
  const { items: all, nextBefore } = buildTimeline(input, { limit: PAGE * pages, actors: ['agent', 'connector'] });
  const items = all.filter((item) => (!kinds || kinds.includes(item.kind)) && (!focus || item.initiative?.id === focus));

  return (
    <div className={cardStyles.feed}>
      <section className={`in-glass in-tex in-tex--stars ${cardStyles.card}`} aria-labelledby="agents-recap">
        <h2 id="agents-recap" className={`in-label ${cardStyles.eyebrowTide}`}>Agents this week</h2>
        <div className={styles.tiles}>
          <div><b>{working}</b><span>working now</span></div>
          <div><b>{stuck}</b><span>stuck</span></div>
          <div><b>{doneThisWeek}</b><span>done this week</span></div>
        </div>
        {engine ? (
          <p className={cardStyles.meta}>
            Agent work runs in {engine.url ? <a className={cardStyles.textLink} href={engine.url} target="_blank" rel="noopener noreferrer">{engine.name}</a> : engine.name}
            {engine.readOnly ? ', read-only from here.' : '.'}
          </p>
        ) : (
          <p className={cardStyles.meta}>No agent engine is connected yet. See Connections.</p>
        )}
      </section>

      <InitiativesStrip
        initiatives={ranked}
        counts={counts}
        current={focus}
        hrefFor={(i) => activityHref({ show: show.show, initiative: focus === i.id ? null : i.id })}
      />

      <section className={sectionStyles.sections} aria-label="Agent activity">
        <SectionTabs
          variant="chips"
          label="Show"
          tabs={SHOW.map((s) => ({ href: activityHref({ show: s.show, initiative: focus }), label: s.label, current: s.show === show.show }))}
        />
        <Timeline
          items={items}
          now={now}
          moreHref={nextBefore ? activityHref({ show: show.show, initiative: focus, pages: pages + 1 }) : null}
          empty="No agent activity yet. Once agents start working, or data comes in from Buzz or Telegram, it shows here."
        />
      </section>
    </div>
  );
}

function ConnectionList({ cards }: { cards: IntegrationCard[] }) {
  return (
    <ul className={cardStyles.rows}>
      {cards.map((c) => (
        <li key={c.id}>
          <p className={styles.status}>
            <span className={cardStyles.itemTitle}>{c.name}</span>
            <span className={`in-chip ${c.status === 'connected' ? 'in-chip--moss' : c.status === 'available' ? 'in-chip--pollen' : 'in-chip--tide'}`}>
              {c.status === 'connected' ? 'Connected' : c.status === 'available' ? 'Ready to connect' : 'Coming next'}
            </span>
          </p>
          <p className={cardStyles.body}>{c.what} <span className={cardStyles.meta}>· {c.direction}</span></p>
          <p className={cardStyles.meta}>{c.how}</p>
        </li>
      ))}
    </ul>
  );
}

async function ConnectionsTab({ admin }: { admin: boolean }) {
  const sources = await listSources(getDb());
  const cards = integrationCards(process.env, getAdapters(), {
    sources: sources.length,
    meetings: sources.filter((s) => s.kind === 'meeting').length,
    chatExports: sources.filter((s) => s.kind === 'chat-export').length,
    repositories: sources.filter((s) => s.origin?.startsWith('https://github.com/')).length,
    buzzDigests: sources.filter((s) => s.kind === 'chat-export' && s.title.startsWith('Buzz:')).length,
    telegramDigests: sources.filter((s) => s.kind === 'chat-export' && s.title.startsWith('Telegram')).length,
  });
  const core = ['paperclip', 'buzz'];
  const rest = cards.filter((c) => !core.includes(c.id));
  return (
    <div className={cardStyles.feed}>
      <section className={`in-glass in-tex in-tex--stars ${cardStyles.card}`}>
        <h2 className={`in-label ${cardStyles.eyebrowTide}`}>Agents and their channels</h2>
        <ConnectionList cards={cards.filter((c) => core.includes(c.id))} />
      </section>
      <section className={`in-glass ${cardStyles.card}`}>
        <h2 className={`in-label ${cardStyles.eyebrow}`}>Everything else</h2>
        <ConnectionList cards={[...rest].sort((a, b) => ['connected', 'available', 'planned'].indexOf(a.status) - ['connected', 'available', 'planned'].indexOf(b.status))} />
      </section>
      {admin && (
        <section className={`in-glass ${cardStyles.card}`}>
          <h2 className={`in-label ${cardStyles.eyebrow}`}>Test the connections</h2>
          <CheckConnections />
        </section>
      )}
      <p className={cardStyles.meta}>Anything can plug in: an integration only says what it reads or writes, how it connects, and who may see what it brings in. Everything it brings is treated as information, never as instructions.</p>
    </div>
  );
}

async function AgentsContent({ params }: { params: AgentsParams }) {
  const member = await requireMember();
  const tab: Tab = params.tab === 'connections' ? 'connections' : 'activity';
  return (
    <>
      <header className={sectionStyles.header}>
        <h1 className={sectionStyles.title}>Agents</h1>
        <p className={cardStyles.meta}>What your agents are working on, and what&apos;s connected.</p>
      </header>
      <SectionTabs
        label="Agents sections"
        tabs={[
          { href: '/agents', label: 'Activity', current: tab === 'activity' },
          { href: '/agents?tab=connections', label: 'Connections', current: tab === 'connections' },
        ]}
      />
      {tab === 'activity' ? <ActivityTab params={params} /> : <ConnectionsTab admin={isAdmin(member)} />}
    </>
  );
}

/** The technical side: agent work from the engine, incoming data, and connections. */
export default function AgentsPage({ searchParams }: { searchParams: Promise<AgentsParams> }) {
  const params = use(searchParams);
  return (
    <Suspense fallback={<p className="in-mono">Loading…</p>}>
      <AgentsContent params={params} />
    </Suspense>
  );
}
