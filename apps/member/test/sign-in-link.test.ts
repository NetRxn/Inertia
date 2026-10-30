import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { consumeLoginToken, issueSignInLink, ISSUED_LINK_TTL_MS } from '../src/identity/auth';
import { mailerMode } from '../src/identity/mailer';
import { syncMembers } from '../src/identity/sync';
import { createFixtureAdapters, FIXTURE_NOW } from '../src/adapters';
import { loginTokens, members } from '../src/db/schema';

const tokenOf = (url: string) => new URL(url).searchParams.get('token')!;

describe('issueSignInLink', () => {
  let db: Db;
  let anaId: string;

  beforeEach(async () => {
    db = await createTestDb();
    await syncMembers(db, createFixtureAdapters().directory, FIXTURE_NOW);
    [{ id: anaId }] = await db.select({ id: members.id }).from(members).where(eq(members.email, 'ana@example.org'));
  });

  it('issues a one-time link that signs the member in, storing only a hash', async () => {
    const issued = await issueSignInLink(db, anaId, { baseUrl: 'https://app.example.org/', now: FIXTURE_NOW });
    expect(issued!.url.startsWith('https://app.example.org/auth/verify?token=')).toBe(true);
    expect(issued!.expiresAt.getTime()).toBe(FIXTURE_NOW.getTime() + ISSUED_LINK_TTL_MS);

    const [stored] = await db.select().from(loginTokens).where(eq(loginTokens.memberId, anaId));
    expect(stored.tokenHash).not.toBe(tokenOf(issued!.url));

    const first = await consumeLoginToken(db, tokenOf(issued!.url), FIXTURE_NOW);
    expect(first.ok).toBe(true);
    const second = await consumeLoginToken(db, tokenOf(issued!.url), FIXTURE_NOW);
    expect(second).toEqual({ ok: false, reason: 'used' });
  });

  it('stays valid for three days, not fifteen minutes', async () => {
    const issued = await issueSignInLink(db, anaId, { baseUrl: 'http://localhost:3000', now: FIXTURE_NOW });
    const twoDaysLater = new Date(FIXTURE_NOW.getTime() + 2 * 24 * 60 * 60 * 1000);
    expect((await consumeLoginToken(db, tokenOf(issued!.url), twoDaysLater)).ok).toBe(true);
  });

  it('refuses inactive and unknown members', async () => {
    const [pat] = await db.select({ id: members.id }).from(members).where(eq(members.email, 'pat@example.org'));
    expect(await issueSignInLink(db, pat.id, { baseUrl: 'http://localhost:3000' })).toBeNull();
    expect(await issueSignInLink(db, '00000000-0000-4000-8000-000000000000', { baseUrl: 'http://localhost:3000' })).toBeNull();
  });
});

describe('mailerMode', () => {
  it('sends nothing in production unless asked', () => {
    expect(mailerMode({ NODE_ENV: 'production' })).toBe('none');
    expect(mailerMode({ NODE_ENV: 'production', MEMBER_APP_MAILER: 'dev' })).toBe('dev');
    expect(mailerMode({ NODE_ENV: 'development' })).toBe('dev');
    expect(mailerMode({ NODE_ENV: 'development', MEMBER_APP_MAILER: 'none' })).toBe('none');
  });
});
