import { describe, it, expect } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, type Event } from 'nostr-tools';
import { DigestBuffer } from '../src/connectors/digest';
import { buzzConfig, queryBuzz } from '../src/connectors/buzz';
import { pollTelegram, telegramConfig } from '../src/connectors/telegram';
import { createRunner, runnerConfig, type ConnectorState } from '../src/connectors/runner';

const CHANNEL = '7f3d2b9a-1c4e-4f6a-9b8d-2e5c7a1f0d3b';
const OTHER = '11111111-2222-4333-8444-555555555555';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

function tgUpdate(id: number, chatId: number, text: string, from = 'Rob', isBot = false) {
  return { update_id: id, message: { message_id: id * 10, date: 1761566400 + id * 60, chat: { id: chatId, title: 'FWTX DAO', type: 'supergroup' }, from: { first_name: from, is_bot: isBot }, text } };
}

describe('digests', () => {
  it('groups lines by conversation and day, drops repeats and splits big days', () => {
    const buffer = new DigestBuffer('Telegram', 60);
    const at = (h: number) => new Date(Date.UTC(2026, 9, 27, h));
    buffer.add({ conversationId: '1', conversationName: 'FWTX DAO', at: at(12), author: 'Rob', text: 'I can host the workshop', messageId: 'a' });
    buffer.add({ conversationId: '1', conversationName: 'FWTX DAO', at: at(12), author: 'Rob', text: 'I can host the workshop', messageId: 'a' });
    buffer.add({ conversationId: '1', conversationName: 'FWTX DAO', at: at(13), author: 'Ana', text: 'Great, Wednesday works for me too', messageId: 'b' });
    buffer.add({ conversationId: '2', conversationName: 'Builders', at: at(9), author: 'Gary', text: '   ', messageId: 'c' });
    const digests = buffer.drain();
    expect(digests.map((d) => [d.title, d.text])).toEqual([
      ['Telegram: FWTX DAO · 2026-10-27', '[12:00] Rob: I can host the workshop'],
      ['Telegram: FWTX DAO · 2026-10-27', '[13:00] Ana: Great, Wednesday works for me too'],
    ]);
    expect(digests[0].origin).toBe('telegram:1:a-a');
    expect(buffer.drain()).toEqual([]);
  });
});

describe('Telegram', () => {
  it('reads messages from allowed chats, skips bots and advances the offset', async () => {
    const asked: unknown[] = [];
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe('https://api.telegram.org/botTOKEN/getUpdates');
      asked.push(JSON.parse(String(init?.body)));
      return json({ ok: true, result: [tgUpdate(5, -100, 'Hello'), tgUpdate(6, -100, 'I am a bot', 'Bot', true), tgUpdate(7, -999, 'Other chat')] });
    }) as typeof fetch;
    const config = telegramConfig({ TELEGRAM_BOT_TOKEN: 'TOKEN', TELEGRAM_CHAT_IDS: '-100' })!;
    const { lines, offset } = await pollTelegram(config, 3, fetchImpl, 0);
    expect(asked[0]).toMatchObject({ offset: 3, timeout: 0 });
    expect(offset).toBe(8);
    expect(lines).toEqual([expect.objectContaining({ conversationId: '-100', conversationName: 'FWTX DAO', author: 'Rob', text: 'Hello', messageId: '50' })]);
  });
});

describe('Buzz', () => {
  const reader = generateSecretKey();
  const member = generateSecretKey();
  const env = {
    BUZZ_RELAY_URL: 'https://buzz.example.org/',
    BUZZ_READER_SECRET_KEY: Buffer.from(reader).toString('hex'),
    BUZZ_CHANNEL_IDS: CHANNEL,
    BUZZ_NAMES: JSON.stringify({ [getPublicKey(member)]: 'Ana' }),
    BUZZ_CHANNEL_NAMES: JSON.stringify({ [CHANNEL]: 'general' }),
  };
  const message = (content: string, channel = CHANNEL, at = 1761566400) => finalizeEvent({ kind: 9, created_at: at, content, tags: [['h', channel]] }, member);

  it('needs all three settings and a valid key', () => {
    expect(buzzConfig({})).toBeNull();
    expect(() => buzzConfig({ ...env, BUZZ_READER_SECRET_KEY: 'nope' })).toThrow(/64-character/);
    expect(buzzConfig(env)?.relayUrl).toBe('https://buzz.example.org');
  });

  it('signs the query with NIP-98 and keeps only verified messages from the channels', async () => {
    const tampered = { ...message('original'), content: 'tampered' } as Event;
    let auth: Event | undefined;
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe('https://buzz.example.org/query');
      auth = JSON.parse(Buffer.from(String(new Headers(init?.headers).get('authorization')).replace('Nostr ', ''), 'base64').toString());
      expect(JSON.parse(String(init?.body))).toEqual([{ kinds: [9], '#h': [CHANNEL], since: 100, limit: 500 }]);
      return json([message('We need judges', CHANNEL, 1761566460), message('elsewhere', OTHER), tampered]);
    }) as typeof fetch;
    const { lines, newest } = await queryBuzz(buzzConfig(env)!, 100, fetchImpl, () => 1761566500);
    expect(auth && verifyEvent(auth)).toBe(true);
    expect(auth?.kind).toBe(27235);
    expect(auth?.tags).toEqual(expect.arrayContaining([['u', 'https://buzz.example.org/query'], ['method', 'POST']]));
    expect(lines).toEqual([expect.objectContaining({ conversationName: 'general', author: 'Ana', text: 'We need judges' })]);
    expect(newest).toBe(1761566460);
  });
});

describe('connector runner', () => {
  it('reads Telegram, delivers digests to the app, and keeps failed ones for later', async () => {
    let appUp = false;
    const delivered: { auth: string | null; body: unknown }[] = [];
    let saved: ConnectorState | null = null;
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('api.telegram.org')) return json({ ok: true, result: [tgUpdate(1, -100, 'Who can judge on Friday?')] });
      if (u === 'https://app.example.org/api/org/ingest') {
        if (!appUp) return json({ error: 'down' }, 503);
        delivered.push({ auth: new Headers(init?.headers).get('authorization'), body: JSON.parse(String(init?.body)) });
        return json({ id: 's1', duplicate: false }, 201);
      }
      throw new Error(`unexpected ${u}`);
    }) as typeof fetch;
    const config = runnerConfig({ MEMBER_APP_BASE_URL: 'https://app.example.org/', MEMBER_APP_INGEST_TOKEN: 'tok', TELEGRAM_BOT_TOKEN: 'T' });
    const runner = createRunner(config, { fetchImpl, log: () => {}, readState: async () => null, writeState: async (s) => { saved = JSON.parse(JSON.stringify(s)); } });
    await runner.start();
    await runner.read(0);
    expect(await runner.flush(true)).toBe(0);
    expect(saved!.pending).toHaveLength(1);
    expect(saved!.telegramOffset).toBe(2);
    appUp = true;
    expect(await runner.flush(true)).toBe(1);
    expect(delivered).toEqual([{ auth: 'Bearer tok', body: expect.objectContaining({ kind: 'chat-export', title: expect.stringContaining('Telegram: FWTX DAO'), text: expect.stringContaining('Rob: Who can judge on Friday?') }) }]);
    expect(saved!.pending).toEqual([]);
  });

  it('explains what is missing', () => {
    expect(() => runnerConfig({})).toThrow(/MEMBER_APP_INGEST_TOKEN/);
    expect(() => runnerConfig({ MEMBER_APP_BASE_URL: 'x', MEMBER_APP_INGEST_TOKEN: 'y' })).toThrow(/Nothing to connect/);
  });
});
