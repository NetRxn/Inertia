import type { Meeting } from '../../adapters/types';
import { formatDay, plural } from './format';
import styles from './cards.module.css';

/** Last meeting: the newest meeting's summary and what came out of it. */
export function LastMeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <section className={`in-glass ${styles.card}`} aria-labelledby="card-last-meeting">
      <h2 id="card-last-meeting" className={`in-label ${styles.eyebrow}`}>
        Last meeting
      </h2>
      <div className={styles.stack}>
        <time className="in-mono" dateTime={meeting.date}>
          {formatDay(meeting.date)}
        </time>
        <h3 className={styles.itemTitle}>{meeting.title}</h3>
        <p className={styles.body}>{meeting.summary}</p>
      </div>
      <div className={styles.chips}>
        {meeting.decisions.length > 0 ? (
          <span className="in-chip in-chip--moss">{plural(meeting.decisions.length, 'decision')}</span>
        ) : null}
        {meeting.openQuestions.length > 0 ? (
          <span className="in-chip in-chip--tide">{plural(meeting.openQuestions.length, 'open question')}</span>
        ) : null}
        {meeting.actionItems.length > 0 ? (
          <span className="in-mono">{plural(meeting.actionItems.length, 'action item')}</span>
        ) : null}
      </div>
    </section>
  );
}
