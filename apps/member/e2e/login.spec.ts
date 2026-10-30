import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Login flow', () => {
  test('member logs in and lands on home', async ({ page }) => {
    await login(page, 'ana@example.org');

    // Should be on home page
    await expect(page).toHaveURL('/');

    // Should see the home greeting, by first name
    await expect(page.locator('h1')).toHaveText('Welcome, Ana');
  });

  test('unknown email sees the same confirmation', async ({ page }) => {
    await page.goto('/login');

    const unknownEmail = 'unknown@example.org';
    await page.fill('input[type="email"]', unknownEmail);
    await page.click('button[type="submit"]');

    // Should see the same confirmation message
    await expect(page.locator('text=Check your email for a sign-in link')).toBeVisible();
  });

  test('reused link shows the expired page', async ({ page }) => {
    // First, log in successfully
    await login(page, 'rob@example.org');
    await expect(page).toHaveURL('/');

    // Sign out from your profile in Organization → People
    await page.goto('/org?tab=people');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');

    // Try to use the same link again
    const { promises: fs } = await import('fs');
    const mailFile = 'data/dev-mail/rob@example.org.txt';
    const loginUrl = await fs.readFile(mailFile, 'utf-8');

    await page.goto(loginUrl);

    // Should see expired message
    await expect(page.locator('h1')).toContainText('Link expired');
    await expect(page.locator('text=This link has expired or was already used')).toBeVisible();
  });

  test('opening a link, as a chat preview would, does not use it up', async ({ page, request }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'rob@example.org');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Check your email');
    await page.waitForTimeout(500);
    const { promises: fs } = await import('fs');
    const loginUrl = await fs.readFile('data/dev-mail/rob@example.org.txt', 'utf-8');

    // A preview fetches the page; the link still works afterwards.
    expect((await request.get(loginUrl)).status()).toBe(200);
    await page.goto(loginUrl);
    await expect(page.locator('h1')).toContainText('Welcome back, Rob');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
  });

  test('visiting / signed out redirects to /login', async ({ page }) => {
    await page.goto('/');

    // Should be redirected to login
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h1')).toContainText('Sign in to Inertia');
  });
});
