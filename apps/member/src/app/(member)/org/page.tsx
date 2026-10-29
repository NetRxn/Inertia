import { Suspense, use } from 'react';
import Link from 'next/link';
import { getDb } from '../../../db/client';
import { requireMember } from '../../../identity/session';
import { listSources } from '../../../org/ingest';
import { isAdmin, listMembers } from '../../../org/members';
import { getOrganization } from '../../../org/organization';
import { sourcesSearchedForWork } from '../../../work/suggest';
import type { Citation, ProfileLine } from '../../../org/profile-types';
import {
  FindWork,
  GovernanceToggle,
  InitiativeChoice,
  InviteMember,
  OrganizationBasics,
  MemberControls,
  ReadGithub,
  ReadWebsite,
  RedraftProfile,
  SourceVisibility,
} from '../../../components/OrgControls';
import cardStyles from '../../../components/cards/cards.module.css';
import sectionStyles from '../sections.module.css';
import { SectionTabs } from '../../../components/SectionTabs';
import { FundingContent } from './tabs/FundingTab';
import { CalendarContent } from './tabs/CalendarTab';
import { DocsContent } from './tabs/DocsTab';
import { VotesContent } from './tabs/GovernanceTab';
import { ProfileContent } from './tabs/MyProfileTab';
import styles from './org.module.css';

// Allow blocking route for searchParams access.
export const instant = false;

type Tab = 'overview' | 'people' | 'funding' | 'governance' | 'calendar' | 'docs' | 'data' | 'settings';
const TABS: { tab: Tab; label: string; intro: string; adminOnly?: boolean }[] = [
  { tab: 'overview', label: 'Overview', intro: 'Who we are and what we’re working on.' },
  { tab: 'people', label: 'People', intro: 'Everyone here, and your own profile.' },
  { tab: 'funding', label: 'Funding', intro: 'Grants the agents found and checked at the official source, and the applications they’re preparing.' },
  { tab: 'governance', label: 'Governance', intro: 'How the organization decides.' },
  { tab: 'calendar', label: 'Calendar', intro: 'What’s coming up.' },
  { tab: 'docs', label: 'Docs', intro: 'Meeting notes, shared files and your drafts.' },
  { tab: 'data', label: 'Data', intro: 'Everything Inertia has read, and where it came from.' },
  { tab: 'settings', label: 'Settings', intro: 'Name, governance, the library and setup.', adminOnly: true },
];
// Old tab names from links and bookmarks.
const ALIASES: Record<string, Tab> = { profile: 'overview', members: 'people', integrations: 'data' };

function Sources({ citations }: { citations: Citation[] }) {
  const titles = Array.from(new Set(citations.map((c) => c.title)));
  return titles.length ? <span className={styles.sources}>From {titles.join(', ')}</span> : null;
}

