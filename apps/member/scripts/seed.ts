#!/usr/bin/env tsx
import { getDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { syncMembers } from '../src/identity/sync';
import { getAdapters } from '../src/adapters';
import { shares, members } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('Running migrations...');
  const db = getDb();
  await runMigrations(db);

  const adapters = getAdapters();

  console.log('Syncing members from fixtures...');
  const syncResult = await syncMembers(db, adapters.directory);
  console.log(`  Added: ${syncResult.added}, Updated: ${syncResult.updated}, Deactivated: ${syncResult.deactivated}`);

  // Insert 3 sample shares if none exist
  const existingShares = await db.select().from(shares);

  if (existingShares.length === 0) {
    console.log('Creating sample shares...');

    // Active members only, in a fixed order (by email), so the sample shares
    // are the same whoever runs the seed. Dates are relative to process start.
    const activeMembers = await db
      .select()
      .from(members)
      .where(eq(members.status, 'active'))
      .orderBy(members.email);

    if (activeMembers.length >= 3) {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const [first, second, third] = activeMembers;

      await db.insert(shares).values([
        {
          memberId: first.id,
          kind: 'idea',
          description: 'Community garden partnership with local schools',
          createdAt: new Date(now - 2 * day),
        },
        {
          memberId: second.id,
          kind: 'resource',
          description: 'Open-source governance tools',
          linkUrl: 'https://github.com/topics/governance',
          linkTitle: 'GitHub: Governance Tools',
          createdAt: new Date(now - 5 * day),
        },
        {
          memberId: third.id,
          kind: 'update',
          description: 'The tool library shed opens Saturdays — borrow a spade, leave a trowel.',
          createdAt: new Date(now - 1 * day),
        },
      ]);

      console.log('  Created 3 sample shares');
    }
  } else {
    console.log(`Shares already exist (${existingShares.length} found), skipping creation`);
  }

  console.log('Seed completed successfully!');
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
