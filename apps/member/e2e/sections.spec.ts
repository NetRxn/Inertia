// Signs in as Alex, whom no other spec uses, so no other spec's state shows here.
import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Sections', () => {
  test('each menu section loads', async ({ page }) => {
    await login(page, 'alex@example.org');
    const menu = page.getByRole('navigation', { name: 'Sections' });
    const main = page.getByRole('main');

    await menu.getByRole('link', { name: 'Votes' }).click();
    await expect(page).toHaveURL('/votes');
    await expect(main.getByRole('heading', { level: 1, name: 'Votes' })).toBeVisible();
    // Role queries skip hidden nodes; Next keeps the previous page (and its Robert's Rules card) hidden in the DOM.
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

    await menu.getByRole('link', { name: 'Work' }).click();
    await expect(page).toHaveURL('/work');
    await expect(main.getByRole('heading', { level: 1, name: 'Work' })).toBeVisible();

    await menu.getByRole('link', { name: 'Calendar' }).click();
    await expect(page).toHaveURL('/calendar');
    await expect(main.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Monthly governance meeting' })).toBeVisible();
    // Events sit under their day: the first group's heading is a day, like "Mon, Oct 26".
    await expect(main.getByRole('region').first().getByRole('heading', { level: 2 })).toHaveText(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/);

    await menu.getByRole('link', { name: 'Docs' }).click();
    await expect(page).toHaveURL('/docs');
    await expect(main.getByRole('heading', { level: 1, name: 'Docs' })).toBeVisible();
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

    await menu.getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL('/profile');
    await expect(main.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
    const you = main.getByRole('region', { name: 'You' });
    await expect(you.getByText('Alex Martinez')).toBeVisible();
    await expect(you.getByText('alex@example.org')).toBeVisible();

    await menu.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL('/');
    await expect(main.getByRole('heading', { level: 1, name: 'Welcome, Alex' })).toBeVisible();
  });

  test('a meeting source link opens that meeting on Docs', async ({ page }) => {
    await login(page, 'alex@example.org');
    await page.goto('/docs#meeting-meeting-2');

    const meeting = page.locator('#meeting-meeting-2');
    await expect(meeting).toHaveAttribute('open', '');
    await expect(meeting.getByText('Require two approvers for expenses over $500')).toBeVisible();
    await expect(page.locator('#meeting-meeting-1')).not.toHaveAttribute('open', '');
  });

  test('sign out returns to /login and / redirects there', async ({ page }) => {
    await login(page, 'alex@example.org');
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');

    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});
