import type { ShareSummary } from '../../feed/build-feed';
import { DeleteShareButton } from '../ShareComposer';
import { ago, firstName, initials } from './format';
import styles from './cards.module.css';

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Defence in depth on top of createShare's validation: only http(s) links render. */
function safeLink(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** R22: preview images render only from https, with no referrer and lazy loading. */
function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * Members' posts on hearth cards, in their own words. The home feed calls it
 * "Recently shared"; the Work tab's Ideas segment lists the same shares with
 * a Delete action on the author's own posts.
 */
export function RecentlySharedCard({
  shares,
  now,
  label = 'Recently shared',
  showDelete = false,
}: {
  shares: ShareSummary[];
  now: Date;
  label?: string;
  showDelete?: boolean;
}) {
  const headingId = `card-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <section className={styles.ideas} aria-labelledby={headingId}>
      <h2 id={headingId} className={`in-label ${styles.eyebrow}`}>
        {label}
      </h2>
      {shares.length === 0 ? (
        <p className={styles.meta}>What should we work on together?</p>
      ) : null}
      {shares.map((share) => {
        const link = safeLink(share.linkUrl);
        const image = safeImageUrl(share.previewImageUrl);
        return (
          <article key={share.id} className={`in-idea in-tex in-tex--weave ${styles.idea}`}>
            <div className="in-idea__src">
              <span className="in-mono">shared {share.kind}</span>
              {showDelete && share.isMine ? <DeleteShareButton shareId={share.id} /> : null}
            </div>
            <span className="in-prairie" aria-hidden="true" />
            {share.description ? <p className="in-idea__text">{share.description}</p> : null}
            {link ? (
              <p className={styles.shareLink}>
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a remote preview image, not a static asset
                  <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" className={styles.previewImage} />
                ) : null}
                <span className={styles.linkBody}>
                  <a href={link} className={styles.textLink} target="_blank" rel="noopener noreferrer">
                    {share.previewTitle ?? hostname(link)}
                    <span className="visually-hidden"> (opens in a new tab)</span>
                  </a>
                  <span className={styles.linkHint}>{hostname(link)}</span>
                </span>
              </p>
            ) : null}
            {share.fileId ? (
              <a href={`/api/files/${share.fileId}`} className={`in-mono ${styles.fileLink}`}>
                {share.fileName ?? 'attachment'}
              </a>
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
        );
      })}
    </section>
  );
}
