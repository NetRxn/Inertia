import type { DaoEvent } from '../../adapters/types';
import { dateTile, formatTime } from './format';
import styles from './cards.module.css';

const KIND_LABELS: Record<DaoEvent['kind'], string> = {
  meeting: 'Meeting',
  deadline: 'Deadline',
  vote: 'Vote',
  other: 'Event',
};

/** Coming up: the next events on the DAO calendar. */
export function ComingUpCard({ events }: { events: DaoEvent[] }) {
  return (
    <section className={`in-glass ${styles.card}`} aria-labelledby="card-coming-up">
      <h2 id="card-coming-up" className={`in-label ${styles.eyebrowTide}`}>
        Coming up
      </h2>
      <ul className={styles.rows}>
        {events.map((event) => {
          const tile = dateTile(event.startsAt);
          return (
            <li key={event.id} className={styles.event}>
              <time className={styles.tile} dateTime={event.startsAt}>
                <span className="in-label">{tile.weekday}</span>
                <span className={styles.tileDay}>{tile.day}</span>
              </time>
              <div className={styles.stack}>
                <h3 className={styles.itemTitle}>{event.title}</h3>
                <p className={styles.meta}>{event.detail}</p>
                <div className={styles.chips}>
                  <span className="in-chip in-chip--tide">{KIND_LABELS[event.kind]}</span>
                  <span className="in-mono">{formatTime(event.startsAt)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
