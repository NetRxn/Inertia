import { getDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';

async function main() {
  console.log('Running migrations...');
  const db = getDb();
  await runMigrations(db);
  console.log('Migrations complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
