import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { requestLoginLink, consumeLoginToken, checkLoginToken, getMemberForSession, signOut } from '../src/identity/auth';
import { syncMembers } from '../src/identity/sync';
import { createFixtureAdapters, FIXTURE_NOW } from '../src/adapters';
import { members } from '../src/db/schema';
import { eq } from 'drizzle-orm';

interface MockMailer {
  calls: Array<{ to: string; url: string }>;
  sendLoginLink(to: string, url: string): Promise<void>;
}

function createMockMailer(): MockMailer {
  const calls: Array<{ to: string; url: string }> = [];
  return {
    calls,
    async sendLoginLink(to: string, url: string) {
      calls.push({ to, url });
    },
  };
}

describe('requestLoginLink', () => {
  let db: Db;
  let mailer: MockMailer;

  beforeEach(async () => {
    db = await createTestDb();
    mailer = createMockMailer();

    // Sync fixture members into the database
    const adapters = createFixtureAdapters();
    await syncMembers(db, adapters.directory, FIXTURE_NOW);
  });

  it('sends a link to an active member and stores only a hash', async () => {
    const baseUrl = 'http://localhost:3000';
    await requestLoginLink(db, 'ana@example.org', mailer, { baseUrl, now: FIXTURE_NOW });

    expect(mailer.calls).toHaveLength(1);
    expect(mailer.calls[0].to).toBe('ana@example.org');

    // Extract token from URL
    const url = new URL(mailer.calls[0].url);
    expect(url.origin).toBe(baseUrl);
    expect(url.pathname).toBe('/auth/verify');
    const token = url.searchParams.get('token');
    expect(token).toBeTruthy();
    expect(token!.length).toBeGreaterThan(0);

    // Verify token is not stored in plain text
    const { loginTokens } = await import('../src/db/schema');
    const tokens = await db.select().from(loginTokens);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).not.toBe(token);
    expect(tokens[0].tokenHash).toBeTruthy();
  });

  it('silently ignores unknown emails', async () => {
    await requestLoginLink(db, 'unknown@example.org', mailer, {
      baseUrl: 'http://localhost:3000',
      now: FIXTURE_NOW,
    });

    expect(mailer.calls).toHaveLength(0);
  });

  it('silently ignores inactive emails', async () => {
    await requestLoginLink(db, 'pat@example.org', mailer, {
      baseUrl: 'http://localhost:3000',
      now: FIXTURE_NOW,
    });

    expect(mailer.calls).toHaveLength(0);
  });

  it('caps links at 5 per member per hour', async () => {
    const baseUrl = 'http://localhost:3000';
    const email = 'ana@example.org';

    // Send 5 links successfully
    for (let i = 0; i < 5; i++) {
      await requestLoginLink(db, email, mailer, {
        baseUrl,
        now: new Date(FIXTURE_NOW.getTime() + i * 1000),
      });
    }
    expect(mailer.calls).toHaveLength(5);

    // 6th request within an hour should not send
    mailer.calls.length = 0;
    await requestLoginLink(db, email, mailer, {
      baseUrl,
      now: new Date(FIXTURE_NOW.getTime() + 60 * 60 * 1000 - 1000), // 59 minutes later
    });
    expect(mailer.calls).toHaveLength(0);

    // Request 61 minutes after the first should send
    mailer.calls.length = 0;
    await requestLoginLink(db, email, mailer, {
      baseUrl,
      now: new Date(FIXTURE_NOW.getTime() + 61 * 60 * 1000), // 61 minutes later
    });
    expect(mailer.calls).toHaveLength(1);
  });

  it('handles concurrent rate limiting correctly', async () => {
    const baseUrl = 'http://localhost:3000';
    const email = 'rob@example.org';

    // Fire 10 concurrent requests for the same member
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        requestLoginLink(db, email, mailer, {
          baseUrl,
          now: new Date(FIXTURE_NOW.getTime() + i * 100),
        })
      )
    );

    // Should have exactly 5 tokens stored
    const { loginTokens } = await import('../src/db/schema');
    const [member] = await db.select().from(members).where(eq(members.email, email));
    const tokens = await db
      .select()
      .from(loginTokens)
      .where(eq(loginTokens.memberId, member.id));
    expect(tokens).toHaveLength(5);

    // Should have exactly 5 emails sent
    expect(mailer.calls).toHaveLength(5);
  });
});

