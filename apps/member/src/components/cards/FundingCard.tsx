import type { FundingApplication, FundingOpportunity } from '../../adapters/types';
import { deadlineLabel, routeLabel } from '../../funding/funding';
import { plural } from './format';
import styles from './cards.module.css';

/**
 * Funding: what the grant finder turned up that the DAO can act on soon, and
 * applications waiting on members. Read-only; details live on the Funding page.
 */
export function FundingCard({
  opportunities,
  applications,
}: {
  opportunities: FundingOpportunity[];
  applications: FundingApplication[];
}) {
  return (
    <section className={`in-glass ${styles.card}`} aria-labelledby="card-funding">
      <h2 id="card-funding" className={`in-label ${styles.eyebrowMoss}`}>
        Funding
      </h2>
      <ul className={styles.rows}>
        {applications.map((application) => (
          <li key={application.id} className={styles.stack}>
            <div className={styles.chips}>
              <span className="in-chip in-chip--signal">Needs members</span>
              <span className="in-mono">{plural(application.decisionsNeeded.length, 'decision')}</span>
            </div>
            <h3 className={styles.itemTitle}>
              <a href={`/org?tab=funding#application-${application.id}`} className={styles.textLink}>
                {application.title}
              </a>
            </h3>
            <p className={styles.meta}>{application.decisionsNeeded[0]?.question}</p>
          </li>
        ))}
        {opportunities.map((opportunity) => (
          <li key={opportunity.id} className={styles.stack}>
            <div className={styles.chips}>
              <span className="in-chip in-chip--moss">{routeLabel(opportunity.route)}</span>
              <span className="in-mono">{deadlineLabel(opportunity.deadline)}</span>
            </div>
            <h3 className={styles.itemTitle}>
              <a href={`/org?tab=funding#opportunity-${opportunity.id}`} className={styles.textLink}>
                {opportunity.program}
              </a>
            </h3>
            <p className={styles.meta}>
              {opportunity.sponsor}
              {opportunity.benefit ? ` · ${opportunity.benefit}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
