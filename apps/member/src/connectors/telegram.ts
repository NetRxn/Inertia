import type { ChatLine } from './digest';

/** The parts of a Telegram Bot API update the connector reads. */
type Update = {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  channel_post?: TgMessage;
};
type TgMessage = {
  message_id: number;
  date: number;
  chat: { id: number; title?: string; username?: string; first_name?: string; type: string };
  from?: { first_name?: string; last_name?: string; username?: string; is_bot?: boolean };
  author_signature?: string;
  text?: string;
  caption?: string;
};

export type TelegramConfig = {
  token: string;
  /** Only these chats are read; empty reads every chat the bot is in. */
  chatIds: string[];
  apiBase?: string;
};

export function telegramConfig(env: Record<string, string | undefined>): TelegramConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  return { token, chatIds: (env.TELEGRAM_CHAT_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean) };
}

async function call<T>(config: TelegramConfig, method: string, params: Record<string, unknown>, fetchImpl: typeof fetch, timeoutMs = 15_000): Promise<T> {
  const response = await fetchImpl(`${config.apiBase ?? 'https://api.telegram.org'}/bot${config.token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = (await response.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
  if (!response.ok || !body?.ok) throw new Error(`Telegram ${method} failed: ${body?.description ?? response.status}`);
  return body.result as T;
}

/** Who the bot is, for checking the token. */
export async function telegramMe(config: TelegramConfig, fetchImpl: typeof fetch = fetch): Promise<{ username: string; canReadAllGroupMessages: boolean }> {
  const me = await call<{ username: string; can_read_all_group_messages?: boolean }>(config, 'getMe', {}, fetchImpl);
  return { username: me.username, canReadAllGroupMessages: Boolean(me.can_read_all_group_messages) };
}

function toLine(message: TgMessage): ChatLine | null {
  const text = message.text ?? message.caption;
  if (!text || message.from?.is_bot) return null;
  const author = message.from
    ? [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') || message.from.username || 'Someone'
    : message.author_signature ?? 'Channel';
  return {
    conversationId: String(message.chat.id),
    conversationName: message.chat.title ?? message.chat.username ?? message.chat.first_name ?? String(message.chat.id),
    at: new Date(message.date * 1000),
    author,
    text,
    messageId: String(message.message_id),
  };
}

/**
 * Reads new messages with long polling. Returns the lines and the next
 * offset to ask for; store the offset so a restart doesn't re-read.
 */
export async function pollTelegram(config: TelegramConfig, offset: number, fetchImpl: typeof fetch = fetch, waitSeconds = 25): Promise<{ lines: ChatLine[]; offset: number }> {
  const updates = await call<Update[]>(config, 'getUpdates', { offset, timeout: waitSeconds, allowed_updates: ['message', 'channel_post'] }, fetchImpl, (waitSeconds + 10) * 1000);
  let next = offset;
  const lines: ChatLine[] = [];
  for (const update of updates) {
    next = Math.max(next, update.update_id + 1);
    const message = update.message ?? update.channel_post;
    if (!message) continue;
    if (config.chatIds.length && !config.chatIds.includes(String(message.chat.id))) continue;
    const line = toLine(message);
    if (line) lines.push(line);
  }
  return { lines, offset: next };
}
