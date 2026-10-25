import type { Initiative } from '../../adapters/types';
import styles from './cards.module.css';

const ORBIT = 70;
const CIRCUMFERENCE = 2 * Math.PI * ORBIT;

/**
 * The initiative as a small planet: a tide body with its moss ring, progress drawn
 * along its orbit in moss, and a pollen moon. Only the top priority's moon turns
 * (one thing moves at a time); the bundle stops it under reduced motion.
 */
function Planet({ progress, turning }: { progress: number; turning: boolean }) {
  const travelled = Math.min(Math.max(progress, 0), 1) * CIRCUMFERENCE;

  return (
    <svg className={`in-init__sys ${styles.planet}`} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle className="ring" cx="100" cy="100" r="92" />
      <circle className="ring ring--sig" cx="100" cy="100" r={ORBIT} />
      <circle
        className={styles.progress}
        cx="100"
        cy="100"
        r={ORBIT}
        strokeDasharray={`${travelled} ${CIRCUMFERENCE}`}
        transform="rotate(-90 100 100)"
      />
      <path className="band" d="M48 100 A52 12 0 0 1 152 100" transform="rotate(-16 100 100)" />
      <circle className="planet" cx="100" cy="100" r="34" />
      <path className="band" d="M48 100 A52 12 0 0 0 152 100" transform="rotate(-16 100 100)" />
      <g className={turning ? 'in-init__orbit' : undefined}>
        <circle className={styles.moon} cx="100" cy="8" r="9" />
      </g>
    </svg>
  );
}

/** Top priorities: the active initiatives, most important first. */
export function PrioritiesCard({ initiatives }: { initiatives: Initiative[] }) {
  return (
    <section className={`in-glass in-tex in-tex--stars ${styles.card}`} aria-labelledby="card-priorities">
      <h2 id="card-priorities" className={`in-label ${styles.eyebrowTide}`}>
        Top priorities
      </h2>
      <ol className={styles.rows}>
        {initiatives.map((initiative, index) => (
          <li key={initiative.id} className={styles.priority}>
            <Planet progress={initiative.progress} turning={index === 0} />
            <div className={styles.priorityText}>
              <h3 className={styles.itemTitle}>{initiative.title}</h3>
              <p className={styles.meta}>{initiative.statusLabel}</p>
              <div className={styles.chips}>
                <span className="in-chip in-chip--moss">{Math.round(initiative.progress * 100)}% along</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
