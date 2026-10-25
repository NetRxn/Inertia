import type { ShareSummary } from '../../feed/build-feed';
import { ago, firstName, initials } from './format';
import styles from './cards.module.css';

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Recently shared: members' newest posts, in their own words, on hearth cards. */
export function RecentlySharedCard({ shares, now }: { shares: ShareSummary[]; now: Date }) {
  return (
    <section className={styles.ideas} aria-labelledby="card-recently-shared">
      <h2 id="card-recently-shared" className={`in-label ${styles.eyebrow}`}>
        Recently shared
      </h2>
      {shares.map((share) => (
        <article key={share.id} className={`in-idea in-tex in-tex--weave ${styles.idea}`}>
          <div className="in-idea__src">
            <span className="in-mono">shared {share.kind}</span>
          </div>
          <span className="in-prairie" aria-hidden="true" />
          <p className="in-idea__text">{share.description}</p>
          {share.linkUrl ? (
            <p>
              <a href={share.linkUrl} className={styles.textLink} target="_blank" rel="noopener noreferrer">
                {share.previewTitle ?? hostname(share.linkUrl)}
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </p>
          ) : null}
          <div className="in-idea__meta">
            <span>
              <span className="in-avatar" aria-hidden="true">
                {initials(share.authorName)}
              </span>
              {firstName(share.authorName)} · {ago(share.createdAt, now)}
            </span>
          </div>
        </article>
      ))}
    </section>
  );
}
