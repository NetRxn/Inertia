import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toClaimMessage } from '../src/work/claim-message';
import type { ClaimResult } from '../src/adapters/types';
import { createTestDb } from '../src/db/test-db';
import { sql } from 'drizzle-orm';

// Mock next/cache before importing modules that use it
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

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
  it('claim does not write to the database', async () => {
    const db = await createTestDb();

    // Get initial row counts for all member_app tables
    const tables = ['members', '"loginTokens"', 'sessions', 'files', 'shares', 'conversations', 'messages', 'documents'];
    const initialCounts: Record<string, number> = {};

    for (const table of tables) {
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM member_app.${table}`));
      initialCounts[table] = Number(result.rows[0].count);
    }

    // Mock the dependencies to use our test DB and avoid redirects
    const requireMemberModule = await import('../src/identity/session');
    const dbClientModule = await import('../src/db/client');
    const adaptersModule = await import('../src/adapters');

    vi.spyOn(requireMemberModule, 'requireMember').mockResolvedValue({
      id: 'test-member-id',
      externalId: 'm-casey',
      email: 'casey@example.org',
      displayName: 'Casey Thompson',
      status: 'active',
      lastSyncedAt: new Date(),
      lastSeenAt: new Date(),
    } as any);

    vi.spyOn(dbClientModule, 'getDb').mockReturnValue(db as any);

    // Reset adapters to get a fresh instance with the fixture
    adaptersModule.resetAdaptersForTests();

    // Import claimTask after mocking
    const { claimTask } = await import('../src/work/claim');

    // Claim task-1
    const result = await claimTask('task-1');

    // Should succeed
    expect(result).toEqual({ ok: true, message: "It's yours." });

    // Verify all tables have the same counts as before (no DB writes)
    for (const table of tables) {
      const currentResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM member_app.${table}`));
      const currentCount = Number(currentResult.rows[0].count);
      expect(currentCount).toBe(initialCounts[table]);
    }

    vi.restoreAllMocks();
  });
});