describe('consumeLoginToken', () => {
  let db: Db;
  let mailer: MockMailer;

  beforeEach(async () => {
    db = await createTestDb();
    mailer = createMockMailer();

    const adapters = createFixtureAdapters();
    await syncMembers(db, adapters.directory, FIXTURE_NOW);
  });

  it('consumes a valid token once', async () => {
    // Request a login link
    await requestLoginLink(db, 'ana@example.org', mailer, {
      baseUrl: 'http://localhost:3000',
      now: FIXTURE_NOW,
    });

    const url = new URL(mailer.calls[0].url);
    const token = url.searchParams.get('token')!;

    // First consumption should succeed
    const result1 = await consumeLoginToken(db, token, FIXTURE_NOW);
    expect(result1.ok).toBe(true);
    if (result1.ok) {
      expect(result1.sessionToken).toBeTruthy();
      expect(result1.memberId).toBeTruthy();
    }

    // Second consumption should fail
    const result2 = await consumeLoginToken(db, token, FIXTURE_NOW);
    expect(result2).toEqual({ ok: false, reason: 'used' });
  });

  it('handles concurrent token consumption atomically', async () => {
    // Request a login link
    await requestLoginLink(db, 'rob@example.org', mailer, {
      baseUrl: 'http://localhost:3000',
      now: FIXTURE_NOW,
    });

    const url = new URL(mailer.calls[0].url);
    const token = url.searchParams.get('token')!;

    // Attempt to consume the token concurrently
    const [result1, result2] = await Promise.all([
      consumeLoginToken(db, token, FIXTURE_NOW),
      consumeLoginToken(db, token, FIXTURE_NOW),
    ]);

    // Exactly one should succeed
    const successCount = [result1, result2].filter((r) => r.ok).length;
    expect(successCount).toBe(1);

    // The other should fail with 'used'
    const failCount = [result1, result2].filter((r) => !r.ok && r.reason === 'used').length;
    expect(failCount).toBe(1);
  });

  it('checking a link does not use it, so chat previews leave it working', async () => {
    await requestLoginLink(db, 'ana@example.org', mailer, { baseUrl: 'http://localhost:3000', now: FIXTURE_NOW });
    const token = new URL(mailer.calls[0].url).searchParams.get('token')!;

    expect(await checkLoginToken(db, token, FIXTURE_NOW)).toEqual({ ok: true, firstName: 'Ana' });
    expect(await checkLoginToken(db, token, FIXTURE_NOW)).toEqual({ ok: true, firstName: 'Ana' });
    expect((await consumeLoginToken(db, token, FIXTURE_NOW)).ok).toBe(true);
    expect(await checkLoginToken(db, token, FIXTURE_NOW)).toEqual({ ok: false, reason: 'used' });
    expect(await checkLoginToken(db, 'tampered', FIXTURE_NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('keeps an emailed link working for an hour', async () => {
    await requestLoginLink(db, 'ana@example.org', mailer, { baseUrl: 'http://localhost:3000', now: FIXTURE_NOW });
    const token = new URL(mailer.calls[0].url).searchParams.get('token')!;
    expect((await checkLoginToken(db, token, new Date(FIXTURE_NOW.getTime() + 59 * 60 * 1000))).ok).toBe(true);
  });

  it('rejects a token after an hour', async () => {
    await requestLoginLink(db, 'ana@example.org', mailer, {
      baseUrl: 'http://localhost:3000',
      now: FIXTURE_NOW,
    });

    const url = new URL(mailer.calls[0].url);
    const token = url.searchParams.get('token')!;

    // An hour and a second later
    const expiredTime = new Date(FIXTURE_NOW.getTime() + 60 * 60 * 1000 + 1000);
    const result = await consumeLoginToken(db, token, expiredTime);

    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a tampered token', async () => {
    const result = await consumeLoginToken(db, 'tampered-token-xyz', FIXTURE_NOW);
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a token for a member deactivated after it was sent', async () => {
    // Request a login link for Rob
    await requestLoginLink(db, 'rob@example.org', mailer, {
      baseUrl: 'http://localhost:3000',
      now: FIXTURE_NOW,
    });

    const url = new URL(mailer.calls[0].url);
    const token = url.searchParams.get('token')!;

    // Deactivate Rob
    await db.update(members).set({ status: 'inactive' }).where(eq(members.email, 'rob@example.org'));

    // Token should now be rejected
    const result = await consumeLoginToken(db, token, FIXTURE_NOW);
    expect(result).toEqual({ ok: false, reason: 'inactive' });
  });
});

describe('getMemberForSession', () => {
  let db: Db;
  let mailer: MockMailer;

  beforeEach(async () => {
    db = await createTestDb();
    mailer = createMockMailer();

    const adapters = createFixtureAdapters();
    await syncMembers(db, adapters.directory, FIXTURE_NOW);
  });

  it('session stops working when the member is deactivated', async () => {
    // Create a session for Ana
    await requestLoginLink(db, 'ana@example.org', mailer, {
      baseUrl: 'http://localhost:3000',
      now: FIXTURE_NOW,
    });

    const url = new URL(mailer.calls[0].url);
    const token = url.searchParams.get('token')!;
    const consumeResult = await consumeLoginToken(db, token, FIXTURE_NOW);
    expect(consumeResult.ok).toBe(true);

    if (!consumeResult.ok) throw new Error('Expected consume to succeed');
    const sessionToken = consumeResult.sessionToken;

    // Session should work initially
    const member1 = await getMemberForSession(db, sessionToken, FIXTURE_NOW);
    expect(member1).toBeTruthy();
    expect(member1?.email).toBe('ana@example.org');

    // Deactivate Ana using syncMembers
    const adapters = createFixtureAdapters();
    // Modify the fixture to make Ana inactive
    const directoryMembers = await adapters.directory.listMembers();
    const modifiedMembers = directoryMembers.map((m) =>
      m.externalId === 'm-ana' ? { ...m, active: false } : m
    );

    // Create a modified directory adapter
    const modifiedDirectory = {
      async listMembers() {
        return modifiedMembers;
      },
    };

    await syncMembers(db, modifiedDirectory, FIXTURE_NOW);

    // Session should now return null
    const member2 = await getMemberForSession(db, sessionToken, FIXTURE_NOW);
    expect(member2).toBeNull();
  });

  it('session lasts 90 days and renews whenever it is used', async () => {
    await requestLoginLink(db, 'ana@example.org', mailer, { baseUrl: 'http://localhost:3000', now: FIXTURE_NOW });
    const token = new URL(mailer.calls[0].url).searchParams.get('token')!;
    const consumed = await consumeLoginToken(db, token, FIXTURE_NOW);
    if (!consumed.ok) throw new Error('Expected consume to succeed');
    const day = 24 * 60 * 60 * 1000;
    const at = (days: number) => new Date(FIXTURE_NOW.getTime() + days * day);

    // Used every 80 days, it keeps working well past the first 90.
    expect(await getMemberForSession(db, consumed.sessionToken, at(80))).toBeTruthy();
    expect(await getMemberForSession(db, consumed.sessionToken, at(160))).toBeTruthy();
    expect(await getMemberForSession(db, consumed.sessionToken, at(240))).toBeTruthy();
    // Left alone for more than 90 days, it ends.
    expect(await getMemberForSession(db, consumed.sessionToken, at(240 + 90 + 1))).toBeNull();
  });

  it('session expires after 90 days unused', async () => {
    await requestLoginLink(db, 'ana@example.org', mailer, {
      baseUrl: 'http://localhost:3000',
      now: FIXTURE_NOW,
    });

    const url = new URL(mailer.calls[0].url);
    const token = url.searchParams.get('token')!;
    const consumeResult = await consumeLoginToken(db, token, FIXTURE_NOW);
    expect(consumeResult.ok).toBe(true);

    if (!consumeResult.ok) throw new Error('Expected consume to succeed');
    const sessionToken = consumeResult.sessionToken;

    // Should work before expiry
    const member1 = await getMemberForSession(db, sessionToken, FIXTURE_NOW);
    expect(member1).toBeTruthy();

    // Should not work 90 days + 1 second later
    const expiredTime = new Date(FIXTURE_NOW.getTime() + 90 * 24 * 60 * 60 * 1000 + 1000);
    const member2 = await getMemberForSession(db, sessionToken, expiredTime);
    expect(member2).toBeNull();
  });

  it('updates lastSeenAt at most once per 5 minutes', async () => {
    await requestLoginLink(db, 'ana@example.org', mailer, {
      baseUrl: 'http://localhost:3000',
      now: FIXTURE_NOW,
    });

    const url = new URL(mailer.calls[0].url);
    const token = url.searchParams.get('token')!;
    const consumeResult = await consumeLoginToken(db, token, FIXTURE_NOW);
    expect(consumeResult.ok).toBe(true);

    if (!consumeResult.ok) throw new Error('Expected consume to succeed');
    const sessionToken = consumeResult.sessionToken;

    // First call should update lastSeenAt
    await getMemberForSession(db, sessionToken, FIXTURE_NOW);
    const member1 = await db.select().from(members).where(eq(members.email, 'ana@example.org'));
    const firstSeenAt = member1[0].lastSeenAt;
    expect(firstSeenAt).toBeTruthy();

    // Second call 2 minutes later should not update
    const twoMinutesLater = new Date(FIXTURE_NOW.getTime() + 2 * 60 * 1000);
    await getMemberForSession(db, sessionToken, twoMinutesLater);
    const member2 = await db.select().from(members).where(eq(members.email, 'ana@example.org'));
    expect(member2[0].lastSeenAt?.getTime()).toBe(firstSeenAt?.getTime());

    // Third call 6 minutes later should update
    const sixMinutesLater = new Date(FIXTURE_NOW.getTime() + 6 * 60 * 1000);
    await getMemberForSession(db, sessionToken, sixMinutesLater);
    const member3 = await db.select().from(members).where(eq(members.email, 'ana@example.org'));
    expect(member3[0].lastSeenAt?.getTime()).toBeGreaterThan(firstSeenAt?.getTime()!);
  });
});

describe('signOut', () => {
  let db: Db;
  let mailer: MockMailer;

  beforeEach(async () => {
    db = await createTestDb();
    mailer = createMockMailer();

    const adapters = createFixtureAdapters();
    await syncMembers(db, adapters.directory, FIXTURE_NOW);
  });

  it('deletes the session', async () => {
    await requestLoginLink(db, 'ana@example.org', mailer, {
      baseUrl: 'http://localhost:3000',
      now: FIXTURE_NOW,
    });

    const url = new URL(mailer.calls[0].url);
    const token = url.searchParams.get('token')!;
    const consumeResult = await consumeLoginToken(db, token, FIXTURE_NOW);
    expect(consumeResult.ok).toBe(true);

    if (!consumeResult.ok) throw new Error('Expected consume to succeed');
    const sessionToken = consumeResult.sessionToken;

    // Session should work
    const member1 = await getMemberForSession(db, sessionToken, FIXTURE_NOW);
    expect(member1).toBeTruthy();

    // Sign out
    await signOut(db, sessionToken);

    // Session should no longer work
    const member2 = await getMemberForSession(db, sessionToken, FIXTURE_NOW);
    expect(member2).toBeNull();
  });
});
