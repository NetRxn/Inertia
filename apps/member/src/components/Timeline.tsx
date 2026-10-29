import Link from 'next/link';
import type { TimelineItem } from '../feed/timeline';
import { DAO_TIME_ZONE } from '../feed/week';
import { formatDay, formatTime, initials } from './cards/format';
import cardStyles from './cards/cards.module.css';
import styles from './Timeline.module.css';

const VERB: Record<TimelineItem['kind'], string> = {
  'task-done': 'finished',
  'agent-done': 'finished',
  'agent-started': 'is working on',
  'agent-blocked': 'is stuck on',
  meeting: 'Meeting notes:',
  share: 'shared',
  proposal: 'Vote:',
  funding: 'Funding:',
  incoming: 'brought in',
};

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: DAO_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

function dayLabel(iso: string, now: Date): string {
  const key = dayKey.format(new Date(iso));
  if (key === dayKey.format(now)) return 'Today';
  if (key === dayKey.format(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return 'Yesterday';
  return formatDay(iso);
}

function byDay(items: TimelineItem[], now: Date): { day: string; items: TimelineItem[] }[] {
  const groups: { day: string; items: TimelineItem[] }[] = [];
  for (const item of items) {
    const day = dayLabel(item.at, now);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

// Rounded 24px outline glyphs, as in the menu.
const GLYPHS = {
  agent: <><rect x="5" y="7" width="14" height="11" rx="3" /><path d="M12 3.5V7M9.5 12h.01M14.5 12h.01M9.5 15h5" /></>,
  connector: <><path d="M4 12h5l2-4 2 8 2-4h5" /></>,
  organization: <><circle cx="12" cy="7" r="2.5" /><circle cx="6" cy="16" r="2.5" /><circle cx="18" cy="16" r="2.5" /><path d="M10.5 9 7.5 13.8M13.5 9l3 4.8M8.5 16h7" /></>,
};

function Badge({ actor }: { actor: TimelineItem['actor'] }) {
  return (
    <span className={`in-avatar ${styles.badge}`} data-actor={actor.kind} aria-hidden="true">
      {actor.kind === 'member' ? initials(actor.name) : <svg viewBox="0 0 24 24">{GLYPHS[actor.kind]}</svg>}
    </span>
  );
}

function who(actor: TimelineItem['actor']): string | null {
  if (actor.kind === 'member') return actor.name;
  if (actor.kind === 'agent') return actor.name ?? 'An agent';
  if (actor.kind === 'connector') return actor.name;
  return null;
}

function Item({ item }: { item: TimelineItem }) {
  const name = who(item.actor);
  const external = item.href?.startsWith('http');
  const title = item.href ? (
    external ? (
      <a className={styles.title} href={item.href} target="_blank" rel="noopener noreferrer">{item.title}</a>
    ) : (
      <Link className={styles.title} href={item.href}>{item.title}</Link>
    )
  ) : (
    <span className={styles.title}>{item.title}</span>
  );
  return (
    <li className={styles.item}>
      <Badge actor={item.actor} />
      <div className={styles.text}>
        <p className={styles.line}>
          {name ? <>{name} {VERB[item.kind]} </> : <>{VERB[item.kind]} </>}
          {title}
        </p>
        {item.detail ? <p className={cardStyles.meta}>{item.detail}</p> : null}
        <div className={cardStyles.chips}>
          <time className="in-mono" dateTime={item.at}>{formatTime(item.at)}</time>
          {item.initiative ? <span className="in-chip in-chip--moss">{item.initiative.title}</span> : null}
        </div>
      </div>
    </li>
  );
}

/** What happened, newest first, under day headings. `moreHref` links to the next page. */
export function Timeline({ items, now, moreHref, empty }: { items: TimelineItem[]; now: Date; moreHref: string | null; empty: string }) {
  if (items.length === 0) {
    return <p className={`in-glass ${styles.empty} ${cardStyles.meta}`}>{empty}</p>;
  }
  return (
    <div className={styles.days}>
      {byDay(items, now).map((group) => (
        <section key={group.day} className={styles.day} aria-label={group.day}>
          <h2 className={`in-label ${cardStyles.eyebrow}`}>{group.day}</h2>
          <ol className={`in-glass ${styles.items}`}>
            {group.items.map((item) => <Item key={item.id} item={item} />)}
          </ol>
        </section>
      ))}
      {moreHref ? <Link className={`in-btn in-btn--quiet ${styles.more}`} href={moreHref} scroll={false}>Show earlier</Link> : null}
    </div>
  );
}
