import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../db/client';
import { checkLoginToken, consumeLoginToken } from '../../../identity/auth';
import { getSessionCookieName } from '../../../identity/session';

const PAGE_STYLE = `
  body { font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 1rem; background: #f2ecdf; color: #1d1a16; }
  .card { background: #fbf8f1; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); padding: 2rem; max-width: 400px; width: 100%; }
  h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 1rem 0; }
  p { line-height: 1.5; margin: 0 0 1.5rem 0; color: #4a443b; }
  a, button { display: inline-block; padding: 0.75rem 1.25rem; background: #d4542b; color: white; text-decoration: none; border: 0; border-radius: 999px; font: inherit; font-weight: 600; cursor: pointer; }
`;

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

function page(title: string, body: string, status: number): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex"><title>${title} - Inertia</title><style>${PAGE_STYLE}</style></head><body><div class="card">${body}</div></body></html>`,
    // no-store: the page carries a live token.
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin' } },
  );
}

function renderExpiredPage(): NextResponse {
  return page('Link expired', '<h1>Link expired</h1><p>This link has expired or was already used. Request a new one.</p><a href="/login">Return to sign in</a>', 400);
}

/** The press that signs in. Opening the link only shows this, so link previews can't use it up. */
function renderConfirmPage(token: string, firstName: string): NextResponse {
  return page(
    'Sign in',
    `<h1>Welcome back, ${escapeHtml(firstName)}</h1><p>Press the button to sign in to Inertia on this device.</p><form method="POST" action="/auth/verify"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">Sign in</button></form>`,
    200,
  );
}

/** The public origin: behind a proxy, request.url is the server's own bind address. */
function publicOrigin(request: NextRequest): string {
  return new URL(process.env.MEMBER_APP_BASE_URL || request.url).origin;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return renderExpiredPage();
  const result = await checkLoginToken(getDb(), token);
  return result.ok ? renderConfirmPage(token, result.firstName) : renderExpiredPage();
}

export async function POST(request: NextRequest) {
  // Only this app's own page may sign someone in (no signing a visitor into another account).
  const origin = request.headers.get('origin');
  if (origin && origin !== publicOrigin(request) && origin !== new URL(request.url).origin) return renderExpiredPage();

  const form = await request.formData().catch(() => null);
  const token = form?.get('token');
  if (typeof token !== 'string' || !token) return renderExpiredPage();

  const result = await consumeLoginToken(getDb(), token);
  if (!result.ok) return renderExpiredPage();

  const response = NextResponse.redirect(new URL('/', publicOrigin(request)), 303);
  response.cookies.set({
    name: getSessionCookieName(),
    value: result.sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    // The server ends the session after 90 days unused; the cookie just has to outlive that.
    maxAge: 400 * 24 * 60 * 60,
    path: '/',
  });
  return response;
}
