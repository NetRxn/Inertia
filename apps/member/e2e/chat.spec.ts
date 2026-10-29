// Runs against the scripted mock model (MEMBER_APP_MODEL_PROVIDER=mock in playwright.config).
import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Chat', () => {
  test('asking about the last meeting shows an answer with a source chip', async ({ page }) => {
    await login(page, 'sam@example.org');

    await page.getByRole('button', { name: 'Ask the DAO anything…' }).click();
    const sheet = page.getByRole('dialog', { name: 'Chat' });
    await expect(sheet).toBeVisible();

    await sheet.getByLabel('Ask the DAO').fill('What happened at the last meeting?');
    await sheet.getByRole('button', { name: 'Send' }).click();

    await expect(sheet.getByText('What happened at the last meeting?')).toBeVisible();
    await expect(sheet.getByText(/the most recent meeting was Community garden planning session/)).toBeVisible();

    const chip = sheet.getByRole('list', { name: 'Sources' }).getByRole('link', { name: /Community garden planning session/ });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute('href', /^\/org\?tab=docs#meeting-/);

    // Dismissing by the handle puts the sheet away; reopening keeps the conversation.
    await sheet.getByRole('button', { name: 'Close chat' }).click();
    await expect(sheet).not.toBeVisible();
    await page.getByRole('button', { name: 'Ask the DAO anything…' }).click();
    await expect(page.getByRole('dialog', { name: 'Chat' }).getByText('What happened at the last meeting?')).toBeVisible();
  });

  test('tapping the Coming up card sends the card question', async ({ page }) => {
    await login(page, 'jordan@example.org');

    const card = page.getByRole('region', { name: 'Coming up' });
    await card.getByRole('heading', { level: 2, name: 'Coming up' }).click();

    const sheet = page.getByRole('dialog', { name: 'Chat' });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-role="user"]')).toHaveText("What's coming up in the next two weeks?");
    await expect(sheet.getByRole('list', { name: 'Sources' })).toBeVisible();
  });
});
