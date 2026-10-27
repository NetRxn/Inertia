import type { Proposal } from '../../adapters/types';
import { formatDay } from './format';
import styles from './cards.module.css';

/** Robert's Rules: open votes and those closed this past week. Read-only; voting happens there. */
export function ProposalsCard({ proposals }: { proposals: Proposal[] }) {
  return (
    <section className={`in-glass ${styles.card}`} aria-labelledby="card-proposals">
      <h2 id="card-proposals" className={`in-label ${styles.eyebrowTide}`}>
        Robert&apos;s Rules
      </h2>
      <ul className={styles.rows}>
        {proposals.map((proposal) => {
          const open = proposal.status === 'open';
          return (
            <li key={proposal.id} className={styles.stack}>
              <div className={styles.chips}>
                {open ? <span className="in-chip in-chip--tide">Vote open</span> : null}
                <span className="in-mono">
                  {open ? 'closes' : 'closed'} {formatDay(proposal.closesAt)}
                </span>
              </div>
              <h3 className={styles.itemTitle}>{proposal.title}</h3>
              <p className="in-mono">
                {proposal.tally.yes} yes · {proposal.tally.no} no · {proposal.tally.abstain} abstain
              </p>
              <p>
                <a href={proposal.url} className={styles.textLink} target="_blank" rel="noopener noreferrer">
                  {open ? "Vote in Robert's Rules" : 'See the result'}
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
