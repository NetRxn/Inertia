import type { ChatThread } from '../../adapters/types';
import { ago, plural } from './format';
import styles from './cards.module.css';

type Props = { threads: { thread: ChatThread; line: string }[]; now: Date };

/**
 * From the chat: the busiest threads this past week, on people-realm hearth cards.
 * A thread's summary reads in grotesk; when there is none, the line is a member's
 * own words and is set as a quote in the serif voice.
 */
export function FromChatCard({ threads, now }: Props) {
  return (
    <section className={styles.ideas} aria-labelledby="card-from-chat">
      <h2 id="card-from-chat" className={`in-label ${styles.eyebrow}`}>
        From the chat
      </h2>
      {threads.map(({ thread, line }) => {
        const latestAt = thread.messages.reduce((a, b) => (Date.parse(b.at) > Date.parse(a.at) ? b : a)).at;
        return (
          <article key={thread.id} className={`in-idea in-tex in-tex--weave ${styles.idea}`}>
            <div className="in-idea__src">
              <span className="in-mono">
                {thread.channel} · {plural(thread.messages.length, 'message')}
              </span>
            </div>
            <span className="in-prairie" aria-hidden="true" />
            <div className={styles.stack}>
              <h3 className={styles.itemTitle}>{thread.title}</h3>
              {thread.summary ? <p className={styles.body}>{line}</p> : <blockquote className={styles.quote}>{line}</blockquote>}
            </div>
            <div className="in-idea__meta">
              <span>Last message {ago(latestAt, now)}</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}
