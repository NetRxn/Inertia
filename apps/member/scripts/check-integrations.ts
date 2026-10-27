#!/usr/bin/env tsx
/** Tests the model, Paperclip, the ingest endpoint, Telegram and Buzz with the current settings. Changes nothing. */
import { checkConnections } from '../src/connectors/check';

const MARK = { ok: '✓', warning: '!', 'not set': '·', failed: '✗' } as const;

checkConnections().then((results) => {
  for (const r of results) console.log(`${MARK[r.status]} ${r.name.padEnd(16)} ${r.status.padEnd(8)} ${r.detail}`);
  process.exit(results.some((r) => r.status === 'failed') ? 1 : 0);
});
