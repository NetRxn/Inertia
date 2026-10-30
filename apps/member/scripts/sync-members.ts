#!/usr/bin/env node
import { getDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { getAdapters } from '../src/adapters/index';
import { syncMembers } from '../src/identity/sync';

async function main() {
  const db = getDb();

  console.log('Running migrations...');
  await runMigrations(db);

  console.log('Syncing members from directory...');
  const adapters = getAdapters();
  const result = await syncMembers(db, adapters.directory);

  console.log(`Sync complete: ${result.added} added, ${result.updated} updated, ${result.deactivated} deactivated`);
}

main().catch((error) => {
  console.error('Sync failed:', error);
  process.exit(1);
});
