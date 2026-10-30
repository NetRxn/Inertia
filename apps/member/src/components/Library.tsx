import type { LibraryDocument } from '../documents/library';
import { LIBRARY_CATEGORIES } from '../documents/library-categories';
import { AddToLibrary, LibraryItemControls } from './LibraryControls';
import cardStyles from './cards/cards.module.css';
import styles from './Library.module.css';

const DOC_GLYPH = <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12.5h6M9 16.5h6" /></>;
const LINK_GLYPH = <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>;

function Doc({ doc, canEdit }: { doc: LibraryDocument; canEdit: boolean }) {
  const href = doc.fileId ? `/api/files/${doc.fileId}` : doc.linkUrl!;
  const external = !doc.fileId;
  return (
    <li className={styles.doc} data-pinned={doc.pinned ? '' : undefined} id={`library-${doc.id}`}>
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{doc.fileId ? DOC_GLYPH : LINK_GLYPH}</svg>
      <a className={styles.title} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {doc.title}
      </a>
      {doc.description ? <p className={cardStyles.meta}>{doc.description}</p> : null}
      <p className={cardStyles.meta}>
        {doc.pinned ? 'Pinned · ' : ''}
        {doc.fileName ?? (() => { try { return new URL(doc.linkUrl!).hostname; } catch { return 'Link'; } })()}
      </p>
      {canEdit ? <LibraryItemControls id={doc.id} pinned={doc.pinned} /> : null}
    </li>
  );
}

/** The organization's key documents by shelf, readable by every member. */
export function Library({ documents, canEdit }: { documents: LibraryDocument[]; canEdit: boolean }) {
  const shelves = LIBRARY_CATEGORIES.map((c) => ({ ...c, docs: documents.filter((d) => d.category === c.category) })).filter((c) => c.docs.length);
  return (
    <section className={`in-glass in-tex in-tex--stars ${cardStyles.card}`} aria-labelledby="docs-library">
      <h2 id="docs-library" className={`in-label ${cardStyles.eyebrowMoss}`}>Library</h2>
      {shelves.length === 0 ? (
        <p className={cardStyles.meta}>
          Key documents everyone can find: one-pagers, policies, brand files.{canEdit ? ' Add the first one.' : ' An admin can add them.'}
        </p>
      ) : (
        shelves.map((shelf) => (
          <div key={shelf.category} className={styles.category}>
            <h3 className={`in-label ${cardStyles.eyebrow}`}>{shelf.label}</h3>
            <ul className={styles.grid}>
              {shelf.docs.map((doc) => <Doc key={doc.id} doc={doc} canEdit={canEdit} />)}
            </ul>
          </div>
        ))
      )}
      {canEdit ? <AddToLibrary /> : null}
    </section>
  );
}
