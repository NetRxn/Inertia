'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import type { SourceRef } from '../adapters/types';
import type { ChatMetadata } from '../assistant/chat-handler';
import styles from './ChatSheet.module.css';

type ChatMessage = UIMessage<ChatMetadata>;

const DRAG_TO_CLOSE_PX = 80;

/** Where a source chip leads: the page that shows that kind of record. */
function sourceHref(ref: SourceRef): string | null {
  switch (ref.kind) {
    case 'meeting':
      return `/docs#meeting-${ref.id}`;
    case 'proposal':
      return ref.url ?? '/votes';
    case 'task':
    case 'initiative':
      return '/work';
    case 'share':
      return '/work?tab=ideas';
    case 'document':
      return `/docs#doc-${ref.id}`;
    case 'event':
      return '/calendar';
    case 'opportunity':
      return `/funding#opportunity-${ref.id}`;
    case 'application':
      return `/funding#application-${ref.id}`;
    case 'chat':
      return null;
  }
}

function SourceChips({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) return null;
  return (
    <ul className={styles.chips} aria-label="Sources">
      {sources.map((ref) => {
        const href = sourceHref(ref);
        const external = href?.startsWith('http');
        return (
          <li key={`${ref.kind}:${ref.id}`}>
            {href ? (
              <a
                className={styles.chip}
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                <span className={styles.chipKind}>{ref.kind}</span> {ref.title}
              </a>
            ) : (
              <span className={styles.chip}>
                <span className={styles.chipKind}>{ref.kind}</span> {ref.title}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The server's JSON error, or a friendly fallback. */
function errorText(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // Not JSON: fall through.
  }
  return "Couldn't reach the assistant. Try again?";
}

/**
 * The chat, sliding up over the page. Drag the handle down (or tap it) to put
 * it away. Assistant messages carry source chips for what the answer drew on.
 */
export function ChatSheet({
  open,
  onClose,
  pendingQuestion,
  onQuestionSent,
}: {
  open: boolean;
  onClose: () => void;
  pendingQuestion: string | null;
  onQuestionSent: () => void;
}) {
  const conversationId = useRef<string | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const listEnd = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat<ChatMessage>({
    transport: new DefaultChatTransport<ChatMessage>({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages }) => {
        const last = messages[messages.length - 1];
        const message = last.parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
        return { body: { conversationId: conversationId.current, message } };
      },
    }),
    onFinish: ({ message }) => {
      if (message.metadata?.conversationId) conversationId.current = message.metadata.conversationId;
    },
  });

  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (open && pendingQuestion && !busy) {
      void sendMessage({ text: pendingQuestion });
      onQuestionSent();
    }
  }, [open, pendingQuestion, busy, sendMessage, onQuestionSent]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' });
  }, [messages, status]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    void sendMessage({ text });
    setDraft('');
  }

  function onPointerDown(event: React.PointerEvent) {
    dragStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, event.clientY - dragStart.current));
  }

  function onPointerUp() {
    if (dragStart.current === null) return;
    const dragged = dragY;
    dragStart.current = null;
    setDragY(0);
    if (dragged > DRAG_TO_CLOSE_PX) onClose();
  }

  return (
    <div className={styles.scrim}>
      <section
        className={`in-glass ${styles.sheet}`}
        role="dialog"
        aria-modal="true"
        aria-label="Chat"
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <button
          type="button"
          className={styles.handle}
          aria-label="Close chat"
          onClick={() => {
            if (dragY === 0) onClose();
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className={styles.grip} aria-hidden="true" />
        </button>

        <div className={styles.log} aria-live="polite">
          {messages.length === 0 ? (
            <p className={styles.hello}>Ask about meetings, votes, work or anything members have shared.</p>
          ) : null}
          {messages.map((message) => {
            const text = message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
            if (!text && message.role === 'assistant') return null;
            return (
              <div
                key={message.id}
                className={message.role === 'user' ? styles.mine : styles.theirs}
                data-role={message.role}
              >
                <p className={styles.text}>{text}</p>
                {message.role === 'assistant' ? <SourceChips sources={message.metadata?.sources ?? []} /> : null}
              </div>
            );
          })}
          {busy ? (
            <p className={styles.thinking}>
              <span className="in-dot" aria-hidden="true" /> Looking through the DAO's records…
            </p>
          ) : null}
          {error ? (
            <p role="alert" className={styles.error}>
              {errorText(error)}
            </p>
          ) : null}
          <div ref={listEnd} />
        </div>

        <form className={styles.composer} onSubmit={submit}>
          <label htmlFor="chat-input" className="visually-hidden">
            Ask the DAO
          </label>
          <input
            id="chat-input"
            className={styles.input}
            placeholder="Ask the DAO anything…"
            maxLength={4000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
            autoComplete="off"
          />
          <button type="submit" className="in-btn in-btn--primary" disabled={busy || !draft.trim()}>
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
