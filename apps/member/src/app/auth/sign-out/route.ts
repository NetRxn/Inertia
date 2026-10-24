import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '../../../db/client';
import { signOut } from '../../../identity/auth';
import { getSessionCookieName } from '../../../identity/session';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(getSessionCookieName())?.value;

  if (sessionToken) {
    const db = getDb();
    await signOut(db, sessionToken);
  }

  // Clear the cookie
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(getSessionCookieName());

  return response;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(getSessionCookieName())?.value;

  if (sessionToken) {
    const db = getDb();
    await signOut(db, sessionToken);
  }

  // Clear the cookie and redirect
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete(getSessionCookieName());

  return response;
}
