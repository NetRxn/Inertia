import { describe, it, expect } from 'vitest';
import { generateSecretKey } from 'nostr-tools';
import { checkConnections } from '../src/connectors/check';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

describe('connection checks', () => {
  it('reports what is not set without calling anything', async () => {
    const calls: string[] = [];
    const results = await checkConnections({}, (async (u: string) => { calls.push(u); return json({}); }) as unknown as typeof fetch);
    expect(results.map((r) => [r.name, r.status])).toEqual([
      ['Language model', 'not set'], ['Paperclip', 'not set'], ['Ingest endpoint', 'not set'], ['Telegram bot', 'not set'], ['Buzz', 'not set'],
    ]);
    expect(calls).toEqual([]);
  });

  it('checks Paperclip, Telegram and Buzz and explains problems', async () => {
    const fetchImpl = (async (input: string | URL) => {
      const u = String(input);
      if (u.endsWith('/goals')) return json([{ level: 'company', status: 'active' }, { level: 'team', status: 'active' }]);
      if (u.endsWith('/labels')) return json([]);
      if (u.endsWith('/agents')) return json([{ id: 'a1', name: 'CEO' }]);
      if (u.includes('/getMe')) return json({ ok: true, result: { username: 'fwtx_inertia_bot', can_read_all_group_messages: false } });
      if (u.endsWith('/query')) return json({ error: 'forbidden' }, 403);
      throw new Error(u);
    }) as unknown as typeof fetch;
    const results = await checkConnections({
      PAPERCLIP_URL: 'https://pc.example.org', PAPERCLIP_API_KEY: 'k', PAPERCLIP_COMPANY_ID: 'c1', PAPERCLIP_DEFAULT_AGENT_ID: 'a1',
      MEMBER_APP_INGEST_TOKEN: 't', MEMBER_APP_BASE_URL: 'https://app.example.org/',
      TELEGRAM_BOT_TOKEN: 'T',
      BUZZ_RELAY_URL: 'https://buzz.example.org', BUZZ_READER_SECRET_KEY: Buffer.from(generateSecretKey()).toString('hex'), BUZZ_CHANNEL_IDS: '7f3d2b9a-1c4e-4f6a-9b8d-2e5c7a1f0d3b',
    }, fetchImpl);
    const by = Object.fromEntries(results.map((r) => [r.name, r]));
    expect(by['Paperclip']).toMatchObject({ status: 'ok', detail: expect.stringContaining('1 initiative goal; 1 agent (CEO); "human" label will be created on first human task; new agent tasks go to CEO') });
    expect(by['Ingest endpoint']).toMatchObject({ status: 'ok', detail: 'Connectors deliver to https://app.example.org/api/org/ingest.' });
    expect(by['Telegram bot']).toMatchObject({ status: 'warning', detail: expect.stringContaining('/setprivacy') });
    expect(by['Buzz']).toMatchObject({ status: 'failed', detail: expect.stringContaining('add it as a member') });
  });
});
