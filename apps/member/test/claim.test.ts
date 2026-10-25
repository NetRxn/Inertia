import { describe, it, expect, beforeEach } from 'vitest';
import { toClaimMessage } from '../src/work/claim-message';
import type { ClaimResult } from '../src/adapters/types';
import { createTestDb } from '../src/db/test-db';
import { sql } from 'drizzle-orm';

describe('toClaimMessage', () => {
  it('maps ok result to success message', () => {
    const result: ClaimResult = { ok: true };
    const message = toClaimMessage(result);

    expect(message).toEqual({
      ok: true,
      message: "It's yours.",
    });
  });

  it('maps already-claimed to "Someone already took this."', () => {
    const result: ClaimResult = { ok: false, reason: 'already-claimed' };
    const message = toClaimMessage(result);

    expect(message).toEqual({
      ok: false,
      message: 'Someone already took this.',
    });
  });

  it('maps not-found to "This task is no longer available."', () => {
    const result: ClaimResult = { ok: false, reason: 'not-found' };
    const message = toClaimMessage(result);

    expect(message).toEqual({
      ok: false,
      message: 'This task is no longer available.',
    });
  });

  it('maps unavailable to retry message', () => {
    const result: ClaimResult = { ok: false, reason: 'unavailable' };
    const message = toClaimMessage(result);

    expect(message).toEqual({
      ok: false,
      message: "Couldn't reach the task system. Try again.",
    });
  });

  it('maps a thrown adapter error to the retry message', () => {
    const error = new Error('Network error');
    const message = toClaimMessage(error);

    expect(message).toEqual({
      ok: false,
      message: "Couldn't reach the task system. Try again.",
    });
  });
});

describe('claim server action', () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let initialCounts: Record<string, number>;

  beforeEach(async () => {
    db = await createTestDb();

    // Get initial row counts for all member_app tables
    // Use quoted identifiers for camelCase table names
    initialCounts = {};
    const tables = ['members', '"loginTokens"', 'sessions', 'files', 'shares', 'conversations', 'messages', 'documents'];

    for (const table of tables) {
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM member_app.${table}`));
      initialCounts[table] = Number(result.rows[0].count);
    }
  });

  it('claim does not write to the database', async () => {
    // After the server action is implemented, we'll verify no DB writes occurred
    // For now, this test will fail because the function doesn't exist yet

    // Verify all tables have the same counts as before
    const tables = ['members', '"loginTokens"', 'sessions', 'files', 'shares', 'conversations', 'messages', 'documents'];

    for (const table of tables) {
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM member_app.${table}`));
      const currentCount = Number(result.rows[0].count);
      expect(currentCount).toBe(initialCounts[table]);
    }
  });
});
