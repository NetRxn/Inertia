import { getAdapters } from '../../../../adapters';
import type { Meeting } from '../../../../adapters/types';
import { getDb } from '../../../../db/client';
import { members } from '../../../../db/schema';
import { listDocuments, type Document } from '../../../../documents/documents';
import { requireMember } from '../../../../identity/session';
import { listShares } from '../../../../shares/shares';
import type { ShareSummary } from '../../../../feed/build-feed';
import { HashDetails } from '../../../../components/HashDetails';
import { ago, firstName, formatDay, plural } from '../../../../components/cards/format';
import cardStyles from '../../../../components/cards/cards.module.css';
import styles from '../../sections.module.css';

const MEETING_LIMIT = 20;
const FILE_LIMIT = 50;

function MeetingNotes({ meeting, ownerName }: { meeting: Meeting; ownerName: (externalId: string) => string }) {
  return (
    <HashDetails id={`meeting-${meeting.id}`} className={`${styles.detail} ${styles.target}`}>
      <summary>
        <time className="in-mono" dateTime={meeting.date}>
          {formatDay(meeting.date)}
        </time>
        <h3 className={cardStyles.itemTitle}>{meeting.title}</h3>
        <p className={cardStyles.body}>{meeting.summary}</p>
        <span className={styles.detailHint}>
          {plural(meeting.decisions.length, 'decision')} · {plural(meeting.openQuestions.length, 'open question')} ·{' '}
          {plural(meeting.actionItems.length, 'action item')}
        </span>
      </summary>
      <div className={styles.detailBody}>
        {meeting.decisions.length > 0 ? (
          <div className={cardStyles.stack}>
            <h4 className={`in-label ${cardStyles.eyebrowMoss}`}>Decisions</h4>
            <ul className={styles.list}>
              {meeting.decisions.map((decision) => (
                <li key={decision}>{decision}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {meeting.openQuestions.length > 0 ? (
          <div className={cardStyles.stack}>
            <h4 className={`in-label ${cardStyles.eyebrowTide}`}>Open questions</h4>
            <ul className={styles.list}>
              {meeting.openQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {meeting.actionItems.length > 0 ? (
          <div className={cardStyles.stack}>
            <h4 className={`in-label ${cardStyles.eyebrow}`}>Action items</h4>
            <ul className={styles.list}>
              {meeting.actionItems.map((item) => (
                <li key={item.text}>
                  {item.text} <span className={cardStyles.meta}>· {item.owner ? ownerName(item.owner) : 'no one yet'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {meeting.transcriptUrl ? (
          <p>
            <a href={meeting.transcriptUrl} className={cardStyles.textLink} target="_blank" rel="noopener noreferrer">
              Read the transcript
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </p>
        ) : null}
      </div>
    </HashDetails>
  );
}

function SharedFile({ share, now }: { share: ShareSummary; now: Date }) {
  return (
    <li className={cardStyles.stack}>
      <a href={`/api/files/${share.fileId}`} className={cardStyles.textLink}>
        {share.fileName ?? 'attachment'}
      </a>
      <span className={cardStyles.meta}>
        {firstName(share.authorName)} · {ago(share.createdAt, now)}
      </span>
    </li>
  );
}

function Draft({ doc }: { doc: Document }) {
  return (
    <div className={cardStyles.stack}>
      <HashDetails id={`doc-${doc.id}`} className={`${styles.detail} ${styles.target}`}>
        <summary>
          <time className="in-mono" dateTime={doc.createdAt.toISOString()}>
            {formatDay(doc.createdAt.toISOString())}
          </time>
          <h3 className={cardStyles.itemTitle}>{doc.title}</h3>
          <span className={styles.detailHint}>Open</span>
        </summary>
        <div className={styles.detailBody}>
          {/* Shown as plain text, never rendered as HTML. */}
          <p className={styles.prose}>{doc.content}</p>
        </div>
      </HashDetails>
      <p>
        <a href={`/api/documents/${doc.id}/download`} className="in-btn in-btn--secondary" download>
          Download Markdown<span className="visually-hidden">: {doc.title}</span>
        </a>
      </p>
    </div>
  );
}

export async function DocsContent() {
  const member = await requireMember();
  const now = new Date();
  const db = getDb();
  const [meetings, files, drafts, people] = await Promise.all([
    getAdapters().meetings.listMeetings(MEETING_LIMIT),
    listShares(db, { limit: FILE_LIMIT, withFile: true }),
    listDocuments(db, member.id),
    db.select({ externalId: members.externalId, displayName: members.displayName }).from(members),
  ]);
  const names = new Map(people.map((person) => [person.externalId, firstName(person.displayName)]));
  const ownerName = (externalId: string) => names.get(externalId) ?? 'a member';

  return (
    <div className={styles.sections}>
      <section className={`in-glass ${cardStyles.card}`} aria-labelledby="docs-meetings">
        <h2 id="docs-meetings" className={`in-label ${cardStyles.eyebrow}`}>
          Meeting notes
        </h2>
        {meetings.length === 0 ? (
          <p className={cardStyles.meta}>No meeting notes yet.</p>
        ) : (
          <ul className={cardStyles.rows}>
            {meetings.map((meeting) => (
              <li key={meeting.id}>
                <MeetingNotes meeting={meeting} ownerName={ownerName} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`in-glass ${cardStyles.card}`} aria-labelledby="docs-files">
        <h2 id="docs-files" className={`in-label ${cardStyles.eyebrow}`}>
          Shared files
        </h2>
        {files.length === 0 ? (
          <p className={cardStyles.meta}>No files shared yet. Have something the group should see?</p>
        ) : (
          <ul className={cardStyles.rows}>
            {files.map((share) => (
              <SharedFile key={share.id} share={share} now={now} />
            ))}
          </ul>
        )}
      </section>

      <section className={`in-glass ${cardStyles.card}`} aria-labelledby="docs-drafts">
        <h2 id="docs-drafts" className={`in-label ${cardStyles.eyebrow}`}>
          My drafts
        </h2>
        {drafts.length === 0 ? (
          <p className={cardStyles.meta}>No drafts yet. Want the assistant to draft a one-pager?</p>
        ) : (
          <ul className={cardStyles.rows}>
            {drafts.map((doc) => (
              <li key={doc.id}>
                <Draft doc={doc} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Meeting notes, files members shared, and this member's own assistant drafts. */
