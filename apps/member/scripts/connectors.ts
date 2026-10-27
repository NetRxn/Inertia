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
 */
import { createRunner, runnerConfig } from '../src/connectors/runner';

async function main() {
  const once = process.argv.includes('--once');
  const runner = createRunner(runnerConfig(process.env));
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
  while (!stopping) {
    await runner.read();
    await runner.flush();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
