'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ShareKind } from '../shares/shares';
import styles from './ShareComposer.module.css';

const KIND_OPTIONS: { value: ShareKind; label: string }[] = [
  { value: 'idea', label: 'New idea' },
  { value: 'resource', label: 'Resource' },
  { value: 'event', label: 'Event' },
  { value: 'update', label: 'Update' },
];

function hostname(link: string): string | null {
  try {
    return new URL(link).hostname;
  } catch {
    return null;
  }
}

/**
 * The ＋ Share button that floats above the chat bar on the Work tab, and the
 * full-screen composer it opens: a kind, a link, an image or file, and words.
 */
export function ShareComposer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ShareKind>('idea');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const hasContent = description.trim() !== '' || link.trim() !== '' || attachment !== null;
  const site = link.trim() ? hostname(link.trim()) : null;

  function close() {
    setOpen(false);
    setMessage(null);
  }

  function reset() {
    setKind('idea');
    setDescription('');
    setLink('');
    setAttachment(null);
    if (imageInput.current) imageInput.current.value = '';
    if (fileInput.current) fileInput.current.value = '';
  }

  function pickAttachment(file: File | null) {
    setAttachment(file);
    setMessage(null);
  }

  async function post() {
    setPosting(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set('kind', kind);
      form.set('description', description);
      if (link.trim()) form.set('link', link.trim());
      if (attachment) form.set('file', attachment);

      const response = await fetch('/api/shares', { method: 'POST', body: form });
      if (response.ok) {
        close();
        reset();
        router.refresh();
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? 'That did not save — try again?');
    } catch {
      setMessage('That did not save — try again?');
    } finally {
      setPosting(false);
    }
  }

  return (
    <>
      <button type="button" className={styles.fab} onClick={() => setOpen(true)}>
        ＋ Share
      </button>

      {open ? (
        <div className={styles.overlay}>
          <div className={styles.inner} role="dialog" aria-modal="true" aria-label="Share">
            <div className={styles.head}>
              <button type="button" className="in-btn in-btn--quiet" onClick={close} autoFocus>
                Close
              </button>
              <h2 className={styles.title}>Share</h2>
              <button
                type="button"
                className="in-btn in-btn--primary"
                onClick={post}
                disabled={posting || !hasContent}
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>

            <div className={styles.kinds} role="group" aria-label="Share type">
              {KIND_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={styles.kindChip}
                  aria-pressed={kind === option.value}
                  onClick={() => setKind(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className={styles.canvas}>
              <p className={styles.hint}>Paste a link, add a photo, or just write. Anything goes.</p>

              <div className={styles.field}>
                <label htmlFor="share-link" className={styles.label}>
                  Link
                </label>
                <input
                  id="share-link"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  className={styles.input}
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                />
                {site ? <p className={styles.site}>Links to {site}</p> : null}
              </div>

              <div className={styles.field}>
                <label htmlFor="share-description" className={styles.label}>
                  Description
                </label>
                <textarea
                  id="share-description"
                  className={styles.description}
                  placeholder="What should we know?"
                  maxLength={2000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <div className={styles.addRow}>
                <input
                  ref={imageInput}
                  id="share-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className={styles.hiddenInput}
                  onChange={(event) => pickAttachment(event.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className="in-btn in-btn--secondary"
                  onClick={() => imageInput.current?.click()}
                >
                  Image
                </button>
                <input
                  ref={fileInput}
                  id="share-file"
                  type="file"
                  accept="application/pdf"
                  className={styles.hiddenInput}
                  onChange={(event) => pickAttachment(event.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className="in-btn in-btn--secondary"
                  onClick={() => fileInput.current?.click()}
                >
                  File
                </button>
              </div>
              {attachment ? <p className={styles.site}>{attachment.name}</p> : null}
            </div>

            {message ? (
              <p role="status" className={styles.message}>
                {message}
              </p>
            ) : null}

            <p className={styles.footer}>Shared with all members.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** The Delete action an author sees on their own posts. */
export function DeleteShareButton({ shareId }: { shareId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      const response = await fetch(`/api/shares?id=${encodeURIComponent(shareId)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="in-btn in-btn--quiet" onClick={handleDelete} disabled={busy}>
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  );
}
