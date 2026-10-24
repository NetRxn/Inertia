import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../db/client';
import { requestLoginLink } from '../../../identity/auth';
import { devMailer } from '../../../identity/mailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = getDb();
    const baseUrl = process.env.MEMBER_APP_BASE_URL || 'http://localhost:3000';
    const mailDir = process.env.MEMBER_APP_MAIL_DIR || 'data/dev-mail';
    const mailer = devMailer(mailDir);

    await requestLoginLink(db, email, mailer, { baseUrl });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in request-login:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
