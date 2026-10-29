import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { login } from './helpers';

/** Signs in and waits for the feed to stream in behind its loading state. */
async function openHome(page: Page) {
  await login(page, 'ana@example.org');
  await expect(page.getByRole('heading', { level: 2, name: 'You could help with' })).toBeVisible();
}

test.describe('Home feed', () => {
  test('home shows the initiatives, work to help with and what has been happening', async ({ page }) => {
    await openHome(page);
    const main = page.getByRole('main');

    // The seeded organization's initiatives, joined to the work engine's goals.
    const initiatives = main.getByRole('region', { name: 'Initiatives' });
    await expect(initiatives.getByRole('heading', { name: 'Community garden grant' })).toBeVisible();
    await expect(initiatives.getByRole('listitem').filter({ hasText: 'Treasury policy v2' }).getByText('Awaiting vote')).toBeVisible();

    await expect(main.getByText('Design community garden signage')).toBeVisible();
    await expect(main.getByText('Add to Inertia: notes, transcripts, links')).toBeVisible();

    const happening = main.getByRole('region', { name: "What's been happening" });
    await expect(happening.getByText('Meeting notes:').first()).toBeVisible();
    // Agent work stays on Agents.
    await expect(happening.getByText('Grant Writer')).toHaveCount(0);
    await expect(page.getByText('Ask the DAO anything…')).toBeVisible();
  });

  test('a filter and an initiative narrow the feed', async ({ page }) => {
    await openHome(page);
    const main = page.getByRole('main');

    await main.getByRole('navigation', { name: 'Show' }).getByRole('link', { name: 'Meetings' }).click();
    await page.waitForURL(/show=meetings/);
    const happening = main.getByRole('region', { name: "What's been happening" });
    await expect(happening.getByText('Meeting notes:').first()).toBeVisible();
    await expect(happening.getByText('Vote:')).toHaveCount(0);

    await main.getByRole('region', { name: 'Initiatives' }).getByRole('link', { name: /Youth coding nights/ }).click();
    await page.waitForURL(/initiative=init-coding/);
    await expect(main.getByRole('heading', { level: 2, name: 'Open in Youth coding nights' })).toBeVisible();
    await expect(main.getByText('Design community garden signage')).toHaveCount(0);
  });

  test('the menu is Agents, Home and Organization, and stays visible after scrolling', async ({ page }) => {
    await openHome(page);

    const menu = page.getByRole('navigation', { name: 'Sections' });
    await expect(menu.getByRole('link')).toHaveText(['Agents', 'Home', 'Organization']);
    await expect(menu.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await expect(menu).toBeInViewport();
    const box = await menu.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThan(40);
  });

  test('layout has no horizontal scroll at 375px width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openHome(page);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
