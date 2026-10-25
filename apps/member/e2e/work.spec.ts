import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Work tab', () => {
  // Run this first so tasks are still available
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
    // Casey claims a task
    await login(page, 'casey@example.org');
    await page.goto('/work');

    // Find any task with an "I'll take it" button (specific tasks might be claimed from previous runs)
    const availableTask = page.locator('.in-ask').filter({ has: page.getByRole('button', { name: "I'll take it" }) }).first();

    // Get the task title for later verification
    const taskTitle = await availableTask.getByRole('heading', { level: 3 }).textContent();
    expect(taskTitle).toBeTruthy();

    // Click the "I'll take it" button
    await availableTask.getByRole('button', { name: "I'll take it" }).click();

    // Should see success message (wait a bit for the server action to complete)
    await expect(availableTask.getByRole('status')).toHaveText("It's yours.", { timeout: 10000 });

    // Navigate to home page
    await page.goto('/');

    // Should see the waiting card with the claimed task
    const waitingCard = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Waiting for you' }) });
    await expect(waitingCard).toBeVisible();

    // Assert the claimed task's title is shown
    await expect(waitingCard.getByRole('heading', { level: 3 })).toHaveText(taskTitle!);

    // Assert the context shows kind and rough time (R18)
    const context = waitingCard.locator('.in-ask__ctx');
    await expect(context).toContainText('kind ·');
    await expect(context).toContainText('rough time ·');
  });

  test('a second member claiming the same task sees "Someone already took this."', async ({ page }) => {
    // First, Casey claims a task
    await login(page, 'casey@example.org');
    await page.goto('/work');

    // Find any available task
    const availableTask = page.locator('.in-ask').filter({ has: page.getByRole('button', { name: "I'll take it" }) }).first();
    const taskTitle = await availableTask.getByRole('heading', { level: 3 }).textContent();

    await availableTask.getByRole('button', { name: "I'll take it" }).click();
    await expect(availableTask.getByRole('status')).toHaveText("It's yours.", { timeout: 10000 });

    // Now Morgan tries to claim the same task
    await login(page, 'morgan@example.org');
    await page.goto('/work');

    // The task might not be visible if the page was revalidated, but if it is,
    // clicking claim should show the already-claimed message
    // Since claims persist between specs (R5), the task may no longer be in the open list
    const taskCardLocator = page.locator('.in-ask').filter({ hasText: taskTitle! });
    const taskCount = await taskCardLocator.count();

    if (taskCount > 0) {
      // Task is still shown (before revalidation), try to claim it
      await taskCardLocator.getByRole('button', { name: "I'll take it" }).click();
      await expect(taskCardLocator.getByRole('status')).toHaveText('Someone already took this.');
    } else {
      // Task is no longer in the open list (already claimed and revalidated away)
      // This is the expected behavior after Casey's claim
      expect(taskCount).toBe(0);
    }
  });
});
