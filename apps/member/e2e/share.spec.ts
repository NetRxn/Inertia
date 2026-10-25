// Fresh server needed: shares persist per run (R5)
import { test, expect } from '@playwright/test';
import { login } from './helpers';

const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]>>endobj\ntrailer<</Root 1 0 R>>');

/** Opens the composer on the Work tab. */
async function openComposer(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '＋ Share' }).click();
  return page.getByRole('dialog', { name: 'Share' });
}

/** The Ideas segment of the Work tab. */
function ideasSection(page: import('@playwright/test').Page) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { level: 2, name: 'Ideas' }) });
}

test.describe('Share', () => {
  test('posting an idea with a link shows it under Ideas and in Recently shared', async ({ page }) => {
    await login(page, 'riley@example.org');
    await page.goto('/work');

    // ＋ Share floats above the chat bar and opens the composer.
    const shareButton = page.getByRole('button', { name: '＋ Share' });
    await expect(shareButton).toBeVisible();
    const dialog = await openComposer(page);
    await expect(dialog).toBeVisible();

    // New idea is selected by default.
    await expect(dialog.getByRole('button', { name: 'New idea' })).toHaveAttribute('aria-pressed', 'true');

    await dialog.getByLabel('Link').fill('https://cityofexample.gov/micro-grants');
    await dialog.getByLabel('Description').fill('City micro-grants could fund the garden expansion next spring.');

    await dialog.getByRole('button', { name: 'Post', exact: true }).click();

    // The composer closes and the share lands in the Ideas segment.
    await expect(dialog).not.toBeVisible();
    await page.getByRole('link', { name: 'Ideas' }).click();
    await page.waitForURL(/tab=ideas/);
    const ideas = ideasSection(page);
    await expect(ideas.getByText('City micro-grants could fund the garden expansion next spring.')).toBeVisible();
    await expect(ideas.getByRole('link', { name: /cityofexample/ })).toBeVisible();

    // And in the home feed's Recently shared card.
    await page.goto('/');
    const recentlyShared = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { level: 2, name: 'Recently shared' }) });
    await expect(recentlyShared.getByText('City micro-grants could fund the garden expansion next spring.')).toBeVisible();
  });

  test('a description containing <script> renders as text', async ({ page }) => {
    await login(page, 'quinn@example.org');
    await page.goto('/work');

    const dialog = await openComposer(page);
    await dialog.getByLabel('Description').fill('<script>window.sharePwned = true</script> garden plan');
    await dialog.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    await page.getByRole('link', { name: 'Ideas' }).click();
    await page.waitForURL(/tab=ideas/);
    const ideas = ideasSection(page);
    // The markup is visible verbatim, as text.
    await expect(ideas.getByText('<script>window.sharePwned = true</script> garden plan')).toBeVisible();
    await expect(ideas.locator('script')).toHaveCount(0);

    // Nothing ran.
    const pwned = await page.evaluate(() => (window as unknown as { sharePwned?: boolean }).sharePwned);
    expect(pwned).toBeUndefined();
  });

  test('sharing a PDF lists its name and serves it with nosniff', async ({ page }) => {
    await login(page, 'taylor@example.org');
    await page.goto('/work');

    const dialog = await openComposer(page);
    await dialog.getByLabel('Description').fill('The garden plan so far.');
    await page.setInputFiles('#share-file', {
      name: 'garden-plan.pdf',
      mimeType: 'application/pdf',
      buffer: PDF_BYTES,
    });
    await dialog.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    await page.getByRole('link', { name: 'Ideas' }).click();
    await page.waitForURL(/tab=ideas/);
    const fileLink = ideasSection(page).getByRole('link', { name: 'garden-plan.pdf' });
    await expect(fileLink).toBeVisible();

    const href = await fileLink.getAttribute('href');
    expect(href).toMatch(/^\/api\/files\/[0-9a-f-]{36}$/);

    // The file serves to signed-in members with nosniff, as an attachment.
    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['content-type']).toBe('application/pdf');
    expect(response.headers()['content-disposition']).toContain('attachment');
    expect((await response.body()).toString()).toContain('%PDF-1.4');
  });

  test('the author can delete their own post', async ({ page }) => {
    await login(page, 'drew@example.org');
    await page.goto('/work');

    const dialog = await openComposer(page);
    await dialog.getByLabel('Description').fill('Scratch that — wrong thread.');
    await dialog.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    await page.getByRole('link', { name: 'Ideas' }).click();
    await page.waitForURL(/tab=ideas/);
    const ideas = ideasSection(page);
    const card = ideas.locator('article').filter({ hasText: 'Scratch that — wrong thread.' });

    // Only the author's own posts carry the action.
    await expect(card.getByRole('button', { name: 'Delete' })).toBeVisible();
    await card.getByRole('button', { name: 'Delete' }).click();

    await expect(ideas.getByText('Scratch that — wrong thread.')).toHaveCount(0);
  });
});
