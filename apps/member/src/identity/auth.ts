import type { Db } from '../db/client';
import { members, loginTokens, sessions } from '../db/schema';
import { eq, and, gte, isNull } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';

export interface Mailer {
  sendLoginLink(to: string, url: string): Promise<void>;
}

interface RequestLoginLinkOptions {
  baseUrl: string;
  now?: Date;
}

interface ConsumeResult {
  ok: true;
  sessionToken: string;
  memberId: string;
}

interface ConsumeFailure {
  ok: false;
  reason: 'invalid' | 'expired' | 'used' | 'inactive';
}

export type ConsumeLoginTokenResult = ConsumeResult | ConsumeFailure;

/**
 * Generates a random token and returns both the token and its SHA-256 hash.
 */
function generateToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Computes the SHA-256 hash of a token.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Requests a login link for a member. Sends at most 5 links per member per rolling hour.
 * Silently ignores unknown or inactive members.
 */
export async function requestLoginLink(
  db: Db,
  email: string,
  mailer: Mailer,
  opts: RequestLoginLinkOptions
): Promise<void> {
  const now = opts.now ?? new Date();
  const lowercaseEmail = email.toLowerCase();

  // Find the member
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.email, lowercaseEmail), eq(members.status, 'active')))
    .limit(1);

  if (!member) {
    // Silently ignore unknown or inactive members
    return;
  }

  // Rate limit check and insert in transaction (atomic)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const { token, hash } = generateToken();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

  // Track whether a token was inserted so we only send mail after commit
  let tokenInserted = false;

  await db.transaction(async (tx) => {
    // Lock the member's row to serialize concurrent rate-limit checks
    // (prevents race where two requests both count 4 tokens and both insert)
    const [currentMember] = await tx
      .select()
      .from(members)
      .where(eq(members.id, member.id))
      .for('update');

    // The directory may have changed while this request waited for the lock.
    if (!currentMember || currentMember.status !== 'active' || currentMember.email !== lowercaseEmail) return;

    // Check rate limit: 5 per rolling hour
    const recentTokens = await tx
      .select()
      .from(loginTokens)
      .where(and(eq(loginTokens.memberId, member.id), gte(loginTokens.createdAt, oneHourAgo)));

    if (recentTokens.length >= 5) {
      // Rate limit exceeded, silently ignore
      return;
    }

    // Store the token hash
    await tx.insert(loginTokens).values({
      memberId: member.id,
      tokenHash: hash,
      expiresAt,
      createdAt: now,
    });

    tokenInserted = true;
  });

  // Send the login link only after transaction commits and only if a token was inserted
  if (tokenInserted) {
    const url = `${opts.baseUrl}/auth/verify?token=${token}`;
    await mailer.sendLoginLink(lowercaseEmail, url);
  }
}

/**
 * Consumes a login token and creates a session if valid.
 * Returns the session token on success, or an error reason on failure.
 * Uses atomic UPDATE to ensure single-use tokens even under concurrency.
 */
export async function consumeLoginToken(
  db: Db,
  token: string,
  now?: Date
): Promise<ConsumeLoginTokenResult> {
  const currentTime = now ?? new Date();
  const tokenHash = hashToken(token);

  // Find the token
  const [loginToken] = await db
    .select()
    .from(loginTokens)
    .where(eq(loginTokens.tokenHash, tokenHash))
    .limit(1);

  if (!loginToken) {
    return { ok: false, reason: 'invalid' };
  }

  // Check if expired
  if (loginToken.expiresAt < currentTime) {
    return { ok: false, reason: 'expired' };
  }

  return db.transaction(async (tx): Promise<ConsumeLoginTokenResult> => {
    // Serialize with issuance and directory sync. A consumption that commits
    // before an email change is an existing session; after it, the link is used.
    const [member] = await tx
      .select()
      .from(members)
      .where(eq(members.id, loginToken.memberId))
      .limit(1)
      .for('update');

    if (!member || member.status !== 'active') {
      return { ok: false, reason: 'inactive' };
    }

    // Atomically mark token as used (race-safe)
    const updatedRows = await tx
      .update(loginTokens)
      .set({ usedAt: currentTime })
      .where(and(eq(loginTokens.id, loginToken.id), isNull(loginTokens.usedAt)))
      .returning();

    if (updatedRows.length === 0) {
      // Token was already used by another concurrent request
      return { ok: false, reason: 'used' };
    }

    // Create session
    const { token: sessionToken, hash: sessionHash } = generateToken();
    const sessionExpiresAt = new Date(currentTime.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await tx.insert(sessions).values({
      memberId: member.id,
      tokenHash: sessionHash,
      expiresAt: sessionExpiresAt,
      createdAt: currentTime,
    });

    return { ok: true, sessionToken, memberId: member.id };
  });
}

/**
 * Gets the member for a session token. Returns null for an unknown, expired,
 * or inactive member. Updates lastSeenAt at most once per 5 minutes.
 */
export async function getMemberForSession(
  db: Db,
  sessionToken: string,
  now?: Date
): Promise<(typeof members.$inferSelect) | null> {
  const currentTime = now ?? new Date();
  const sessionHash = hashToken(sessionToken);

  // Find the session
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, sessionHash))
    .limit(1);

  if (!session) {
    return null;
  }

  // Check if expired
  if (session.expiresAt < currentTime) {
    return null;
  }

  // Get the member
  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, session.memberId))
    .limit(1);

  if (!member || member.status !== 'active') {
    return null;
  }

  // Update lastSeenAt if more than 5 minutes have passed
  const fiveMinutesAgo = new Date(currentTime.getTime() - 5 * 60 * 1000);
  if (!member.lastSeenAt || member.lastSeenAt < fiveMinutesAgo) {
    await db.update(members).set({ lastSeenAt: currentTime }).where(eq(members.id, member.id));
    // Return updated member
    return { ...member, lastSeenAt: currentTime };
  }

  return member;
}

/**
 * Signs out a session by deleting it.
 */
export async function signOut(db: Db, sessionToken: string): Promise<void> {
  const sessionHash = hashToken(sessionToken);
  await db.delete(sessions).where(eq(sessions.tokenHash, sessionHash));
}
