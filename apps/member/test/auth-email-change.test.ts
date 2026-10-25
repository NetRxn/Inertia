import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../src/db/test-db';
import { requestLoginLink, consumeLoginToken, getMemberForSession } from '../src/identity/auth';
import { syncMembers } from '../src/identity/sync';
import { loginTokens, sessions } from '../src/db/schema';
import type { DirectoryMember } from '../src/adapters/types';

let db: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-25T00:00:00Z');
const directory = (email: string, active = true) => ({
  listMembers: async (): Promise<DirectoryMember[]> => [{
    externalId: 'fixture-email-member', email, active, displayName: 'Fixture Member',
  }],
});

beforeAll(async () => { db = await createTestDb(); });
afterAll(async () => { await db.$client.close(); });

async function issue(email: string): Promise<string> {
  let token = '';
  await requestLoginLink(db, email, {
    async sendLoginLink(to, url) {
      expect(to).toBe(email);
      token = new URL(url).searchParams.get('token')!;
    },
  }, { baseUrl: 'http://fixture.test', now });
  expect(token).not.toBe('');
  return token;
}

// Delay only the transaction boundary; all reads/writes remain real PGlite.
// This reproduces a directory update between an initial identity lookup and
// the later transaction acquiring that member's lock.
function beforeTransaction(action: () => Promise<void>) {
  let pending = true;
  return new Proxy(db, {
    get(target, key, receiver) {
      if (key !== 'transaction') return Reflect.get(target, key, receiver);
      return async (...args: Parameters<typeof db.transaction>) => {
        if (pending) { pending = false; await action(); }
        return target.transaction(...args);
      };
    },
  });
}

describe('directory email changes and pending links', () => {
  it('revokes the old link, keeps a same-identity existing session, and accepts a new-email link only once', async () => {
    await syncMembers(db, directory('old@example.org'), now);
    const oldPending = await issue('old@example.org');
    const firstSession = await consumeLoginToken(db, await issue('old@example.org'), now);
    expect(firstSession.ok).toBe(true);

    await syncMembers(db, directory('new@example.org'), now);
    expect((await consumeLoginToken(db, oldPending, now)).ok).toBe(false);
    expect(await db.select().from(sessions)).toHaveLength(1);
    if (firstSession.ok) {
      expect((await getMemberForSession(db, firstSession.sessionToken, now))?.email).toBe('new@example.org');
    }

    const currentLink = await issue('new@example.org');
    expect((await consumeLoginToken(db, currentLink, now)).ok).toBe(true);
    expect((await consumeLoginToken(db, currentLink, now)).ok).toBe(false);
  });

  it('does not revive pending links when the email changes away and back', async () => {
    await db.delete(loginTokens);
    await syncMembers(db, directory('roundtrip@example.org'), now);
    const oldPending = await issue('roundtrip@example.org');
    await syncMembers(db, directory('temporary@example.org'), now);
    await syncMembers(db, directory('roundtrip@example.org'), now);
    expect((await consumeLoginToken(db, oldPending, now)).ok).toBe(false);
  });

  it('keeps an outstanding link through an unchanged-email sync', async () => {
    await db.delete(loginTokens);
    await syncMembers(db, directory('stable@example.org'), now);
    const pending = await issue('stable@example.org');
    await syncMembers(db, directory('STABLE@EXAMPLE.ORG'), now);
    expect((await consumeLoginToken(db, pending, now)).ok).toBe(true);
  });

  it('does not revive pending links after deactivation and reactivation', async () => {
    await db.delete(loginTokens);
    await syncMembers(db, directory('returning@example.org'), now);
    const pending = await issue('returning@example.org');
    await syncMembers(db, directory('returning@example.org', false), now);
    await syncMembers(db, directory('returning@example.org'), now);
    expect((await consumeLoginToken(db, pending, now)).ok).toBe(false);
  });

  it('does not issue to a stale email when sync commits before the issuance lock', async () => {
    await db.delete(loginTokens);
    await syncMembers(db, directory('racing-old@example.org'), now);
    const mailer = { sendLoginLink: vi.fn(async () => {}) };
    const racingDb = beforeTransaction(async () => {
      await syncMembers(db, directory('racing-new@example.org'), now);
    });
    await requestLoginLink(racingDb, 'racing-old@example.org', mailer, { baseUrl: 'http://fixture.test', now });
    expect(mailer.sendLoginLink).not.toHaveBeenCalled();
    expect(await db.select().from(loginTokens)).toEqual([]);
  });

  it('uses the current locked identity when two syncs overlap', async () => {
    await db.delete(loginTokens);
    await syncMembers(db, directory('first@example.org'), now);
    let intermediateLink = '';
    const racingDb = beforeTransaction(async () => {
      await syncMembers(db, directory('intermediate@example.org'), now);
      intermediateLink = await issue('intermediate@example.org');
    });
    await syncMembers(racingDb, directory('first@example.org'), now);
    expect((await consumeLoginToken(db, intermediateLink, now)).ok).toBe(false);
    expect((await consumeLoginToken(db, await issue('first@example.org'), now)).ok).toBe(true);
  });
});
