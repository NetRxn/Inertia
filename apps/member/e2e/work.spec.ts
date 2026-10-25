import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Work tab', () => {
  test('segmented control switches between Needs a person, Initiatives, and Ideas', async ({ page }) => {
    await login(page, 'casey@example.org');
    await page.goto('/work');

    // Should default to "Needs a person" tab
    const needsTab = page.getByRole('tab', { name: 'Needs a person' });
    await expect(needsTab).toHaveAttribute('aria-selected', 'true');

    // Should show at least one task or empty state
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();

    // Click Initiatives tab
    await page.getByRole('tab', { name: 'Initiatives' }).click();
    await page.waitForURL(/tab=initiatives/);
    await expect(page.getByRole('heading', { level: 2, name: 'Top priorities' })).toBeVisible();

    // Click Ideas tab
    await page.getByRole('tab', { name: 'Ideas' }).click();
    await page.waitForURL(/tab=ideas/);
    await expect(page.getByText('What should we work on together?')).toBeVisible();

    // Click back to Needs a person tab
    await needsTab.click();
    await page.waitForURL(/\/work$/); // No query params means default tab

    // Tabs should be keyboard navigable
    await needsTab.focus();
    await expect(needsTab).toBeFocused();
  });

  test('claiming a task shows "It\'s yours." and it appears in Waiting for you on Home', async ({ page }) => {
    // Casey claims "Design community garden signage" (R16)
    await login(page, 'casey@example.org');
    await page.goto('/work');

    // Find the specific task by its visible title
    const taskTitle = 'Design community garden signage';
    const taskCard = page.locator('.in-ask').filter({ hasText: taskTitle });

    // Click the "I'll take it" button
    await taskCard.getByRole('button', { name: "I'll take it" }).click();

    // Should see success message (R19: card stays mounted through revalidation)
    await expect(taskCard.getByRole('status')).toHaveText("It's yours.", { timeout: 10000 });

    // Navigate to home page
    await page.goto('/');

    // Should see the waiting card with the claimed task
    const waitingCard = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Waiting for you' }) });
    await expect(waitingCard).toBeVisible();

    // Assert the claimed task's title is shown
    await expect(waitingCard.getByRole('heading', { level: 3 })).toHaveText(taskTitle);

    // Assert the context shows kind and rough time (R18)
    const context = waitingCard.locator('.in-ask__ctx');
    await expect(context).toContainText('kind · creative');
    await expect(context).toContainText('rough time · ~120 min');
  });

  test('a second member claiming the same task sees "Someone already took this."', async ({ browser }) => {
    // Two browser contexts: Morgan opens /work first while task is still open,
    // Casey claims it in another context, then Morgan tries (R19)

    const morganContext = await browser.newContext();
    const morganPage = await morganContext.newPage();

    const caseyContext = await browser.newContext();
    const caseyPage = await caseyContext.newPage();

    try {
      // Morgan opens /work and sees "Reach out to local schools"
      await login(morganPage, 'morgan@example.org');
      await morganPage.goto('/work');

      const taskTitle = 'Reach out to local schools';
      const morganTaskCard = morganPage.locator('.in-ask').filter({ hasText: taskTitle });
      await expect(morganTaskCard.getByRole('button', { name: "I'll take it" })).toBeVisible();

      // Casey claims the same task in a different context
      await login(caseyPage, 'casey@example.org');
      await caseyPage.goto('/work');

      const caseyTaskCard = caseyPage.locator('.in-ask').filter({ hasText: taskTitle });
      await caseyTaskCard.getByRole('button', { name: "I'll take it" }).click();
      await expect(caseyTaskCard.getByRole('status')).toHaveText("It's yours.", { timeout: 10000 });

      // Now Morgan clicks "I'll take it" on their stale card
      await morganTaskCard.getByRole('button', { name: "I'll take it" }).click();

      // Morgan should see the already-claimed message (R19: failures don't revalidate)
      await expect(morganTaskCard.getByRole('status')).toHaveText('Someone already took this.', { timeout: 10000 });
    } finally {
      await morganContext.close();
      await caseyContext.close();
    }
  });
});
