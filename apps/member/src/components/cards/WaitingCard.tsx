import Link from 'next/link';
import type { HumanTask, TaskKind } from '../../adapters/types';
import { formatDay, plural } from './format';
import styles from './cards.module.css';

// One outline glyph per kind of ask, drawn in the signal hue: a human is needed.
const KIND_GLYPHS: Record<TaskKind, React.ReactNode> = {
  creative: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v.2h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
    </>
  ),
  outreach: <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  review: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'real-world': (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
};

const KIND_LABELS: Record<TaskKind, string> = {
  creative: 'creative',
  outreach: 'outreach',
  review: 'review',
  'real-world': 'real world',
};

/** Waiting for you: the agent's ask idiom for the tasks this member has taken on. */
export function WaitingCard({ tasks }: { tasks: HumanTask[] }) {
  const [task, ...rest] = tasks;

  return (
    <section className={`in-ask in-glass in-tex in-tex--orbits ${styles.ask}`} aria-labelledby="card-waiting">
      <div className="in-ask__head">
        <span className="in-dot" aria-hidden="true" />
        <h2 id="card-waiting" className="in-label">
          Waiting for you
        </h2>
        {task?.estimateMinutes ? <span className="in-chip in-chip--signal">~{task.estimateMinutes} min</span> : null}
      </div>

      {task ? (
        <>
          <div className="in-ask__body">
            <span className="in-gicon in-gicon--signal in-gicon--sm" aria-hidden="true">
              <svg viewBox="0 0 24 24">{KIND_GLYPHS[task.kind]}</svg>
            </span>
            <div>
              <h3 className={`in-ask__title ${styles.askTitle}`}>{task.title}</h3>
              <p className="in-ask__why">{task.prepared}</p>
            </div>
          </div>
          <div className="in-ask__ctx in-mono">
            <span>
              kind · <b>{KIND_LABELS[task.kind]}</b>
            </span>
            {task.estimateMinutes ? (
              <span>
                rough time · <b>~{task.estimateMinutes} min</b>
              </span>
            ) : null}
            {task.due ? (
              <span>
                due · <b>{formatDay(task.due)}</b>
              </span>
            ) : null}
          </div>
          <div className="in-ask__actions">
            <Link href="/work" className="in-btn in-btn--primary">
              Open in Work
            </Link>
            {rest.length > 0 ? (
              <Link href="/work" className="in-btn in-btn--quiet">
                {plural(rest.length, 'more task')} waiting
              </Link>
            ) : null}
          </div>
        </>
      ) : (
        <p className="in-ask__why">
          Nothing waiting for you. See{' '}
          <Link href="/work" className={styles.textLink}>
            Work
          </Link>{' '}
          for things you could take on.
        </p>
      )}
    </section>
  );
}
