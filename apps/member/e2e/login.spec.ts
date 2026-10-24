import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Login flow', () => {
  test('member logs in and lands on home', async ({ page }) => {
    await login(page, 'ana@example.org');

    // Should be on home page
    await expect(page).toHaveURL('/');

    // Should see welcome message
    await expect(page.locator('h1')).toContainText('Welcome, Ana Rodriguez');
  });

  test('unknown email sees the same confirmation', async ({ page }) => {
    await page.goto('/login');

    const unknownEmail = 'unknown@example.org';
    await page.fill('input[type="email"]', unknownEmail);
    await page.click('button[type="submit"]');

    // Should see the same confirmation message
    await expect(page.locator('text=Check your email')).toBeVisible();
    await expect(page.locator(`text=${unknownEmail}`)).toBeVisible();
  });

  test('reused link shows the expired page', async ({ page }) => {
    // First, log in successfully
    await login(page, 'rob@example.org');
    await expect(page).toHaveURL('/');

    // Sign out
    await page.click('button:has-text("Sign out")');
    await expect(page).toHaveURL('/login');

    // Try to use the same link again
    const { promises: fs } = await import('fs');
    const mailFile = 'data/dev-mail/rob@example.org.txt';
    const loginUrl = await fs.readFile(mailFile, 'utf-8');

    await page.goto(loginUrl);

    // Should see expired message
    await expect(page.locator('h1')).toContainText('Link Expired');
    await expect(page.locator('text=This link has expired or was already used')).toBeVisible();
  });

  test('visiting / signed out redirects to /login', async ({ page }) => {
    await page.goto('/');

    // Should be redirected to login
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h1')).toContainText('Sign in to Inertia');
  });
});
