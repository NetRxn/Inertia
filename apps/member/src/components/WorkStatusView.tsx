import Link from 'next/link';
import type { AgentTask, HumanTask } from '../adapters/types';
import { recapSentence, type LaneCounts, type WorkStatus } from '../work/status';
import cardStyles from './cards/cards.module.css';
import styles from './WorkStatusView.module.css';

const AGENT_STATUS: Record<AgentTask['status'], string> = { queued: 'Queued', running: 'Working', blocked: 'Blocked', done: 'Done' };
const PERSON_STATUS: Record<HumanTask['status'], string> = { open: 'Open to claim', claimed: 'Claimed', done: 'Done' };

function Counts({ counts, labels }: { counts: LaneCounts; labels: [string, string, string] }) {
  return (
    <p className={styles.counts}>
      <span>{counts.open} {labels[0]}</span> · <span>{counts.inProgress} {labels[1]}</span> · <span>{counts.done} {labels[2]}</span>
    </p>
  );
}

/**
 * The status tracker: a recap of both sides, then each initiative with its
 * people lane and its agent lane side by side, at the same weight.
 */
export function WorkStatusView({ status, nameOf, memberExternalId }: { status: WorkStatus; nameOf: Record<string, string>; memberExternalId: string }) {
  return (
    <div className={cardStyles.feed}>
      <section className={`in-glass in-tex in-tex--stars ${cardStyles.card}`} aria-label="Recap">
        <h2 className={`in-label ${cardStyles.eyebrow}`}>Recap</h2>
        <p className={styles.recap}>{recapSentence(status.recap)}</p>
        <div className={styles.tiles}>
          <div><b>{status.recap.waitingOnPeople}</b><span>waiting on people</span></div>
          <div><b>{status.recap.peopleDoneThisWeek}</b><span>done by members this week</span></div>
          <div><b>{status.recap.agentsWorking}</b><span>agents working</span></div>
          <div><b>{status.recap.agentsDoneThisWeek}</b><span>done by agents this week</span></div>
        </div>
        {status.engine && <p className={cardStyles.meta}>Agent work runs in {status.engine.url ? <a href={status.engine.url} target="_blank" rel="noopener noreferrer">{status.engine.name}</a> : status.engine.name}.</p>}
      </section>

      {status.initiatives.filter((g) => g.people.length || g.agents.length).map(({ initiative, people, agents, peopleCounts, agentCounts }) => (
        <section key={initiative.id || 'other'} className={`in-glass ${cardStyles.card}`} aria-label={initiative.title}>
          <h2 className={cardStyles.itemTitle}>
            {initiative.title}{' '}
            {initiative.statusLabel && <span className="in-chip in-chip--pollen">{initiative.statusLabel}</span>}
          </h2>
          <div className={styles.lanes}>
            <div className={styles.lane}>
              <h3 className={`in-label ${cardStyles.eyebrowMoss}`}>People</h3>
              <Counts counts={peopleCounts} labels={['open', 'claimed', 'done']} />
              {people.length === 0 ? (
                <p className={cardStyles.meta}>Nothing needs a person here yet.</p>
              ) : (
                <ul className={styles.items}>
                  {people.map((t) => (
                    <li key={t.id} data-status={t.status}>
                      <span>{t.title}</span>
                      <span className={cardStyles.meta}>
                        {PERSON_STATUS[t.status]}
                        {t.claimedBy ? ` · ${t.claimedBy === memberExternalId ? 'you' : nameOf[t.claimedBy] ?? 'a member'}` : ''}
                        {t.status === 'open' && t.estimateMinutes ? ` · ~${t.estimateMinutes} min` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {peopleCounts.open > 0 && <Link className="in-btn in-btn--quiet" href="/work?tab=needs-person">See what you could take</Link>}
            </div>
            <div className={styles.lane}>
              <h3 className={`in-label ${cardStyles.eyebrowTide}`}>Agents</h3>
              <Counts counts={agentCounts} labels={['queued', 'working', 'done']} />
              {agents.length === 0 ? (
                <p className={cardStyles.meta}>No agent work here yet.</p>
              ) : (
                <ul className={styles.items}>
                  {agents.map((t) => (
                    <li key={t.id} data-status={t.status}>
                      <span>{t.url ? <a href={t.url} target="_blank" rel="noopener noreferrer">{t.title}</a> : t.title}</span>
                      <span className={cardStyles.meta}>{AGENT_STATUS[t.status]}{t.agentName ? ` · ${t.agentName}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ))}
      {(() => {
        const quiet = status.initiatives.filter((g) => g.initiative.id && !g.people.length && !g.agents.length);
        return quiet.length ? <p className={cardStyles.meta}>No work yet: {quiet.map((g) => g.initiative.title).join(', ')}.</p> : null;
      })()}
    </div>
  );
}