function Lines({ title, lines }: { title: string; lines: ProfileLine[] }) {
  if (!lines.length) return null;
  return (
    <section className={`in-glass ${cardStyles.card}`}>
      <h2 className={`in-label ${cardStyles.eyebrow}`}>{title}</h2>
      <ul className={cardStyles.rows}>
        {lines.map((l) => (
          <li key={l.id}>
            <p className={cardStyles.body}>{l.text}</p>
            <Sources citations={l.citations} />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function OverviewTab({ admin }: { admin: boolean }) {
  const org = await getOrganization(getDb());
  if (!org?.profile) {
    return (
      <section className={`in-glass ${cardStyles.card}`}>
        <p>Inertia hasn&apos;t drafted a profile yet.</p>
        {admin ? <Link className="in-btn in-btn--primary" href="/setup">Tell Inertia about the organization</Link> : <p className={cardStyles.meta}>An admin can start it from setup.</p>}
      </section>
    );
  }
  const { profile } = org;
  const initiatives = profile.initiatives.filter((i) => admin || i.status === 'accepted');
  return (
    <div className={cardStyles.feed}>
      {profile.mission && (
        <section className={`in-glass in-tex in-tex--stars ${cardStyles.card}`}>
          <p className={styles.mission}>{profile.mission.text}</p>
          <Sources citations={profile.mission.citations} />
          {org.website && <a className={cardStyles.meta} href={org.website} target="_blank" rel="noopener noreferrer">{org.website}</a>}
        </section>
      )}
      <section className={`in-glass ${cardStyles.card}`}>
        <h2 className={`in-label ${cardStyles.eyebrow}`}>Initiatives</h2>
        <ul className={cardStyles.rows}>
          {initiatives.map((i) => (
            <li key={i.id} className={styles.initiative} data-status={i.status}>
              <div>
                <p className={cardStyles.itemTitle}>
                  {i.title}{' '}
                  {i.status === 'accepted' && <span className={`in-chip ${i.adopted ? 'in-chip--moss' : 'in-chip--pollen'}`}>{i.adopted ? 'Active' : 'Proposed · awaiting a vote'}</span>}
                  {i.status === 'proposed' && <span className="in-chip in-chip--tide">Suggested</span>}
                </p>
                {i.summary && <p className={cardStyles.meta}>{i.summary}</p>}
                <Sources citations={i.citations} />
              </div>
              {admin && <InitiativeChoice id={i.id} status={i.status} adopted={i.adopted} governance={org.governanceEnabled} />}
            </li>
          ))}
        </ul>
      </section>
      <Lines title="What we do" lines={profile.programs} />
      <Lines title="Lately" lines={profile.recent} />
      {admin && <RedraftProfile />}
      {org.profileGeneratedAt && <p className={cardStyles.meta}>Drafted {org.profileGeneratedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} from what members shared.</p>}
    </div>
  );
}

async function PeopleTab({ admin, selfId }: { admin: boolean; selfId: string }) {
  const [rows, org] = await Promise.all([listMembers(getDb()).then((all) => all.filter((m) => m.status === 'active')), getOrganization(getDb())]);
  return (
    <div className={cardStyles.feed}>
      <div id="me">
        <ProfileContent />
      </div>
      {admin && (
        <section className={`in-glass ${cardStyles.card}`}>
          <h2 className={`in-label ${cardStyles.eyebrow}`}>Add someone</h2>
          <InviteMember />
          <p className={cardStyles.meta}>Inertia gives you a one-time sign-in link to send them. It doesn&apos;t email anyone yet.</p>
        </section>
      )}
      <section className={`in-glass ${cardStyles.card}`}>
        <h2 className={`in-label ${cardStyles.eyebrow}`}>{rows.length} member{rows.length === 1 ? '' : 's'}</h2>
        <ul className={cardStyles.rows}>
          {rows.map((m) => (
            <li key={m.id} className={styles.member}>
              <div>
                <p className={cardStyles.itemTitle}>{m.displayName} {m.role === 'admin' && <span className="in-chip in-chip--signal">Admin</span>}</p>
                {admin && <p className={cardStyles.meta}>{m.email}{m.workUserId ? ' · linked to Paperclip' : ''}</p>}
              </div>
              {admin && <MemberControls id={m.id} role={m.role} workUserId={m.workUserId} isSelf={m.id === selfId} />}
            </li>
          ))}
        </ul>
      </section>
      <Lines title="Mentioned in what Inertia read" lines={org?.profile?.people ?? []} />
    </div>
  );
}

function GovernanceTab() {
  return (
    <div className={cardStyles.feed}>
      <section className={`in-glass ${cardStyles.card}`}>
        <h2 className={`in-label ${cardStyles.eyebrowTide}`}>Coming with Vocdoni</h2>
        <p className={cardStyles.body}>Proposals, votes and the rules your agents follow will live here once Vocdoni is connected. Until then, vote in Robert&apos;s Rules as usual.</p>
      </section>
      <VotesContent />
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { website: 'Website', meeting: 'Meeting', document: 'Document', note: 'Note', 'chat-export': 'Chat', link: 'Link' };

async function DataTab({ admin }: { admin: boolean }) {
  const db = getDb();
  const [sources, org, people, searched] = await Promise.all([listSources(db, { includeHidden: admin }), getOrganization(db), listMembers(db), sourcesSearchedForWork(db)]);
  const nameOf = new Map(people.map((p) => [p.id, p.displayName]));
  return (
    <div className={cardStyles.feed}>
      <section className={`in-glass ${cardStyles.card}`}>
        <h2 className={`in-label ${cardStyles.eyebrow}`}>Add to Inertia</h2>
        <p className={cardStyles.meta}>Add notes, transcripts and links from <Link className={cardStyles.textLink} href="/">Home</Link>.</p>
        {admin && <ReadWebsite current={org?.website ?? null} />}
        {admin && <ReadGithub />}
      </section>
      <section className={`in-glass ${cardStyles.card}`}>
        <h2 className={`in-label ${cardStyles.eyebrow}`}>What Inertia knows · {sources.filter((s) => s.status === 'active').length}</h2>
        <ul className={cardStyles.rows}>
          {sources.map((s) => (
            <li key={s.id} id={`source-${s.id}`} className={styles.member} data-status={s.status}>
              <div>
                <p className={cardStyles.itemTitle}><span className="in-chip in-chip--tide">{KIND_LABEL[s.kind] ?? s.kind}</span> {s.title}</p>
                <p className={cardStyles.meta}>
                  {s.addedBy ? `Added by ${nameOf.get(s.addedBy) ?? 'a member'}` : 'Added during setup'} · {s.createdAt.toLocaleDateString('en-US', { dateStyle: 'medium' })} · {s.passages} passage{s.passages === 1 ? '' : 's'}
                  {s.status === 'hidden' && ` · Hidden: ${s.hiddenReason}`}
                </p>
              </div>
              {admin && (
                <div>
                  {s.status === 'active' && s.kind !== 'website' && <FindWork id={s.id} done={searched.has(s.id)} />}
                  <SourceVisibility id={s.id} hidden={s.status === 'hidden'} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function SettingsTab() {
  const org = await getOrganization(getDb());
  return (
    <div className={cardStyles.feed}>
      <section className={`in-glass ${cardStyles.card}`}>
        <h2 className={`in-label ${cardStyles.eyebrow}`}>Organization</h2>
        <OrganizationBasics name={org?.name ?? ''} website={org?.website ?? ''} />
      </section>
      <section className={`in-glass ${cardStyles.card}`}>
        <h2 className={`in-label ${cardStyles.eyebrow}`}>Governance</h2>
        <GovernanceToggle enabled={org?.governanceEnabled ?? false} />
      </section>
      <section className={`in-glass ${cardStyles.card}`}>
        <h2 className={`in-label ${cardStyles.eyebrow}`}>Setup</h2>
        <Link className="in-btn in-btn--secondary" href="/setup">Revisit the setup conversation</Link>
      </section>
    </div>
  );
}

async function OrgContent({ tab }: { tab: Tab }) {
  const member = await requireMember();
  const admin = isAdmin(member);
  const org = await getOrganization(getDb());
  const shown = TABS.filter((t) => admin || !t.adminOnly);
  const current = shown.find((t) => t.tab === tab) ?? shown[0];
  return (
    <>
      <header className={sectionStyles.header}>
        <h1 className={sectionStyles.title}>{org?.name ?? 'Organization'}</h1>
        <p className={cardStyles.meta}>{current.intro}</p>
      </header>
      <SectionTabs
        label="Organization sections"
        tabs={shown.map((t) => ({ href: t.tab === 'overview' ? '/org' : `/org?tab=${t.tab}`, label: t.label, current: t.tab === current.tab }))}
      />
      {current.tab === 'overview' && <OverviewTab admin={admin} />}
      {current.tab === 'people' && <PeopleTab admin={admin} selfId={member.id} />}
      {current.tab === 'funding' && <FundingContent />}
      {current.tab === 'governance' && <GovernanceTab />}
      {current.tab === 'calendar' && <CalendarContent />}
      {current.tab === 'docs' && <DocsContent />}
      {current.tab === 'data' && <DataTab admin={admin} />}
      {current.tab === 'settings' && <SettingsTab />}
    </>
  );
}

/** The organization: overview, people, funding, governance, calendar, docs, data and settings. */
export default function OrgPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = use(searchParams);
  const name = params.tab && (ALIASES[params.tab] ?? params.tab);
  const tab: Tab = TABS.some((t) => t.tab === name) ? (name as Tab) : 'overview';
  return (
    <Suspense fallback={<p className="in-mono">Loading…</p>}>
      <OrgContent tab={tab} />
    </Suspense>
  );
}
