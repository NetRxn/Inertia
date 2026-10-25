import { Suspense } from 'react';
import { getAdapters } from '../../../adapters';
import type { Proposal } from '../../../adapters/types';
import { requireMember } from '../../../identity/session';
import { formatDay } from '../../../components/cards/format';
import cardStyles from '../../../components/cards/cards.module.css';
import styles from '../sections.module.css';

const GROUPS: { status: Proposal['status']; label: string; empty: string }[] = [
  { status: 'open', label: 'Open now', empty: 'No votes are open right now.' },
  { status: 'upcoming', label: 'Coming up', empty: 'Nothing is scheduled to open yet.' },
  { status: 'closed', label: 'Closed', empty: 'No votes have closed yet.' },
];

function ProposalRow({ proposal }: { proposal: Proposal }) {
  const when =
    proposal.status === 'upcoming'
      ? `opens ${formatDay(proposal.opensAt)}`
      : `${proposal.status === 'open' ? 'closes' : 'closed'} ${formatDay(proposal.closesAt)}`;
  const linkText =
    proposal.status === 'open'
      ? "Vote in Robert's Rules"
      : proposal.status === 'upcoming'
        ? "See it in Robert's Rules"
        : 'See the result';

  return (
    <li className={cardStyles.stack}>
      <div className={cardStyles.chips}>
        {proposal.status === 'open' ? <span className="in-chip in-chip--tide">Vote open</span> : null}
        <span className="in-mono">{when}</span>
      </div>
      <h3 className={cardStyles.itemTitle}>{proposal.title}</h3>
      {proposal.status === 'upcoming' ? null : (
        <p className="in-mono">
          {proposal.tally.yes} yes · {proposal.tally.no} no · {proposal.tally.abstain} abstain
        </p>
      )}
      <p>
        <a href={proposal.url} className={cardStyles.textLink} target="_blank" rel="noopener noreferrer">
          {linkText}
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      </p>
    </li>
  );
}

async function VotesContent() {
  await requireMember();
  const proposals = await getAdapters().proposals.listProposals();

  return (
    <div className={styles.sections}>
      {GROUPS.map((group) => {
        const rows = proposals.filter((p) => p.status === group.status);
        const headingId = `votes-${group.status}`;
        return (
          <section key={group.status} className={`in-glass ${cardStyles.card}`} aria-labelledby={headingId}>
            <h2 id={headingId} className={`in-label ${cardStyles.eyebrowTide}`}>
              {group.label}
            </h2>
            {rows.length === 0 ? (
              <p className={cardStyles.meta}>{group.empty}</p>
            ) : (
              <ul className={cardStyles.rows}>
                {rows.map((proposal) => (
                  <ProposalRow key={proposal.id} proposal={proposal} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Robert's Rules proposals with their tallies. Read-only: voting happens there. */
export default function VotesPage() {
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Votes</h1>
        <p className={cardStyles.meta}>Proposals in Robert&apos;s Rules. You vote there; this is the picture.</p>
      </header>
      <Suspense fallback={<p className="in-mono">Loading…</p>}>
        <VotesContent />
      </Suspense>
    </>
  );
}
