import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getDb } from '../db/client';
import { getMemberForSession } from './auth';
import type { members } from '../db/schema';

export type Member = typeof members.$inferSelect;

const SESSION_COOKIE_NAME = 'inertia_session';

/**
 * Gets the current member from the session cookie.
 * Redirects to /login if there is no valid session.
 */
export async function requireMember(): Promise<Member> {
  await connection();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect('/login');
  }

  const db = getDb();
  const member = await getMemberForSession(db, sessionToken);

  if (!member) {
    redirect('/login');
  }

  return member;
}

/**
 * Gets the session cookie name (useful for setting cookies in route handlers).
 */
export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}
