import type { Mailer } from './auth';
import { promises as fs } from 'fs';
import path from 'path';

type Env = Record<string, string | undefined>;

/**
 * How sign-in links reach people. 'resend' emails them (RESEND_API_KEY and
 * MEMBER_APP_MAIL_FROM set); 'dev' writes them to files (development and
 * e2e); 'none' sends nothing, so members get their link from an admin.
 * MEMBER_APP_MAILER picks one explicitly.
 */
export function mailerMode(env: Env = process.env): 'resend' | 'dev' | 'none' {
  const mode = env.MEMBER_APP_MAILER?.trim();
  const resendReady = Boolean(env.RESEND_API_KEY?.trim() && env.MEMBER_APP_MAIL_FROM?.trim());
  if (mode === 'dev' || mode === 'none') return mode;
  if (mode === 'resend') return resendReady ? 'resend' : 'none';
  if (resendReady) return 'resend';
  return env.NODE_ENV === 'production' ? 'none' : 'dev';
}

/** The mailer for the current settings, or null when links come from an admin. */
export function mailerFor(env: Env = process.env): Mailer | null {
  const mode = mailerMode(env);
  if (mode === 'resend') return resendMailer(env.RESEND_API_KEY!.trim(), env.MEMBER_APP_MAIL_FROM!.trim());
  if (mode === 'dev') return devMailer(env.MEMBER_APP_MAIL_DIR || 'data/dev-mail');
  return null;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

/** Sends sign-in links with Resend's HTTP API (https://resend.com). The sending domain must be verified there. */
export function resendMailer(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    async sendLoginLink(to: string, url: string) {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [to],
          subject: 'Your Inertia sign-in link',
          text: `Sign in to Inertia:\n\n${url}\n\nThe link works once, for an hour. If you didn't ask for it, ignore this email.`,
          html: `<p>Sign in to Inertia:</p><p><a href="${escapeHtml(url)}">Sign in</a></p><p style="color:#666">The link works once, for an hour. If you didn't ask for it, ignore this email.</p>`,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Resend refused the sign-in email (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
      }
    },
  };
}

/**
 * Creates a dev mailer that logs the link and writes it to a file.
 * Used for development and e2e testing.
 */
export function devMailer(dir: string): Mailer {
  return {
    async sendLoginLink(to: string, url: string) {
      console.log(`[DEV MAILER] Login link for ${to}: ${url}`);

      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Write the URL to a file named after the email
      const filename = path.join(dir, `${to}.txt`);
      await fs.writeFile(filename, url, 'utf-8');
    },
  };
}
