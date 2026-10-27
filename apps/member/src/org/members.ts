import { randomUUID } from 'crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { loginTokens, members } from '../db/schema';
import type { Member } from '../identity/session';

export type Role = 'admin' | 'member';

export class MemberError extends Error {
  constructor(public readonly reason: 'invalid-email' | 'exists' | 'not-found' | 'last-admin' | 'forbidden', message: string) {
    super(message);
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  const value = email.trim().toLowerCase();
  if (!EMAIL.test(value) || value.length > 320) throw new MemberError('invalid-email', 'Enter a valid email address.');
  return value;
}

export function isAdmin(member: Pick<Member, 'role'>): boolean {
  return member.role === 'admin';
}

export function requireAdmin(member: Pick<Member, 'role'>): void {
  if (!isAdmin(member)) throw new MemberError('forbidden', 'Only admins can do that.');
}

/**
 * Makes sure the founder can sign in on a fresh install: if no admin exists,
 * the given email becomes the first admin. Does nothing once any admin exists.
 */
export async function ensureFounder(db: Db, email: string | undefined, displayName?: string): Promise<boolean> {
  if (!email?.trim()) return false;
  const normalized = normalizeEmail(email);
  // Until they change it, the founder is called by their email name: kyle@… → Kyle.
  const local = normalized.split('@')[0].split(/[._+-]/)[0];
  const name = displayName?.trim() || local.charAt(0).toUpperCase() + local.slice(1);
  return db.transaction(async (tx) => {
    const admins = await tx.select({ id: members.id }).from(members).where(eq(members.role, 'admin')).limit(1);
    if (admins.length) return false;
    const [existing] = await tx.select().from(members).where(eq(members.email, normalized));
    if (existing) {
      await tx.update(members).set({ role: 'admin', status: 'active' }).where(eq(members.id, existing.id));
    } else {
      await tx.insert(members).values({ externalId: `local:${randomUUID()}`, email: normalized, displayName: name, role: 'admin', origin: 'local' });
    }
    return true;
  });
}

export type MemberRow = Pick<Member, 'id' | 'email' | 'displayName' | 'status' | 'role' | 'origin' | 'workUserId' | 'lastSeenAt'>;

export async function listMembers(db: Db): Promise<MemberRow[]> {
  return db
    .select({
      id: members.id,
      email: members.email,
      displayName: members.displayName,
      status: members.status,
      role: members.role,
      origin: members.origin,
      workUserId: members.workUserId,
      lastSeenAt: members.lastSeenAt,
    })
    .from(members)
    .orderBy(asc(members.displayName));
}

/** Adds a member by email. They sign in with an email link like everyone else. */
export async function addMember(db: Db, actor: Pick<Member, 'role'>, input: { email: string; displayName: string; role?: Role }): Promise<MemberRow> {
  requireAdmin(actor);
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim().slice(0, 120) || email.split('@')[0];
  const [existing] = await db.select().from(members).where(eq(members.email, email));
  if (existing && existing.status === 'active') throw new MemberError('exists', 'That person is already a member.');
  if (existing) {
    const [row] = await db.update(members).set({ status: 'active', displayName, role: input.role ?? existing.role }).where(eq(members.id, existing.id)).returning();
    return row;
  }
  const [row] = await db
    .insert(members)
    .values({ externalId: `local:${randomUUID()}`, email, displayName, role: input.role ?? 'member', origin: 'local' })
    .returning();
  return row;
}

async function activeAdminCount(db: Db): Promise<number> {
  const rows = await db.select({ id: members.id }).from(members).where(and(eq(members.role, 'admin'), eq(members.status, 'active')));
  return rows.length;
}

export async function setRole(db: Db, actor: Pick<Member, 'role'>, memberId: string, role: Role): Promise<void> {
  requireAdmin(actor);
  const [target] = await db.select().from(members).where(eq(members.id, memberId));
  if (!target) throw new MemberError('not-found', 'Member not found.');
  if (target.role === 'admin' && role !== 'admin' && (await activeAdminCount(db)) <= 1) {
    throw new MemberError('last-admin', 'Keep at least one admin.');
  }
  await db.update(members).set({ role }).where(eq(members.id, memberId));
}

/** Links a member to their user in the work engine, so claims assign tasks to them. */
export async function setWorkUser(db: Db, actor: Pick<Member, 'role'>, memberId: string, workUserId: string | null): Promise<void> {
  requireAdmin(actor);
  await db.update(members).set({ workUserId: workUserId?.trim() || null }).where(eq(members.id, memberId));
}

/** Removes access without deleting history: the member is marked inactive and open login links stop working. */
export async function removeMember(db: Db, actor: Pick<Member, 'role'>, memberId: string, now = new Date()): Promise<void> {
  requireAdmin(actor);
  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(members).where(eq(members.id, memberId)).for('update');
    if (!target) throw new MemberError('not-found', 'Member not found.');
    if (target.role === 'admin') {
      const admins = await tx.select({ id: members.id }).from(members).where(and(eq(members.role, 'admin'), eq(members.status, 'active')));
      if (admins.length <= 1) throw new MemberError('last-admin', 'Keep at least one admin.');
    }
    await tx.update(members).set({ status: 'inactive' }).where(eq(members.id, memberId));
    await tx.update(loginTokens).set({ usedAt: now }).where(and(eq(loginTokens.memberId, memberId), isNull(loginTokens.usedAt)));
  });
}
