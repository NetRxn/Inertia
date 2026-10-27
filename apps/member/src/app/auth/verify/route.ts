import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../db/client';
import { consumeLoginToken } from '../../../identity/auth';
import { getSessionCookieName } from '../../../identity/session';

function renderExpiredPage(): NextResponse {
  return new NextResponse(
    `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Link Expired - Inertia</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 1rem;
          background: linear-gradient(to bottom, #f9fafb, #f3f4f6);
        }
        .card {
          background: white;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 2rem;
          max-width: 400px;
        }
        h1 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0 0 1rem 0;
          color: #111827;
        }
        p {
          color: #374151;
          line-height: 1.5;
          margin: 0 0 1.5rem 0;
        }
        a {
          display: inline-block;
          padding: 0.625rem 1rem;
          background-color: #3b82f6;
          color: white;
          text-decoration: none;
          border-radius: 0.375rem;
          font-weight: 500;
        }
        a:hover {
          background-color: #2563eb;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Link Expired</h1>
        <p>This link has expired or was already used. Request a new one.</p>
        <a href="/login">Return to sign in</a>
      </div>
    </body>
    </html>
    `,
    {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    }
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return renderExpiredPage();
  }

  const db = getDb();
  const result = await consumeLoginToken(db, token);

  if (!result.ok) {
    return renderExpiredPage();
  }

  // Set the session cookie
  const isProduction = process.env.NODE_ENV === 'production';
  const response = NextResponse.redirect(new URL('/', request.url));

  response.cookies.set({
    name: getSessionCookieName(),
    value: result.sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  });

  return response;
}
