import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import path from 'path';
import { schema } from '../src/db/schema';
import { runMigrations } from '../src/db/migrate';
import journal from '../drizzle/meta/_journal.json';

// Every migration drizzle-kit has generated.
const MIGRATIONS = journal.entries.length;

function freshDb() {
  return drizzle({ client: new PGlite(), schema });
}

async function count(db: ReturnType<typeof freshDb>, query: ReturnType<typeof sql>) {
  const result = await db.execute<{ n: number }>(query);
  return Number(result.rows[0].n);
}

describe('runMigrations', () => {
  it('keeps everything in member_app, with no drizzle schema', async () => {
    const db = freshDb();
    await runMigrations(db);
    expect(await count(db, sql`select count(*) as n from pg_namespace where nspname = 'drizzle'`)).toBe(0);
    expect(await count(db, sql`select count(*) as n from member_app.__drizzle_migrations`)).toBe(MIGRATIONS);
  });

  it('is a no-op the second time', async () => {
    const db = freshDb();
    await runMigrations(db);
    await runMigrations(db);
    expect(await count(db, sql`select count(*) as n from member_app.__drizzle_migrations`)).toBe(MIGRATIONS);
  });

  it('migrates into a member_app schema a DBA created beforehand', async () => {
    const db = freshDb();
    await db.execute(sql`create schema member_app`);
    await runMigrations(db);
    expect(await count(db, sql`select count(*) as n from member_app.members`)).toBe(0);
  });

  it('keeps using the drizzle journal on installs that already have one', async () => {
    const db = freshDb();
    await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
    await runMigrations(db);
    expect(await count(db, sql`select count(*) as n from drizzle.__drizzle_migrations`)).toBe(MIGRATIONS);
    expect(await count(db, sql`select count(*) as n from pg_tables where tablename = '__drizzle_migrations' and schemaname = 'member_app'`)).toBe(0);
  });
});
