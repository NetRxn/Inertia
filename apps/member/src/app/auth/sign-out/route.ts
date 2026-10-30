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

  // Clear the cookie and redirect
  // The public base URL: behind a proxy, request.url is the server's own bind address.
  const response = NextResponse.redirect(new URL('/login', process.env.MEMBER_APP_BASE_URL || request.url), { status: 303 });
  response.cookies.delete(getSessionCookieName());

  return response;
}
