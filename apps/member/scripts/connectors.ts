#!/usr/bin/env tsx
/**
 * Connectors: listen to Telegram and Buzz and deliver daily chat digests to
 * the app's ingest endpoint. Run it next to the app:
 *
 *   npx tsx scripts/connectors.ts           # runs until stopped
 *   npx tsx scripts/connectors.ts --once    # read once, deliver, exit (for testing)
 *
 * Settings (see .env.example): MEMBER_APP_BASE_URL, MEMBER_APP_INGEST_TOKEN,
 * TELEGRAM_BOT_TOKEN [TELEGRAM_CHAT_IDS], BUZZ_RELAY_URL BUZZ_READER_SECRET_KEY
 * BUZZ_CHANNEL_IDS [BUZZ_NAMES BUZZ_CHANNEL_NAMES], CONNECTOR_FLUSH_MINUTES.
 * Telegram settings saved in the app (Agents → Connections) override these.
 * When they change, the runner delivers what it has and exits, so its
 * supervisor (compose's restart policy) starts it again with the new ones.
 */
import { createRunner, runnerConfig } from '../src/connectors/runner';
import { getDb } from '../src/db/client';
import { settingsEnv } from '../src/settings/store';

const SETTINGS_CHECK_MS = 60_000;

// Local PGlite belongs to the app process alone; only a shared Postgres can be read from here too.
const canReadSettings = Boolean(process.env.DATABASE_URL?.trim());

async function saved(): Promise<Record<string, string>> {
  if (!canReadSettings) return {};
  return settingsEnv(getDb()).catch(() => ({} as Record<string, string>));
}

/** The saved settings the connectors care about, as a comparable string. */
async function savedTelegram(): Promise<string> {
  const values = await saved();
  return JSON.stringify([values.TELEGRAM_BOT_TOKEN ?? null, values.TELEGRAM_CHAT_IDS ?? null]);
}

async function main() {
  const once = process.argv.includes('--once');
  const runner = createRunner(runnerConfig({ ...process.env, ...(await saved()) }));
  const started = await savedTelegram();
  await runner.start();
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await runner.flush(true);
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  if (once) {
    await runner.read(1);
    await runner.flush(true);
    return;
  }
  let checkedAt = Date.now();
  while (!stopping) {
    await runner.read();
    await runner.flush();
    if (canReadSettings && Date.now() - checkedAt >= SETTINGS_CHECK_MS) {
      checkedAt = Date.now();
      if ((await savedTelegram()) !== started) {
        console.log('[connectors] Telegram settings changed in the app; restarting to use them.');
        await stop();
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
