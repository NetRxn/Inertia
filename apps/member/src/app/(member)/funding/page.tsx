import { Suspense } from 'react';
import { getAdapters } from '../../../adapters';
import type { FundingApplication, FundingOpportunity } from '../../../adapters/types';
import { requireMember } from '../../../identity/session';
import { formatDay } from '../../../components/cards/format';
import { ACTIONABLE_ROUTES, deadlineLabel, deadlineTime, ROUTE_LABELS, safeHttpUrl } from '../../../funding/funding';
import cardStyles from '../../../components/cards/cards.module.css';
import styles from '../sections.module.css';

const STAGE_LABELS: Record<FundingApplication['stage'], string> = {
  drafting: 'Agents drafting',
  'agent-review': 'Agent review',
  'needs-members': 'Needs members',
  ready: 'Ready to confirm',
  submitted: 'Submitted',
};

function ApplicationRow({ application, program }: { application: FundingApplication; program: string | undefined }) {
  const packetUrl = safeHttpUrl(application.packetUrl);
  return (
    <li id={`application-${application.id}`} className={`${cardStyles.stack} ${styles.target}`}>
      <div className={cardStyles.chips}>
        <span className={`in-chip ${application.stage === 'needs-members' ? 'in-chip--signal' : 'in-chip--tide'}`}>
          {STAGE_LABELS[application.stage]}
        </span>
        {application.readiness ? (
          <span className="in-mono">
            {application.readiness.answered} of {application.readiness.total} answered
          </span>
        ) : null}
      </div>
      <h3 className={cardStyles.itemTitle}>{application.title}</h3>
      {program ? <p className={cardStyles.meta}>For {program}</p> : null}
      {application.decisionsNeeded.length > 0 ? (
        <ul className={styles.list}>
          {application.decisionsNeeded.map((decision) => (
            <li key={decision.id}>
              {decision.question} <span className="in-mono">· blocks {decision.blocks}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {application.submittedAt ? <p className="in-mono">submitted {formatDay(application.submittedAt)}</p> : null}
      {packetUrl ? (
        <p>
          <a href={packetUrl} className={cardStyles.textLink} target="_blank" rel="noopener noreferrer">
            Review the packet
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </p>
      ) : application.stage === 'needs-members' || application.stage === 'ready' ? (
        <p className={cardStyles.meta}>Members confirm the exact packet in the funding system. That step isn&apos;t connected here yet.</p>
      ) : null}
    </li>
  );
}

function OpportunityRow({ opportunity, application }: { opportunity: FundingOpportunity; application?: FundingApplication }) {
  const sourceUrl = safeHttpUrl(opportunity.sourceUrl);
  return (
    <li id={`opportunity-${opportunity.id}`} className={`${cardStyles.stack} ${styles.target}`}>
      <div className={cardStyles.chips}>
        <span className="in-chip in-chip--moss">{ROUTE_LABELS[opportunity.route]}</span>
        <span className="in-mono">{deadlineLabel(opportunity.deadline)}</span>
      </div>
      <h3 className={cardStyles.itemTitle}>{opportunity.program}</h3>
      <p className={cardStyles.meta}>{opportunity.sponsor}</p>
      <p>{opportunity.summary}</p>
      {opportunity.benefit || opportunity.effort ? (
        <p className="in-mono">{[opportunity.benefit, opportunity.effort && `effort · ${opportunity.effort}`].filter(Boolean).join(' · ')}</p>
      ) : null}
      <p>
        <b>Next step:</b> {opportunity.nextStep}
      </p>
      <p className={cardStyles.chips}>
        {sourceUrl ? (
          <a href={sourceUrl} className={cardStyles.textLink} target="_blank" rel="noopener noreferrer">
            Official page
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        ) : null}
        <span className="in-mono">checked {formatDay(opportunity.observedAt)}</span>
        {application ? (
          <a href={`#application-${application.id}`} className={cardStyles.textLink}>
            See the application
          </a>
        ) : null}
      </p>
    </li>
  );
}

function Group({ id, label, empty, children }: { id: string; label: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className={`in-glass ${cardStyles.card}`} aria-labelledby={id}>
      <h2 id={id} className={`in-label ${cardStyles.eyebrowMoss}`}>
        {label}
      </h2>
      {children.length === 0 ? <p className={cardStyles.meta}>{empty}</p> : <ul className={cardStyles.rows}>{children}</ul>}
    </section>
  );
}

async function FundingContent() {
  await requireMember();
  // After the dynamic access above, so the page keeps a static shell.
  const now = new Date();
  const adapters = getAdapters();
  const [opportunities, applications] = await Promise.all([
    adapters.funding.listOpportunities(),
    adapters.funding.listApplications(),
  ]);

  const programs = new Map(opportunities.map((o) => [o.id, o.program]));
  const applicationFor = new Map(applications.map((a) => [a.opportunityId, a]));
  const due = (o: FundingOpportunity) => deadlineTime(o.deadline) ?? Number.POSITIVE_INFINITY;
  const isOpen = (o: FundingOpportunity) => due(o) >= now.getTime();

  const waiting = applications.filter((a) => a.stage === 'needs-members');
  const inProgress = applications.filter((a) => a.stage !== 'needs-members' && a.stage !== 'submitted');
  const submitted = applications.filter((a) => a.stage === 'submitted');
  const applyNow = opportunities
    .filter((o) => ACTIONABLE_ROUTES.includes(o.route) && isOpen(o))
    .sort((a, b) => due(a) - due(b));
  const later = opportunities.filter((o) => !applyNow.includes(o));

  const applicationRows = (rows: FundingApplication[]) =>
    rows.map((a) => <ApplicationRow key={a.id} application={a} program={programs.get(a.opportunityId)} />);
  const opportunityRows = (rows: FundingOpportunity[]) =>
    rows.map((o) => <OpportunityRow key={o.id} opportunity={o} application={applicationFor.get(o.id)} />);

  return (
    <div className={styles.sections}>
      <Group id="funding-waiting" label="Waiting for members" empty="No application is waiting on members right now.">
        {applicationRows(waiting)}
      </Group>
      <Group id="funding-apply" label="Apply now" empty="Nothing the DAO can apply for right now.">
        {opportunityRows(applyNow)}
      </Group>
      <Group id="funding-progress" label="Applications in progress" empty="No other applications are being prepared.">
        {applicationRows(inProgress)}
      </Group>
      <Group id="funding-later" label="Later and ongoing" empty="Nothing to watch yet.">
        {opportunityRows(later)}
      </Group>
      {submitted.length > 0 ? (
        <Group id="funding-submitted" label="Submitted" empty="">
          {applicationRows(submitted)}
        </Group>
      ) : null}
    </div>
  );
}

/** The grant finder's results. Read-only: agents prepare, members confirm in the funding system. */
export default function FundingPage() {
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Funding</h1>
        <p className={cardStyles.meta}>
          Grants and other funding the DAO&apos;s agents have found and checked at the official source, and the
          applications they&apos;re preparing.
        </p>
      </header>
      <Suspense fallback={<p className="in-mono">Loading…</p>}>
        <FundingContent />
      </Suspense>
    </>
  );
}
