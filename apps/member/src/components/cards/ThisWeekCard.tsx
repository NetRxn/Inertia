import Link from 'next/link';
import { firstName, initials, plural } from './format';
import styles from './cards.module.css';

type Props = { top: { displayName: string; count: number }[]; openItems: number };

/** This week: who finished the most, credited by first name, and what is still open. */
export function ThisWeekCard({ top, openItems }: Props) {
  return (
    <section className={`in-glass ${styles.card}`} aria-labelledby="card-this-week">
      <h2 id="card-this-week" className={`in-label ${styles.eyebrowMoss}`}>
        This week
      </h2>
      {top.length > 0 ? (
        <ul className={styles.rows}>
          {top.map((person) => (
            <li key={person.displayName} className={styles.credit}>
              <span>
                <span className="in-avatar" aria-hidden="true">
                  {initials(person.displayName)}
                </span>
                {firstName(person.displayName)} finished {plural(person.count, 'task')}
              </span>
              <span className="in-chip in-chip--moss">+{person.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.body}>Nothing finished yet this week.</p>
      )}
      {openItems > 0 ? (
        <p className={styles.meta}>
          {plural(openItems, 'item')} still open in{' '}
          <Link href="/#your-work" className={styles.textLink}>
            Work
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}
