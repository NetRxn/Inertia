import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { schema } from './schema';
import path from 'path';

export async function createTestDb() {
  // Create in-memory PGlite instance
  const client = new PGlite();

  // Create drizzle instance
  const db = drizzle({ client, schema });

  // Run migrations
  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  await migrate(db, { migrationsFolder });

  return db;
}
