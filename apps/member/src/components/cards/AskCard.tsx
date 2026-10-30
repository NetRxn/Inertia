'use client';

import { askChat } from '../chat-events';
import styles from './cards.module.css';

/**
 * Makes a feed card a question: tapping anywhere that isn't a link or button
 * opens the chat and sends the card's question. Keyboard users get a button.
 */
export function AskCard({ question, children }: { question: string; children: React.ReactNode }) {
  function onClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('a, button, input, textarea, select')) return;
    askChat(question);
  }

  return (
    // The click handler is a convenience; the button below is the accessible control.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className={styles.askable} onClick={onClick}>
      {children}
      <button type="button" className={`visually-hidden ${styles.askButton}`} onClick={() => askChat(question)}>
        Ask: {question}
      </button>
    </div>
  );
}
