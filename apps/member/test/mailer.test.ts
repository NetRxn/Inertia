import { describe, it, expect } from 'vitest';
import { mailerFor, mailerMode, resendMailer } from '../src/identity/mailer';

describe('sign-in email', () => {
  it('uses Resend when its key and a from address are set, and admin links otherwise in production', () => {
    expect(mailerMode({ NODE_ENV: 'production', RESEND_API_KEY: 're_test', MEMBER_APP_MAIL_FROM: 'Inertia <login@inertia.ing>' })).toBe('resend');
    expect(mailerMode({ NODE_ENV: 'production', RESEND_API_KEY: 're_test' })).toBe('none');
    expect(mailerMode({ NODE_ENV: 'production' })).toBe('none');
    expect(mailerMode({ NODE_ENV: 'development' })).toBe('dev');
    expect(mailerMode({ NODE_ENV: 'production', MEMBER_APP_MAILER: 'none', RESEND_API_KEY: 're_test', MEMBER_APP_MAIL_FROM: 'a@b.c' })).toBe('none');
    expect(mailerFor({ NODE_ENV: 'production' })).toBeNull();
  });

  it('sends the link through Resend with the key in the header, not the body', async () => {
    const sent: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent.push({ url, headers: new Headers(init.headers), body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 });
    }) as unknown as typeof fetch;
    await resendMailer('re_test', 'Inertia <login@inertia.ing>', fetchImpl).sendLoginLink('ana@example.org', 'https://inertia.ing/auth/verify?token=abc');

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://api.resend.com/emails');
    expect(sent[0].headers.get('authorization')).toBe('Bearer re_test');
    expect(sent[0].body).toMatchObject({ from: 'Inertia <login@inertia.ing>', to: ['ana@example.org'], subject: 'Your Inertia sign-in link' });
    expect(String(sent[0].body.text)).toContain('https://inertia.ing/auth/verify?token=abc');
    expect(String(sent[0].body.html)).toContain('href="https://inertia.ing/auth/verify?token=abc"');
    expect(JSON.stringify(sent[0].body)).not.toContain('re_test');
  });

  it('reports a refused send instead of failing silently', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ message: 'domain not verified' }), { status: 403 })) as unknown as typeof fetch;
    await expect(resendMailer('re_test', 'login@inertia.ing', fetchImpl).sendLoginLink('ana@example.org', 'https://x')).rejects.toThrow('403');
  });
});
