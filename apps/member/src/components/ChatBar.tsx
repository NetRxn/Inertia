'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChatSheet } from './ChatSheet';
import { ASK_EVENT } from './chat-events';
import styles from './ChatBar.module.css';

/**
 * The bar pinned to the bottom of every member page. Tapping it opens the chat
 * sheet; a feed card's question (sent as an ASK_EVENT) opens it and asks.
 */
export function ChatBar() {
  const [open, setOpen] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  useEffect(() => {
    const onAsk = (event: Event) => {
      setPendingQuestion((event as CustomEvent<string>).detail);
      setOpen(true);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const sent = useCallback(() => setPendingQuestion(null), []);

  return (
    <>
      <div className={styles.dock}>
        <button
          type="button"
          className={`in-glass ${styles.bar}`}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
        >
          <span className="in-dot" aria-hidden="true" />
          <span className={styles.prompt}>Ask the DAO anything…</span>
        </button>
      </div>
      {/* Kept mounted so the conversation survives closing and reopening the sheet. */}
      <ChatSheet open={open} onClose={close} pendingQuestion={pendingQuestion} onQuestionSent={sent} />
    </>
  );
}
