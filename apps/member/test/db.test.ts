import { describe, it, expect } from 'vitest';
import { createTestDb } from '../src/db/test-db';
import { sql } from 'drizzle-orm';
import { members } from '../src/db/schema';

describe('Database', () => {
  it('migrates into the member_app schema', async () => {
    const db = await createTestDb();

    // Query information_schema to check tables in member_app schema
    const result = await db.execute<{ table_name: string }>(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'member_app'
      ORDER BY table_name
    `);

    const tableNames = result.rows.map(row => row.table_name);

    // Exactly these 12 tables, plus the migration journal
    expect(tableNames).toEqual([
      '__drizzle_migrations',
      'conversations',
      'documents',
      'files',
      'loginTokens',
      'members',
      'messages',
      'org_passages',
      'org_sources',
      'organization',
      'sessions',
      'shares',
      'work_events',
    ]);
  });

  it('rejects a mixed-case email', async () => {
    const db = await createTestDb();

    // Attempt to insert member with mixed-case email
    // This should fail due to the lowercase check constraint
    await expect(
      db.insert(members).values({
        externalId: 'ext-1',
        email: 'Ana@Example.org',
        displayName: 'Ana',
        status: 'active',
      })
    ).rejects.toThrow();
  });

  it('enforces unique email', async () => {
    const db = await createTestDb();

    // Insert first member with lowercase email
    await db.insert(members).values({
      externalId: 'ext-1',
      email: 'ana@example.org',
      displayName: 'Ana',
      status: 'active',
    });

    // Attempt to insert second member with same email
    // This should fail due to the unique constraint
    await expect(
      db.insert(members).values({
        externalId: 'ext-2',
        email: 'ana@example.org',
        displayName: 'Ana 2',
        status: 'active',
      })
    ).rejects.toThrow();
  });
});
