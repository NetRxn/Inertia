import type { Mailer } from './auth';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * How sign-in links reach people. 'dev' writes them to files (development and
 * e2e); 'none' sends nothing, so members get their link from an admin.
 * Defaults to 'none' in production, since there is no email delivery yet.
 */
export function mailerMode(env: Record<string, string | undefined> = process.env): 'dev' | 'none' {
  const mode = env.MEMBER_APP_MAILER?.trim();
  if (mode === 'dev' || mode === 'none') return mode;
  return env.NODE_ENV === 'production' ? 'none' : 'dev';
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
