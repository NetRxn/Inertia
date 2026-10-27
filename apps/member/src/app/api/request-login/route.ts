import { NextRequest, NextResponse, after } from 'next/server';
import { getDb } from '../../../db/client';
import { requestLoginLink } from '../../../identity/auth';
import { devMailer } from '../../../identity/mailer';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // Respond immediately with success for every input
  const response = NextResponse.json({ ok: true });

  // Do the actual work asynchronously to avoid timing attacks
  after(async () => {
    try {
      const db = getDb();
      const baseUrl = process.env.MEMBER_APP_BASE_URL || 'http://localhost:3000';
      const mailDir = process.env.MEMBER_APP_MAIL_DIR || 'data/dev-mail';
      const mailer = devMailer(mailDir);

      await requestLoginLink(db, email, mailer, { baseUrl });
    } catch (error) {
      // Log errors but don't expose them to the client
      console.error('Error in request-login (after):', error);
    }
  });

  return response;
}
