import type { Mailer } from './auth';
import { promises as fs } from 'fs';
import path from 'path';

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
