import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { schema } from './schema';
import { runMigrations } from './migrate';

export async function createTestDb() {
  // Create in-memory PGlite instance
  const client = new PGlite();

  // Create drizzle instance
  const db = drizzle({ client, schema });

  // Run migrations
  await runMigrations(db);

  return db;
}
