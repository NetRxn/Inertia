import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import type { Db } from './client';
import path from 'path';

const APP_SCHEMA = 'member_app';
const JOURNAL_TABLE = '__drizzle_migrations';

// A whole statement that only creates a schema, as drizzle-kit writes it.
const CREATE_SCHEMA = /^\s*CREATE SCHEMA\s+(?:IF NOT EXISTS\s+)?"([^"]+)"\s*;?\s*$/i;

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

async function rows<T>(tx: Tx, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = (await tx.execute(query)) as unknown as { rows: T[] };
  return result.rows;
}

async function schemaExists(tx: Tx, name: string): Promise<boolean> {
  return (await rows(tx, sql`select 1 from pg_namespace where nspname = ${name}`)).length > 0;
}

/**
 * Applies drizzle-kit migrations from ./drizzle, with drizzle's journal rules (a migration
 * runs when it is newer than the last one recorded), but never asks for more than it needs:
 * a schema is created only when it is missing. Drizzle's own migrator always runs
 * CREATE SCHEMA IF NOT EXISTS, which Postgres refuses without CREATE on the database even
 * when the schema exists, so it can't run on a shared database where a DBA created
 * member_app for the app's role.
 *
 * The journal lives in member_app; installs that already have drizzle.__drizzle_migrations
 * keep using it. One transaction, serialized by an advisory lock, so two processes starting
 * at once don't both apply a migration.
 */
export async function runMigrations(db: Db): Promise<void> {
  const migrations = readMigrationFiles({ migrationsFolder: path.join(process.cwd(), 'drizzle') });

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('member_app.migrations'))`);

    const [legacy] = await rows<{ found: string | null }>(
      tx,
      sql`select to_regclass(${`drizzle.${JOURNAL_TABLE}`})::text as found`,
    );
    const journalSchema = legacy?.found ? 'drizzle' : APP_SCHEMA;
    if (!(await schemaExists(tx, journalSchema))) {
      await tx.execute(sql.raw(`CREATE SCHEMA "${journalSchema}"`));
    }
    const journal = sql.raw(`"${journalSchema}"."${JOURNAL_TABLE}"`);
    await tx.execute(
      sql`CREATE TABLE IF NOT EXISTS ${journal} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
    );

    const [last] = await rows<{ created_at: string }>(
      tx,
      sql`select created_at from ${journal} order by created_at desc limit 1`,
    );
    for (const migration of migrations) {
      if (last && Number(last.created_at) >= migration.folderMillis) continue;
      for (const statement of migration.sql) {
        const schema = CREATE_SCHEMA.exec(statement)?.[1];
        if (schema && (await schemaExists(tx, schema))) continue;
        await tx.execute(sql.raw(statement));
      }
      await tx.execute(
        sql`insert into ${journal} (hash, created_at) values (${migration.hash}, ${migration.folderMillis})`,
      );
    }
  });
}
