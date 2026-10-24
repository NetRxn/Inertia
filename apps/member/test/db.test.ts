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

    // Expect exactly these 8 tables
    expect(tableNames).toEqual([
      'conversations',
      'documents',
      'files',
      'loginTokens',
      'members',
      'messages',
      'sessions',
      'shares',
    ]);
  });

  it('enforces unique lowercase member email', async () => {
    const db = await createTestDb();

    // Insert first member with mixed case email
    await db.insert(members).values({
      externalId: 'ext-1',
      email: 'ana@example.org',
      displayName: 'Ana',
      status: 'active',
    });

    // Attempt to insert second member with same email (different case)
    // This should fail due to the unique constraint and lowercase check
    await expect(
      db.insert(members).values({
        externalId: 'ext-2',
        email: 'Ana@Example.org',
        displayName: 'Ana 2',
        status: 'active',
      })
    ).rejects.toThrow();
  });
});
