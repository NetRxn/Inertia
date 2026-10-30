import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireMember } from '../../../identity/session';
import { getDb } from '../../../db/client';
import { listSources } from '../../../org/ingest';
import { isAdmin } from '../../../org/members';
import { getOrganization } from '../../../org/organization';
import { SetupConversation } from '../../../components/SetupConversation';
import styles from '../sections.module.css';

async function Setup() {
  const member = await requireMember();
  if (!isAdmin(member)) redirect('/');
  const db = getDb();
  const [org, sources] = await Promise.all([getOrganization(db), listSources(db)]);
  return (
    <SetupConversation
      state={{
        name: org?.name ?? null,
        website: org?.website ?? null,
        description: org?.description ?? '',
        sourceCount: sources.length,
        profile: org?.profile ?? null,
      }}
    />
  );
}

/** First run for an admin: tell Inertia about the organization. */
export default function SetupPage() {
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Tell me about your organization</h1>
      </header>
      <Suspense fallback={<p className="in-mono">Loading…</p>}>
        <Setup />
      </Suspense>
    </>
  );
}
