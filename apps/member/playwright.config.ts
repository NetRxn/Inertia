import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'PATH=/opt/homebrew/opt/node@24/bin:$PATH bash -c "mkdir -p data && rm -rf data/pglite-e2e data/dev-mail && MEMBER_APP_PGLITE_DIR=data/pglite-e2e npm run seed && MEMBER_APP_PGLITE_DIR=data/pglite-e2e MEMBER_APP_LINK_PREVIEWS=off MEMBER_APP_MODEL_PROVIDER=mock MEMBER_APP_BASE_URL=http://localhost:3100 PORT=3100 npm run dev"',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
