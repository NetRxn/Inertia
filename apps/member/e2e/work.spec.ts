// Fresh server needed: claims persist per run (R5)
import { test, expect } from '@playwright/test';
import { login } from './helpers';

/** Task cards in Home's "You could help with". */
const helpWith = (page: import('@playwright/test').Page) => page.locator('#your-work');

test.describe('Work on Home and Agents', () => {
  test('Agents shows agent work and incoming data, and Connections', async ({ page }) => {
    await login(page, 'casey@example.org');
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Agents' }).click();
    await expect(page).toHaveURL('/agents');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'Agents' })).toBeVisible();
    await expect(main.getByText('Grant Writer finished')).toBeVisible();
    await expect(main.getByText('Buzz brought in')).toBeVisible();
    // Member work stays on Home.
    await expect(main.getByText('Design community garden signage').filter({ visible: true })).toHaveCount(0);

    await main.getByRole('navigation', { name: 'Agents sections' }).getByRole('link', { name: 'Connections' }).click();
    await page.waitForURL(/tab=connections/);
    await expect(main.getByRole('heading', { level: 2, name: 'Agents and their channels' })).toBeVisible();
    await expect(main.getByText('Paperclip', { exact: true })).toBeVisible();
  });

  test('old Work links land on Home and Agents', async ({ page }) => {
    await login(page, 'casey@example.org');
    await page.goto('/work');
    await expect(page).toHaveURL('/');
    // Next keeps the old query; Agents reads an unknown tab as Activity.
    await page.goto('/work?tab=status');
    await expect(page).toHaveURL(/\/agents(\?|$)/);
    await expect(page.getByRole('main').getByRole('heading', { level: 2, name: 'Agents this week' })).toBeVisible();
  });

  test('claiming a task shows "It\'s yours." and it appears in Waiting for you', async ({ page }) => {
    // Casey claims "Design community garden signage" (R16)
    await login(page, 'casey@example.org');

    const taskTitle = 'Design community garden signage';
    const taskCard = helpWith(page).locator('.in-ask').filter({ hasText: taskTitle });
    await expect(taskCard).toContainText('Inertia drafted three sign layouts and a materials list from the garden plan.');

    await taskCard.getByRole('button', { name: "I'll take it" }).click();
    // R19: the card stays mounted through revalidation
    await expect(taskCard.getByRole('status')).toHaveText("It's yours.", { timeout: 10000 });

    await page.reload();
    const waitingCard = page.getByRole('region', { name: 'Waiting for you' });
    await expect(waitingCard.getByRole('heading', { level: 3 })).toHaveText(taskTitle);
    await expect(waitingCard).toContainText('Inertia drafted three sign layouts and a materials list from the garden plan.');
    const context = waitingCard.locator('.in-ask__ctx');
    await expect(context).toContainText('kind · creative');
    await expect(context).toContainText('rough time · ~120 min');
  });

  test('a second member claiming the same task sees "Someone already took this."', async ({ browser }) => {
    // Morgan opens Home while the task is still open, Casey claims it, then Morgan tries (R19)
    const morganContext = await browser.newContext();
    const morganPage = await morganContext.newPage();
    const caseyContext = await browser.newContext();
    const caseyPage = await caseyContext.newPage();

    try {
      const taskTitle = 'Reach out to local schools';
      await login(morganPage, 'morgan@example.org');
      const morganTaskCard = helpWith(morganPage).locator('.in-ask').filter({ hasText: taskTitle });
      await expect(morganTaskCard.getByRole('button', { name: "I'll take it" })).toBeVisible();

      await login(caseyPage, 'casey@example.org');
      const caseyTaskCard = helpWith(caseyPage).locator('.in-ask').filter({ hasText: taskTitle });
      await caseyTaskCard.getByRole('button', { name: "I'll take it" }).click();
      await expect(caseyTaskCard.getByRole('status')).toHaveText("It's yours.", { timeout: 10000 });

      await morganTaskCard.getByRole('button', { name: "I'll take it" }).click();
      await expect(morganTaskCard.getByRole('status')).toHaveText('Someone already took this.', { timeout: 10000 });
    } finally {
      await morganContext.close();
      await caseyContext.close();
    }
  });
});
