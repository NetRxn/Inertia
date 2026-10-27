import { createHash, randomUUID } from 'crypto';
import { finalizeEvent, getPublicKey, verifyEvent, type Event, type Filter } from 'nostr-tools';
import type { ChatLine } from './digest';

export type BuzzConfig = {
  /** HTTPS origin of the Buzz relay. */
  relayUrl: string;
  /** Hex secret key of the reader identity; it must be allowed to read the channels. */
  secretKey: Uint8Array;
  /** Channel UUIDs to read. */
  channels: string[];
  /** Display names by public key, so digests show people instead of keys. */
  names: Record<string, string>;
  /** Channel display names by UUID. */
  channelNames: Record<string, string>;
};

const HEX64 = /^[0-9a-f]{64}$/i;

function parseMap(value: string | undefined): Record<string, string> {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' ? Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === 'string')) as Record<string, string> : {};
  } catch {
    return {};
  }
}

export function buzzConfig(env: Record<string, string | undefined>): BuzzConfig | null {
  const relay = env.BUZZ_RELAY_URL?.trim();
  const key = env.BUZZ_READER_SECRET_KEY?.trim();
  const channels = (env.BUZZ_CHANNEL_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!relay || !key || !channels.length) return null;
  if (!HEX64.test(key)) throw new Error('BUZZ_READER_SECRET_KEY must be a 64-character hex secret key.');
  const url = new URL(relay);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('BUZZ_RELAY_URL must use https.');
  return { relayUrl: url.origin, secretKey: Uint8Array.from(Buffer.from(key, 'hex')), channels, names: parseMap(env.BUZZ_NAMES), channelNames: parseMap(env.BUZZ_CHANNEL_NAMES) };
}

/** NIP-98 HTTP auth, the same scheme the Buzz relay and the Inertia bridge use. */
function authHeader(config: BuzzConfig, url: string, body: string, now: number): string {
  const auth = finalizeEvent({
    kind: 27235,
    created_at: now,
    content: '',
    tags: [['u', url], ['method', 'POST'], ['nonce', randomUUID()], ['payload', createHash('sha256').update(body).digest('hex')]],
  }, config.secretKey);
  return `Nostr ${Buffer.from(JSON.stringify(auth)).toString('base64')}`;
}

export function readerPublicKey(config: BuzzConfig): string {
  return getPublicKey(config.secretKey);
}

/** Queries the relay for channel messages since a time. Only verified, single-channel messages are kept. */
export async function queryBuzz(config: BuzzConfig, since: number, fetchImpl: typeof fetch = fetch, now = () => Math.floor(Date.now() / 1000)): Promise<{ lines: ChatLine[]; newest: number }> {
  const url = `${config.relayUrl}/query`;
  const body = JSON.stringify([{ kinds: [9], '#h': config.channels, since, limit: 500 } satisfies Filter]);
  const response = await fetchImpl(url, {
    method: 'POST',
    redirect: 'error',
    headers: { 'content-type': 'application/json', authorization: authHeader(config, url, body, now()) },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Buzz query answered ${response.status}: ${(await response.text().catch(() => '')).slice(0, 200)}`);
  const events = (await response.json()) as unknown;
  if (!Array.isArray(events)) throw new Error('Buzz query returned something other than a list of events.');
  let newest = since;
  const lines: ChatLine[] = [];
  for (const raw of events) {
    const event = raw as Event;
    if (!event || event.kind !== 9 || typeof event.content !== 'string' || !verifyEvent(event)) continue;
    const channels = event.tags.filter((t) => t[0] === 'h').map((t) => t[1]);
    if (channels.length !== 1 || !config.channels.includes(channels[0])) continue;
    newest = Math.max(newest, event.created_at);
    lines.push({
      conversationId: channels[0],
      conversationName: config.channelNames[channels[0]] ?? `channel ${channels[0].slice(0, 8)}`,
      at: new Date(event.created_at * 1000),
      author: config.names[event.pubkey] ?? `${event.pubkey.slice(0, 8)}…`,
      text: event.content,
      messageId: event.id,
    });
  }
  return { lines, newest };
}
