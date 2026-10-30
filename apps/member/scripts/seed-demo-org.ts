import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../src/db/client';
import { members, orgSources } from '../src/db/schema';
import { addLibraryDocument } from '../src/documents/library';
import { addSource, setSummary } from '../src/org/ingest';
import { completeSetup, getOrganization, saveBasics, saveProfile, setGovernance } from '../src/org/organization';
import type { OrgProfile, ProposedInitiative } from '../src/org/profile-types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const line = (text: string) => ({ id: randomUUID(), text, citations: [] });
const initiative = (title: string, summary: string, workId: string | null, status: ProposedInitiative['status'], adopted: boolean): ProposedInitiative =>
  ({ id: randomUUID(), title, summary, citations: [], status, workId, adopted });

/** The sample organization the fixture work engine belongs to, as onboarding would leave it. */
const PROFILE: OrgProfile = {
  mission: line('Riverside Commons turns neighbors’ ideas into shared places and skills: a community garden, free coding nights for young people, and an open treasury anyone can follow.'),
  programs: [
    line('A community garden and tool library on the old Elm Street lot.'),
    line('Youth coding nights at the branch library, with volunteer mentors.'),
    line('Monthly roundtables where members bring proposals and vote.'),
  ],
  people: [
    line('Ana Rodriguez, garden lead'),
    line('Rob Chen, treasurer'),
    line('Dana Ortiz, branch librarian and coding nights host (not a member yet)'),
  ],
  recent: [
    line('Submitted the Green Spaces grant application draft for agent review.'),
    line('Scheduled the first coding night at the branch library.'),
    line('Opened the tool library shed on Saturdays.'),
  ],
  initiatives: [
    // Work ids match the fixture work engine, so these join its goals.
    initiative('Community garden grant', 'Fund and build the Elm Street garden.', 'init-garden', 'accepted', true),
    initiative('Youth coding nights', 'Weekly coding sessions for local youth.', 'init-coding', 'accepted', true),
    initiative('Treasury policy v2', 'A clearer, public treasury policy.', 'init-treasury', 'accepted', false),
    initiative('Neighborhood arts mini-grants', 'Small grants for murals and pop-up shows.', null, 'proposed', false),
  ],
};

/** What the connectors and members brought in, newest first in the feed. */
const SOURCES: { kind: 'chat-export' | 'meeting' | 'document' | 'note'; title: string; content: string; summary: string; ago: number }[] = [
  {
    kind: 'chat-export',
    title: 'Buzz: #garden, daily digest',
    content: 'Ana: soil test results are back, lead levels fine.\nRob: we can cover the $3,000 match from the reserve if the vote passes.\nCasey: tool library had 14 borrows Saturday.',
    summary: 'Soil test came back clean; the treasury can cover the grant match if the vote passes.',
    ago: 3 * HOUR,
  },
  {
    kind: 'chat-export',
    title: 'Telegram: Riverside Commons, daily digest',
    content: 'Jordan: library confirmed the room for Thursday coding nights.\nAlex: two schools replied to the intro email.\nMorgan: who has the projector?',
    summary: 'Library room confirmed for Thursdays; two schools replied about coding nights.',
    ago: 9 * HOUR,
  },
  {
    kind: 'meeting',
    title: 'Roundtable notes, October',
    content: 'Decisions: move garden build day to Nov 14. Adopt the coding nights budget.\nAction items: Rob drafts treasury policy v2 summary. Ana gathers support letters.\nOpen question: who signs the site lease?',
    summary: 'Build day moved to Nov 14; coding nights budget adopted; open question on who signs the lease.',
    ago: 2 * DAY,
  },
  {
    kind: 'document',
    title: 'Riverside Commons one-pager',
    content: 'Riverside Commons is a neighborhood DAO. We run a community garden, youth coding nights and an open treasury. Members propose, vote and get credit for their work.',
    summary: 'What Riverside Commons is and does, on one page.',
    ago: 4 * DAY,
  },
];

/** Key documents, as links to example pages. */
const LIBRARY = [
  { title: 'Riverside Commons one-pager', description: 'Who we are and what we do, for partners and new members.', category: 'one-pager' as const, linkUrl: 'https://example.org/riverside/one-pager' },
  { title: 'Treasury policy v2 (draft)', description: 'The policy members are voting on.', category: 'policy' as const, linkUrl: 'https://example.org/riverside/treasury-policy' },
  { title: 'Code of conduct', description: 'How we treat each other at events and online.', category: 'policy' as const, linkUrl: 'https://example.org/riverside/conduct' },
  { title: 'Brand kit', description: 'Logo, colors and photo guidelines.', category: 'brand' as const, linkUrl: 'https://example.org/riverside/brand' },
];

/** Adds the sample organization and incoming data, once. Leaves a real organization alone. */
export async function seedDemoOrganization(db: Db): Promise<void> {
  const existing = await getOrganization(db);
  if (existing?.profile) {
    console.log('Organization profile already exists, skipping the sample organization');
    return;
  }
  console.log('Creating the sample organization...');
  await saveBasics(db, { name: 'Riverside Commons (sample)', website: null, description: 'A sample neighborhood DAO for demos.' });
  await saveProfile(db, PROFILE);
  await setGovernance(db, true);
  await completeSetup(db);

  const now = Date.now();
  for (const source of SOURCES) {
    const { source: row, duplicate } = await addSource(db, { kind: source.kind, title: source.title, content: source.content });
    if (duplicate) continue;
    await setSummary(db, row.id, source.summary);
    await db.update(orgSources).set({ createdAt: new Date(now - source.ago) }).where(eq(orgSources.id, row.id));
  }

  // A few key documents for the library, added as the first member (by email).
  const [first] = await db.select({ id: members.id }).from(members).where(eq(members.status, 'active')).orderBy(asc(members.email)).limit(1);
  if (first) {
    const editor = { id: first.id, role: 'admin' };
    for (const doc of LIBRARY) await addLibraryDocument(db, editor, doc);
  }
  console.log(`  Added the profile, ${PROFILE.initiatives.length} initiatives, ${SOURCES.length} incoming sources and ${first ? LIBRARY.length : 0} library documents`);
}
