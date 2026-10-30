import { NextRequest, NextResponse, after } from 'next/server';
import { getDb } from '../../../db/client';
import { requestLoginLink } from '../../../identity/auth';
import { mailerFor } from '../../../identity/mailer';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // The same answer for every input, so it reveals nothing about who is a member.
  const mailer = mailerFor();
  const response = NextResponse.json({ ok: true, delivery: mailer ? 'email' : 'admin' });
  if (!mailer) return response;

  // Do the actual work asynchronously to avoid timing attacks
  after(async () => {
    try {
      const db = getDb();
      const baseUrl = process.env.MEMBER_APP_BASE_URL || 'http://localhost:3000';
      await requestLoginLink(db, email, mailer, { baseUrl });
    } catch (error) {
      // Log errors but don't expose them to the client
      console.error('Error in request-login (after):', error);
    }
  });

  return response;
}
