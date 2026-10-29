#!/usr/bin/env tsx
/** Tests the model, Paperclip, the ingest endpoint, Telegram and Buzz with the current settings. Changes nothing. */
import { checkConnections } from '../src/connectors/check';
import { getDb } from '../src/db/client';
import { effectiveEnv } from '../src/settings/store';

const MARK = { ok: '✓', warning: '!', 'not set': '·', failed: '✗' } as const;

// Settings saved in the app (Agents → Connections) count, as they do for the app. Only a
// shared Postgres can be read from here; local PGlite belongs to the running app.
const env = process.env.DATABASE_URL?.trim() ? effectiveEnv(getDb(), process.env, { fresh: true }) : Promise.resolve(process.env);

env.then((settings) => checkConnections(settings)).then((results) => {
  for (const r of results) console.log(`${MARK[r.status]} ${r.name.padEnd(16)} ${r.status.padEnd(8)} ${r.detail}`);
  process.exit(results.some((r) => r.status === 'failed') ? 1 : 0);
});
