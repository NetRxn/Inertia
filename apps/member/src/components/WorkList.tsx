'use client';

import { useState } from 'react';
import type { HumanTask, Initiative, TaskKind } from '../adapters/types';
import { claimTask } from '../work/claim';
import { formatDay } from './cards/format';
import styles from './cards/cards.module.css';

// One outline glyph per kind of ask, drawn in the signal hue: a human is needed.
const KIND_GLYPHS: Record<TaskKind, React.ReactNode> = {
  creative: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v.2h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
    </>
  ),
  outreach: <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  review: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'real-world': (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
};

const KIND_LABELS: Record<TaskKind, string> = {
  creative: 'creative',
  outreach: 'outreach',
  review: 'review',
  'real-world': 'real world',
};

function TaskCard({ task, isClaimedByCurrentMember }: { task: HumanTask; isClaimedByCurrentMember: boolean }) {
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleClaim() {
    setClaiming(true);
    try {
      const result = await claimTask(task.id);
      setMessage(result.message);
      setIsSuccess(result.ok);
    } catch (error) {
      // Action call itself rejected - show retry message
      setMessage("Couldn't reach the task system. Try again.");
      setIsSuccess(false);
    } finally {
      setClaiming(false);
    }
  }

  // Disable button on success or terminal failures (already-claimed, not-found)
  // Keep enabled after retry message so "Try again" can be retried
  const isTerminalFailure = message === 'Someone already took this.' || message === 'This task is no longer available.';
  const shouldDisable = claiming || isSuccess || isTerminalFailure;

  return (
    <div className={`in-ask in-glass in-tex in-tex--orbits ${styles.ask}`}>
      <div className="in-ask__head">
        <span className="in-dot" aria-hidden="true" />
        <h3 className="in-ask__title">{task.title}</h3>
        {isClaimedByCurrentMember ? (
          <span className="in-chip in-chip--moss">Yours</span>
        ) : task.estimateMinutes ? (
          <span className="in-chip in-chip--signal">~{task.estimateMinutes} min</span>
        ) : null}
      </div>

      <div className="in-ask__body">
        <span className="in-gicon in-gicon--signal in-gicon--sm" aria-hidden="true">
          <svg viewBox="0 0 24 24">{KIND_GLYPHS[task.kind]}</svg>
        </span>
        <div>
          <p className="in-ask__why">{task.prepared}</p>
        </div>
      </div>

      <div className="in-ask__ctx in-mono">
        <span>
          kind · <b>{KIND_LABELS[task.kind]}</b>
        </span>
        {task.estimateMinutes ? (
          <span>
            rough time · <b>~{task.estimateMinutes} min</b>
          </span>
        ) : null}
        {task.due ? (
          <span>
            due · <b>{formatDay(task.due)}</b>
          </span>
        ) : null}
      </div>

      <p role="status" className={`${styles.meta} ${styles.messageStatus}`}>
        {message}
      </p>

      {!isClaimedByCurrentMember && (
        <div className="in-ask__actions">
          <button
            onClick={handleClaim}
            disabled={shouldDisable}
            className="in-btn in-btn--secondary"
          >
            {claiming ? 'Taking it…' : "I'll take it"}
          </button>
        </div>
      )}
    </div>
  );
}

interface InitiativeGroup {
  initiative: Initiative;
  tasks: HumanTask[];
}

export function WorkList({
  initiatives,
  tasks,
  memberExternalId,
}: {
  initiatives: Initiative[];
  tasks: HumanTask[];
  memberExternalId: string;
}) {
  // Group tasks by initiative (filtering is done server-side)
  const groups: InitiativeGroup[] = initiatives
    .map((initiative) => ({
      initiative,
      tasks: tasks.filter((t) => t.initiativeId === initiative.id),
    }))
    .filter((g) => g.tasks.length > 0);

  if (groups.length === 0) {
    return (
      <section className={`in-glass in-tex in-tex--stars ${styles.card}`} aria-labelledby="empty-work">
        <p id="empty-work" className={styles.meta}>
          Nothing needs a person right now. Have an idea for what should come next?
        </p>
      </section>
    );
  }

  return (
    <div className={styles.feed}>
      {groups.map(({ initiative, tasks: groupTasks }) => (
        <section key={initiative.id} className={`in-glass in-tex in-tex--stars ${styles.card}`}>
          <h2 className={`in-label ${styles.eyebrowMoss}`}>{initiative.title}</h2>
          <div className={styles.feed}>
            {groupTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isClaimedByCurrentMember={task.claimedBy === memberExternalId}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
