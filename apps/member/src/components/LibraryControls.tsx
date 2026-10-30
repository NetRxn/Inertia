'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { pinLibraryDocument, removeFromLibrary, setLibraryEditors } from '../org/actions';
import { LIBRARY_CATEGORIES } from '../documents/library-categories';
import styles from './OrgControls.module.css';
import libraryStyles from './Library.module.css';

/** Adds a key document: a PDF or image, or a link (Google Docs, Notion, a website). */
export function AddToLibrary() {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setMessage(null);
    start(async () => {
      const response = await fetch('/api/library', { method: 'POST', body: data });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "Couldn't add that. Try again?");
        return;
      }
      form.current?.reset();
      setMessage('Added to the library.');
      router.refresh();
    });
  }

  return (
    <details>
      <summary className="in-btn in-btn--secondary">Add a document</summary>
      <form ref={form} className={styles.stack} onSubmit={submit} style={{ marginTop: 'var(--space-3)' }}>
        <div className={styles.row}>
          <input className={styles.input} name="title" aria-label="Title" placeholder="Title, e.g. Riverside Commons one-pager" maxLength={200} required />
          <select className={styles.input} name="category" aria-label="Category" defaultValue="one-pager">
            {LIBRARY_CATEGORIES.map((c) => <option key={c.category} value={c.category}>{c.label}</option>)}
          </select>
        </div>
        <input className={styles.input} name="description" aria-label="Description" placeholder="What it is, in a line (optional)" maxLength={600} />
        <input className={styles.input} name="link" aria-label="Link" placeholder="A link (Google Docs, Notion, a web page)…" inputMode="url" />
        <label className={styles.meta}>
          …or a file (PDF or image, up to 10 MB): <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" />
        </label>
        <div className={styles.row}>
          <button className="in-btn in-btn--primary" disabled={pending}>{pending ? 'Adding…' : 'Add to the library'}</button>
          {message && <p className={styles.notice} role="status">{message}</p>}
        </div>
      </form>
    </details>
  );
}

/** Pin or remove, for whoever may edit the library. */
export function LibraryItemControls({ id, pinned }: { id: string; pinned: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const result = await action();
      setError(result.ok ? null : result.error ?? 'Try again?');
      if (result.ok) router.refresh();
    });
  return (
    <div className={libraryStyles.controls}>
      <button type="button" className="in-btn in-btn--quiet" disabled={pending} onClick={() => run(() => pinLibraryDocument(id, !pinned))}>{pinned ? 'Unpin' : 'Pin'}</button>
      <button type="button" className="in-btn in-btn--quiet" disabled={pending} onClick={() => run(() => removeFromLibrary(id))}>Remove</button>
      {error && <p className={styles.notice} role="alert">{error}</p>}
    </div>
  );
}

/** Admins only, or every member, may add to the library. */
export function LibraryEditorsSetting({ editors }: { editors: 'admins' | 'members' }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className={styles.stack}>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={editors === 'members'}
          disabled={pending}
          onChange={(e) => start(async () => {
            const result = await setLibraryEditors(e.target.checked ? 'members' : 'admins');
            setMessage(result.ok ? result.message ?? null : result.error);
            if (result.ok) router.refresh();
          })}
        />
        Every member can add documents to the library
      </label>
      <p className={styles.meta}>Off: only admins add, pin and remove key documents. Everyone can always read them.</p>
      {message && <p className={styles.notice} role="status">{message}</p>}
    </div>
  );
}
