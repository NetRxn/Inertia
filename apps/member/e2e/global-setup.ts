/**
 * Global setup for Playwright e2e tests.
 * The webServer command in playwright.config.ts handles data reset and seeding,
 * so this file is minimal. Per R3, we don't rely on ordering between global-setup
 * and webServer.
 */
export default async function globalSetup() {
  // Any global setup tasks would go here
  // Currently empty as webServer command handles data preparation
}
