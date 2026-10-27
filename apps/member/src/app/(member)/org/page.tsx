import { Suspense, use } from 'react';
import Link from 'next/link';
import { getAdapters } from '../../../adapters';
import { getDb } from '../../../db/client';
import { requireMember } from '../../../identity/session';
import { listSources } from '../../../org/ingest';
import { integrationCards } from '../../../org/integrations';
import { isAdmin, listMembers } from '../../../org/members';
import { getOrganization } from '../../../org/organization';
import type { Citation, ProfileLine } from '../../../org/profile-types';
import {
  AddToInertia,
  GovernanceToggle,
  InitiativeChoice,
  InviteMember,
  MemberControls,
  ReadWebsite,
  RedraftProfile,
  SourceVisibility,
} from '../../../components/OrgControls';
import cardStyles from '../../../components/cards/cards.module.css';
import workStyles from '../work/work.module.css';
import styles from './org.module.css';

type Tab = 'profile' | 'members' | 'data' | 'integrations' | 'settings';
const TABS: { tab: Tab; label: string; adminOnly?: boolean }[] = [
  { tab: 'profile', label: 'Profile' },
  { tab: 'members', label: 'Members' },
  { tab: 'data', label: 'Data' },
  { tab: 'integrations', label: 'Integrations' },
  { tab: 'settings', label: 'Settings', adminOnly: true },
];

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

async function ProfileTab({ admin }: { admin: boolean }) {
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
      <Lines title="People" lines={profile.people} />
      <Lines title="Lately" lines={profile.recent} />
      {admin && <RedraftProfile />}
      {org.profileGeneratedAt && <p className={cardStyles.meta}>Drafted {org.profileGeneratedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} from what members shared.</p>}
    </div>
  );
}

async function MembersTab({ admin, selfId }: { admin: boolean; selfId: string }) {
  const rows = (await listMembers(getDb())).filter((m) => m.status === 'active');
  return (
    <div className={cardStyles.feed}>
      {admin && (
        <section className={`in-glass ${cardStyles.card}`}>
          <h2 className={`in-label ${cardStyles.eyebrow}`}>Add someone</h2>
          <InviteMember />
          <p className={cardStyles.meta}>They sign in with a link sent to their email.</p>
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
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { website: 'Website', meeting: 'Meeting', document: 'Document', note: 'Note', 'chat-export': 'Chat', link: 'Link' };

async function DataTab({ admin }: { admin: boolean }) {
  const db = getDb();
  const [sources, org, people] = await Promise.all([listSources(db, { includeHidden: admin }), getOrganization(db), listMembers(db)]);
  const nameOf = new Map(people.map((p) => [p.id, p.displayName]));
  return (
    <div className={cardStyles.feed}>
      <section className={`in-glass ${cardStyles.card}`}>
        <h2 className={`in-label ${cardStyles.eyebrow}`}>Add to Inertia</h2>
        <AddToInertia />
        {admin && <ReadWebsite current={org?.website ?? null} />}
      </section>
      <section className={`in-glass ${cardStyles.card}`}>
        <h2 className={`in-label ${cardStyles.eyebrow}`}>What Inertia knows · {sources.filter((s) => s.status === 'active').length}</h2>
        <ul className={cardStyles.rows}>
          {sources.map((s) => (
            <li key={s.id} className={styles.member} data-status={s.status}>
              <div>
                <p className={cardStyles.itemTitle}><span className="in-chip in-chip--tide">{KIND_LABEL[s.kind] ?? s.kind}</span> {s.title}</p>
                <p className={cardStyles.meta}>
                  {s.addedBy ? `Added by ${nameOf.get(s.addedBy) ?? 'a member'}` : 'Added during setup'} · {s.createdAt.toLocaleDateString('en-US', { dateStyle: 'medium' })} · {s.passages} passage{s.passages === 1 ? '' : 's'}
                  {s.status === 'hidden' && ` · Hidden: ${s.hiddenReason}`}
                </p>
              </div>
              {admin && <SourceVisibility id={s.id} hidden={s.status === 'hidden'} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function IntegrationsTab() {
  const sources = await listSources(getDb());
  const cards = integrationCards(process.env, getAdapters(), {
    sources: sources.length,
    meetings: sources.filter((s) => s.kind === 'meeting').length,
    chatExports: sources.filter((s) => s.kind === 'chat-export').length,
  });
  const groups: { status: 'connected' | 'available' | 'planned'; label: string }[] = [
    { status: 'connected', label: 'Connected' },
    { status: 'available', label: 'Ready to connect' },
    { status: 'planned', label: 'Coming next' },
  ];
  return (
    <div className={cardStyles.feed}>
      {groups.map((g) => {
        const items = cards.filter((c) => c.status === g.status);
        return items.length ? (
          <section key={g.status} className={`in-glass ${cardStyles.card}`}>
            <h2 className={`in-label ${cardStyles.eyebrow}`}>{g.label}</h2>
            <ul className={cardStyles.rows}>
              {items.map((c) => (
                <li key={c.id}>
                  <p className={cardStyles.itemTitle}>{c.name} <span className={cardStyles.meta}>· {c.direction}</span></p>
                  <p className={cardStyles.body}>{c.what}</p>
                  <p className={cardStyles.meta}>{c.how}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null;
      })}
      <p className={cardStyles.meta}>Anything can plug in: an integration only says what it reads or writes, how it connects, and who may see what it brings in. Everything it brings is treated as information, never as instructions.</p>
    </div>
  );
}

async function SettingsTab() {
  const org = await getOrganization(getDb());
  return (
    <div className={cardStyles.feed}>
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
  return (
    <>
      <header className={workStyles.header}>
        <h1 className={workStyles.title}>{org?.name ?? 'Organization'}</h1>
        <p className={cardStyles.meta}>Who we are, who&apos;s here, what Inertia knows and what it&apos;s connected to.</p>
      </header>
      <nav className={workStyles.tabs} aria-label="Organization sections">
        {TABS.filter((t) => admin || !t.adminOnly).map((t) => (
          <Link key={t.tab} href={t.tab === 'profile' ? '/org' : `/org?tab=${t.tab}`} aria-current={tab === t.tab ? 'page' : undefined} className={workStyles.tab}>{t.label}</Link>
        ))}
      </nav>
      {tab === 'profile' && <ProfileTab admin={admin} />}
      {tab === 'members' && <MembersTab admin={admin} selfId={member.id} />}
      {tab === 'data' && <DataTab admin={admin} />}
      {tab === 'integrations' && <IntegrationsTab />}
      {tab === 'settings' && admin && <SettingsTab />}
    </>
  );
}

/** The organization: profile, members, data, integrations and settings. */
export default function OrgPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = use(searchParams);
  const tab: Tab = TABS.some((t) => t.tab === params.tab) ? (params.tab as Tab) : 'profile';
  return (
    <Suspense fallback={<p className="in-mono">Loading…</p>}>
      <OrgContent tab={tab} />
    </Suspense>
  );
}
