import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import type { Db } from './client';
import path from 'path';

export async function runMigrations(db: Db): Promise<void> {
  const migrationsFolder = path.join(process.cwd(), 'drizzle');

  // Check if db has the migrate method signature for node-postgres or pglite
  // Both have similar migrate function signatures, so we can try both
  try {
    // Try node-postgres migrate first
    await migrate(db as any, { migrationsFolder });
  } catch (error) {
    // If that fails, try pglite migrate
    await migratePglite(db as any, { migrationsFolder });
  }
}
