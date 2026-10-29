import { getAdapters } from '../../../../adapters';
import type { DaoEvent } from '../../../../adapters/types';
import { requireMember } from '../../../../identity/session';
import { formatDay, formatTime } from '../../../../components/cards/format';
import cardStyles from '../../../../components/cards/cards.module.css';
import styles from '../../sections.module.css';

const UPCOMING_LIMIT = 50;

const KIND_LABELS: Record<DaoEvent['kind'], string> = {
  meeting: 'Meeting',
  deadline: 'Deadline',
  vote: 'Vote',
  other: 'Event',
};

/** Events in start order, grouped under their day in the DAO's time zone. */
function byDay(events: DaoEvent[]): { day: string; events: DaoEvent[] }[] {
  const groups: { day: string; events: DaoEvent[] }[] = [];
  for (const event of events) {
    const day = formatDay(event.startsAt);
    const last = groups.at(-1);
    if (last?.day === day) last.events.push(event);
    else groups.push({ day, events: [event] });
  }
  return groups;
}

export async function CalendarContent() {
  await requireMember();
  // After the dynamic access above, so the page keeps a static shell.
  const events = await getAdapters().events.listUpcoming(new Date(), UPCOMING_LIMIT);

  if (events.length === 0) {
    return <p className={cardStyles.meta}>Nothing on the calendar yet. Anything you&apos;d like to plan?</p>;
  }

  return (
    <div className={styles.sections}>
      {byDay(events).map((group, index) => {
        const headingId = `day-${index}`;
        return (
          <section key={group.day} className={`in-glass ${cardStyles.card}`} aria-labelledby={headingId}>
            <h2 id={headingId} className={`in-label ${cardStyles.eyebrowTide}`}>
              {group.day}
            </h2>
            <ul className={cardStyles.rows}>
              {group.events.map((event) => (
                <li key={event.id} className={cardStyles.stack}>
                  <h3 className={cardStyles.itemTitle}>{event.title}</h3>
                  <p className={cardStyles.meta}>{event.detail}</p>
                  <div className={cardStyles.chips}>
                    <span className="in-chip in-chip--tide">{KIND_LABELS[event.kind]}</span>
                    <time className="in-mono" dateTime={event.startsAt}>
                      {formatTime(event.startsAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Upcoming DAO events, grouped by day. */
