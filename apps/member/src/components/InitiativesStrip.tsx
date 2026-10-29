import Link from 'next/link';
import type { Initiative } from '../adapters/types';
import cardStyles from './cards/cards.module.css';
import styles from './InitiativesStrip.module.css';

/**
 * The organization's initiatives, most important first. With `hrefFor`, each
 * card filters the feed below to that initiative; `current` marks the one shown.
 */
export function InitiativesStrip({ initiatives, hrefFor, current, counts }: {
  initiatives: Initiative[];
  hrefFor?: (initiative: Initiative) => string;
  current?: string | null;
  counts?: Map<string, string>;
}) {
  if (initiatives.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="initiatives-strip">
      <h2 id="initiatives-strip" className={`in-label ${cardStyles.eyebrowMoss}`}>Initiatives</h2>
      <ul className={styles.row}>
        {initiatives.map((initiative) => {
          const body = (
            <>
              <h3 className={styles.title}>{initiative.title}</h3>
              {initiative.awaitingVote ? <span className="in-chip in-chip--pollen">Awaiting vote</span> : initiative.statusLabel ? <p className={cardStyles.meta}>{initiative.statusLabel}</p> : null}
              {counts?.get(initiative.id) ? <p className={cardStyles.meta}>{counts.get(initiative.id)}</p> : null}
              {initiative.progress != null ? (
                <div className={styles.bar} role="img" aria-label={`${Math.round(initiative.progress * 100)}% along`}>
                  <span style={{ width: `${Math.round(Math.min(Math.max(initiative.progress, 0), 1) * 100)}%` }} />
                </div>
              ) : null}
            </>
          );
          return (
            <li key={initiative.id}>
              {hrefFor ? (
                <Link className={`in-glass ${styles.card}`} href={hrefFor(initiative)} aria-current={current === initiative.id ? 'true' : undefined} scroll={false}>{body}</Link>
              ) : (
                <div className={`in-glass ${styles.card}`}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
