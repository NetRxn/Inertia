// The spec §9 path as one test: log in, see the feed, claim a task, share an
// idea, then ask the chat a question that cites a source. Lee and "Photograph
// the first coding night" belong to this spec alone, so no other spec's claims
// or shares show here. Runs against the scripted mock model (playwright.config).
import { test, expect } from '@playwright/test';
import { login } from './helpers';

const TASK = 'Photograph the first coding night';
const IDEA = 'A shared photo album for every coding night, so families can see what the kids built.';

test('full journey: login, feed, claim, share, ask', async ({ page }) => {
  // Log in and see the feed.
  await login(page, 'lee@example.org');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: 'Welcome, Lee' })).toBeVisible();
  for (const card of ['Waiting for you', 'Top priorities', 'Coming up', "Robert's Rules", 'Last meeting']) {
    await expect(main.getByRole('heading', { level: 2, name: card })).toBeVisible();
  }

  // Claim a task that needs a person.
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Work' }).click();
  await expect(page).toHaveURL('/work');
  const taskCard = page.locator('.in-ask').filter({ hasText: TASK });
  await taskCard.getByRole('button', { name: "I'll take it" }).click();
  await expect(taskCard.getByRole('status')).toHaveText("It's yours.", { timeout: 10_000 });

  // Share an idea.
  await page.getByRole('button', { name: '＋ Share' }).click();
  const composer = page.getByRole('dialog', { name: 'Share' });
  await composer.getByLabel('Description').fill(IDEA);
  await composer.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(composer).not.toBeVisible();

  // Back home, the claim waits for Lee and the idea is in Recently shared.
  await page.goto('/');
  const waiting = main.getByRole('region', { name: 'Waiting for you' });
  await expect(waiting.getByRole('heading', { level: 3 })).toHaveText(TASK);
  await expect(main.getByRole('region', { name: 'Recently shared' }).getByText(IDEA)).toBeVisible();

  // Ask the chat; the answer cites the meeting it came from.
  await page.getByRole('button', { name: 'Ask the DAO anything…' }).click();
  const sheet = page.getByRole('dialog', { name: 'Chat' });
  await sheet.getByLabel('Ask the DAO').fill('What did we decide at the last meeting?');
  await sheet.getByRole('button', { name: 'Send' }).click();
  await expect(sheet.getByText(/the most recent meeting was Community garden planning session/)).toBeVisible();
  const chip = sheet.getByRole('list', { name: 'Sources' }).getByRole('link', { name: /Community garden planning session/ });
  await expect(chip).toHaveAttribute('href', '/docs#meeting-meeting-1');

  // The chip opens that meeting's notes on Docs.
  await chip.click();
  await expect(page).toHaveURL('/docs#meeting-meeting-1');
  await expect(page.locator('#meeting-meeting-1')).toHaveAttribute('open', '');
});
