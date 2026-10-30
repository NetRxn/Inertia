import type { Page } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Logs in as the given email by submitting the login form and following
 * the link from the dev mail file.
 */
export async function login(page: Page, email: string): Promise<void> {
  // Navigate to login page
  await page.goto('/login');

  // Fill in email and submit
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');

  // Wait for confirmation message
  await page.waitForSelector('text=Check your email');

  // Read the login link from the dev mail file
  const mailDir = 'data/dev-mail';
  const mailFile = path.join(mailDir, `${email}.txt`);

  // Wait a bit for the file to be written
  await page.waitForTimeout(500);

  const loginUrl = await fs.readFile(mailFile, 'utf-8');

  // Open the link: it only shows a Sign in button, so a chat preview can't use it up.
  await page.goto(loginUrl);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Should be redirected to home page
  await page.waitForURL('/');
}
