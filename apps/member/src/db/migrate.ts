import { migrate as migrateNodePostgres } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { getDbDriver, type Db } from './client';
import path from 'path';

export async function runMigrations(db: Db): Promise<void> {
  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  const driver = getDbDriver();

  if (driver === 'node-postgres') {
    await migrateNodePostgres(db as any, { migrationsFolder });
  } else {
    await migratePglite(db as any, { migrationsFolder });
  }
}
