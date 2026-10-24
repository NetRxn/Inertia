#!/usr/bin/env tsx
import { getDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { syncMembers } from '../src/identity/sync';
import { getAdapters } from '../src/adapters';
import { shares } from '../src/db/schema';
import { FIXTURE_NOW } from '../src/adapters';

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

    // Get some member IDs
    const { members } = await import('../src/db/schema');
    const memberList = await db.select().from(members).limit(3);

    if (memberList.length >= 3) {
      await db.insert(shares).values([
        {
          memberId: memberList[0].id,
          kind: 'idea',
          description: 'Community garden partnership with local schools',
          createdAt: new Date(FIXTURE_NOW.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
        {
          memberId: memberList[1].id,
          kind: 'resource',
          description: 'Open-source governance tools',
          linkUrl: 'https://github.com/topics/governance',
          linkTitle: 'GitHub: Governance Tools',
          createdAt: new Date(FIXTURE_NOW.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        },
        {
          memberId: memberList[2].id,
          kind: 'update',
          description: 'Treasury balance: $12,450',
          createdAt: new Date(FIXTURE_NOW.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
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
