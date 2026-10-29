// Signs in as Alex, whom no other spec uses, so no other spec's state shows here.
import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Sections', () => {
  test('each Organization tab loads', async ({ page }) => {
    await login(page, 'alex@example.org');
    const menu = page.getByRole('navigation', { name: 'Sections' });
    const main = page.getByRole('main');
    const tabs = main.getByRole('navigation', { name: 'Organization sections' });

    await menu.getByRole('link', { name: 'Organization' }).click();
    await expect(page).toHaveURL('/org');
    await expect(main.getByRole('heading', { level: 1, name: 'Riverside Commons (sample)' })).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');

    await tabs.getByRole('link', { name: 'Governance' }).click();
    await expect(page).toHaveURL('/org?tab=governance');
    await expect(main.getByText(/will live here once Vocdoni is connected/)).toBeVisible();
    // Role queries skip hidden nodes; Next keeps the previous page hidden in the DOM.
    const open = main.getByRole('region', { name: 'Open now' });
    await expect(open.getByRole('heading', { name: 'Approve community garden grant application' })).toBeVisible();
    await expect(open.getByText('8 yes · 1 no · 2 abstain')).toBeVisible();
    await expect(open.getByRole('link', { name: /Vote in Robert's Rules/ })).toHaveAttribute(
      'href',
      'https://vote.example.org/proposals/prop-1',
    );
    await expect(
      main.getByRole('region', { name: 'Closed' }).getByRole('heading', { name: 'Budget allocation for coding workshops' }),
    ).toBeVisible();

    await tabs.getByRole('link', { name: 'Funding' }).click();
    await expect(page).toHaveURL('/org?tab=funding');
    const waiting = main.getByRole('region', { name: 'Waiting for members' });
    await expect(waiting.getByRole('heading', { name: 'Community garden: Green Spaces application' })).toBeVisible();
    await expect(waiting.getByText('Confirm the $3,000 in-kind match')).toBeVisible();
    const applyNow = main.getByRole('region', { name: 'Apply now' });
    await expect(applyNow.getByRole('heading', { name: 'Community Green Spaces grant' })).toBeVisible();
    await expect(applyNow.getByRole('link', { name: /Official page/ }).first()).toHaveAttribute(
      'href',
      'https://grants.example.org/green-spaces',
    );
    await expect(
      main.getByRole('region', { name: 'Later and ongoing' }).getByRole('heading', { name: 'Donated software credits' }),
    ).toBeVisible();

    await tabs.getByRole('link', { name: 'Calendar' }).click();
    await expect(page).toHaveURL('/org?tab=calendar');
    await expect(main.getByRole('heading', { name: 'Monthly governance meeting' })).toBeVisible();
    // Events sit under their day: the first group's heading is a day, like "Mon, Oct 26".
    await expect(main.getByRole('region').first().getByRole('heading', { level: 2 })).toHaveText(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/);

    await tabs.getByRole('link', { name: 'Docs' }).click();
    await expect(page).toHaveURL('/org?tab=docs');
    for (const section of ['Meeting notes', 'Shared files', 'My drafts']) {
      await expect(main.getByRole('heading', { level: 2, name: section })).toBeVisible();
    }
    const meeting = page.locator('#meeting-meeting-1');
    await expect(meeting.getByText('Selected north corner lot as garden location')).toBeHidden();
    await meeting.getByRole('heading', { name: 'Community garden planning session' }).click();
    await expect(meeting.getByText('Selected north corner lot as garden location')).toBeVisible();
    await expect(meeting.getByText('Which native plants should we prioritize?')).toBeVisible();
    await expect(meeting.getByText('Submit grant application by October 30')).toBeVisible();
    await expect(main.getByRole('region', { name: 'My drafts' }).getByText(/^No drafts yet\./)).toBeVisible();

    await tabs.getByRole('link', { name: 'People' }).click();
    await expect(page).toHaveURL('/org?tab=people');
    const you = main.getByRole('region', { name: 'You' });
    await expect(you.getByText('Alex Martinez')).toBeVisible();
    await expect(you.getByText('alex@example.org')).toBeVisible();
    await expect(main.getByText('Dana Ortiz, branch librarian and coding nights host (not a member yet)')).toBeVisible();

    await menu.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL('/');
    await expect(main.getByRole('heading', { level: 1, name: 'Welcome, Alex' })).toBeVisible();
  });

  test('the Organization tab bar is centered', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, 'alex@example.org');
    await page.goto('/org?tab=people');
    const nav = page.getByRole('navigation', { name: 'Organization sections' });
    const column = page.getByRole('main');
    const [navBox, columnBox] = [await nav.boundingBox(), await column.boundingBox()];
    expect(Math.abs(navBox!.x + navBox!.width / 2 - (columnBox!.x + columnBox!.width / 2))).toBeLessThanOrEqual(2);
  });

  test('a meeting source link opens that meeting on Docs, from the old address too', async ({ page }) => {
    await login(page, 'alex@example.org');
    await page.goto('/docs#meeting-meeting-2');
    await expect(page).toHaveURL('/org?tab=docs#meeting-meeting-2');

    const meeting = page.locator('#meeting-meeting-2');
    await expect(meeting).toHaveAttribute('open', '');
    await expect(meeting.getByText('Require two approvers for expenses over $500')).toBeVisible();
    await expect(page.locator('#meeting-meeting-1')).not.toHaveAttribute('open', '');
  });

  test('an old Funding link opens the application in Organization', async ({ page }) => {
    await login(page, 'alex@example.org');
    await page.goto('/funding#application-app-garden');
    await expect(page).toHaveURL('/org?tab=funding#application-app-garden');
    await expect(page.locator('#application-app-garden').getByText('Upload the site lease letter')).toBeVisible();
  });

  test('sign out returns to /login and / redirects there', async ({ page }) => {
    await login(page, 'alex@example.org');
    await page.goto('/org?tab=people');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');

    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});
