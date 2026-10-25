import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { login } from './helpers';

const CARD_ORDER = [
  'Waiting for you',
  'Top priorities',
  'Coming up',
  "Robert's Rules",
  'Last meeting',
  'This week',
  'From the chat',
  'Recently shared',
];

/** Signs in and waits for the feed to stream in behind its loading state. */
async function openHome(page: Page) {
  await login(page, 'ana@example.org');
  await expect(page.getByRole('heading', { level: 2, name: 'Waiting for you' })).toBeVisible();
}

test.describe('Home feed', () => {
  test('home shows cards in order', async ({ page }) => {
    await openHome(page);

    const headings = await page.locator('main h2').allTextContents();
    const present = headings.map((h) => h.trim());

    // Every heading is a known card, at most once, in the fixed relative order (R4).
    expect(present.every((h) => CARD_ORDER.includes(h))).toBe(true);
    expect(new Set(present).size).toBe(present.length);
    const positions = present.map((h) => CARD_ORDER.indexOf(h));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    expect(present[0]).toBe('Waiting for you');
    // Seeded shares mean the feed always ends with Recently shared (R24).
    expect(present).toContain('Recently shared');
    expect(present.at(-1)).toBe('Recently shared');

    // Ana has nothing claimed in the fixture, so the waiting card shows its empty state.
    await expect(page.getByText('Nothing waiting for you. See Work for things you could take on.')).toBeVisible();
    await expect(page.getByText('Ask the DAO anything…')).toBeVisible();
  });

  test('floating menu stays visible after scrolling', async ({ page }) => {
    await openHome(page);

    const menu = page.getByRole('navigation', { name: 'Sections' });
    const labels = await menu.getByRole('link').evaluateAll((links) => links.map((l) => l.getAttribute('aria-label')));
    expect(labels).toEqual(['Home', 'Votes', 'Work', 'Calendar', 'Docs', 'Profile']);
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
