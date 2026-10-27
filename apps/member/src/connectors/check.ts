import { generateText } from 'ai';
import { backgroundProviderOptions, getFastModel } from '../assistant/model';
import { paperclipConfig } from '../adapters/paperclip';
import { buzzConfig, queryBuzz, readerPublicKey } from './buzz';
import { telegramConfig, telegramMe } from './telegram';

export type CheckResult = { name: string; status: 'ok' | 'warning' | 'not set' | 'failed'; detail: string };

const message = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 300);

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

async function checkModel(env: Record<string, string | undefined>): Promise<CheckResult> {
  if (!env.MEMBER_APP_MODEL_PROVIDER || !env.MEMBER_APP_MODEL) return { name: 'Language model', status: 'not set', detail: 'Set MEMBER_APP_MODEL_PROVIDER and MEMBER_APP_MODEL.' };
  try {
    const { value, ms } = await timed(() => generateText({ model: getFastModel(env), providerOptions: backgroundProviderOptions(env), prompt: 'Reply with exactly: ok', maxOutputTokens: 200 }));
    return { name: 'Language model', status: 'ok', detail: `${env.MEMBER_APP_FAST_MODEL || env.MEMBER_APP_MODEL} answered "${value.text.trim().slice(0, 20)}" in ${(ms / 1000).toFixed(1)} s.` };
  } catch (error) {
    return { name: 'Language model', status: 'failed', detail: message(error) };
  }
}

async function checkPaperclip(env: Record<string, string | undefined>, fetchImpl: typeof fetch): Promise<CheckResult> {
  const config = paperclipConfig(env);
  if (!config) return { name: 'Paperclip', status: 'not set', detail: 'Set PAPERCLIP_URL, PAPERCLIP_API_KEY and PAPERCLIP_COMPANY_ID. Work runs in memory until then.' };
  const get = async <T,>(path: string): Promise<T> => {
    const response = await fetchImpl(`${config.url}${path}`, { headers: { authorization: `Bearer ${config.apiKey}`, accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`${path} answered ${response.status}${response.status === 401 ? ' (check PAPERCLIP_API_KEY)' : response.status === 403 || response.status === 404 ? ' (check PAPERCLIP_COMPANY_ID and the key\'s company)' : ''}`);
    return (await response.json()) as T;
  };
  try {
    const company = `/api/companies/${encodeURIComponent(config.companyId)}`;
    const [goals, labels, agents] = await Promise.all([
      get<{ level: string; status: string }[]>(`${company}/goals`),
      get<{ name: string }[]>(`${company}/labels`),
      get<{ id: string; name: string }[]>(`${company}/agents`).catch(() => [] as { id: string; name: string }[]),
    ]);
    const initiatives = goals.filter((g) => g.level === 'company' && g.status !== 'cancelled').length;
    const human = labels.some((l) => l.name.toLowerCase() === config.humanLabel.toLowerCase());
    const defaultAgent = config.defaultAgentId ? agents.find((a) => a.id === config.defaultAgentId)?.name : null;
    const notes = [
      `${initiatives} initiative goal${initiatives === 1 ? '' : 's'}`,
      `${agents.length} agent${agents.length === 1 ? '' : 's'}${agents.length ? ` (${agents.slice(0, 5).map((a) => a.name).join(', ')})` : ''}`,
      human ? `"${config.humanLabel}" label exists` : `"${config.humanLabel}" label will be created on first human task`,
      config.defaultAgentId ? (defaultAgent ? `new agent tasks go to ${defaultAgent}` : 'PAPERCLIP_DEFAULT_AGENT_ID is not an agent in this company') : 'new agent tasks are left for Paperclip to route',
    ];
    const warn = Boolean(config.defaultAgentId && !defaultAgent);
    return { name: 'Paperclip', status: warn ? 'warning' : 'ok', detail: `Connected to ${config.url}: ${notes.join('; ')}.` };
  } catch (error) {
    return { name: 'Paperclip', status: 'failed', detail: message(error) };
  }
}

async function checkTelegram(env: Record<string, string | undefined>, fetchImpl: typeof fetch): Promise<CheckResult> {
  const config = telegramConfig(env);
  if (!config) return { name: 'Telegram bot', status: 'not set', detail: 'Create a bot with @BotFather, add it to the group, and set TELEGRAM_BOT_TOKEN.' };
  try {
    const me = await telegramMe(config, fetchImpl);
    const scope = config.chatIds.length ? `reading chats ${config.chatIds.join(', ')}` : 'reading every chat it is in (set TELEGRAM_CHAT_IDS to limit)';
    if (!me.canReadAllGroupMessages) return { name: 'Telegram bot', status: 'warning', detail: `@${me.username} works but only sees commands in groups. In @BotFather: /setprivacy → Disable, then remove and re-add the bot to the group. Then ${scope}.` };
    return { name: 'Telegram bot', status: 'ok', detail: `@${me.username}, ${scope}.` };
  } catch (error) {
    return { name: 'Telegram bot', status: 'failed', detail: message(error) };
  }
}

async function checkBuzz(env: Record<string, string | undefined>, fetchImpl: typeof fetch): Promise<CheckResult> {
  let config;
  try {
    config = buzzConfig(env);
  } catch (error) {
    return { name: 'Buzz', status: 'failed', detail: message(error) };
  }
  if (!config) return { name: 'Buzz', status: 'not set', detail: 'Set BUZZ_RELAY_URL, BUZZ_READER_SECRET_KEY and BUZZ_CHANNEL_IDS.' };
  try {
    const { value } = await timed(() => queryBuzz(config, Math.floor(Date.now() / 1000) - 7 * 24 * 3600, fetchImpl));
    return { name: 'Buzz', status: 'ok', detail: `Relay ${config.relayUrl} answered for ${config.channels.length} channel${config.channels.length === 1 ? '' : 's'}: ${value.lines.length} message${value.lines.length === 1 ? '' : 's'} in the last week. Reader key ${readerPublicKey(config).slice(0, 12)}…` };
  } catch (error) {
    const detail = message(error);
    return { name: 'Buzz', status: 'failed', detail: /40[13]/.test(detail) ? `${detail}. The relay doesn't let reader ${readerPublicKey(config).slice(0, 12)}… read these channels; add it as a member.` : detail };
  }
}

function checkIngest(env: Record<string, string | undefined>): CheckResult {
  if (!env.MEMBER_APP_INGEST_TOKEN?.trim()) return { name: 'Ingest endpoint', status: 'not set', detail: 'Set MEMBER_APP_INGEST_TOKEN so connectors and other integrations can deliver to /api/org/ingest.' };
  if (!env.MEMBER_APP_BASE_URL?.trim()) return { name: 'Ingest endpoint', status: 'warning', detail: 'Token set; also set MEMBER_APP_BASE_URL so connectors know where the app is.' };
  return { name: 'Ingest endpoint', status: 'ok', detail: `Connectors deliver to ${env.MEMBER_APP_BASE_URL.replace(/\/+$/, '')}/api/org/ingest.` };
}

/** Tests every integration with the current settings, without changing anything. */
export async function checkConnections(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Promise<CheckResult[]> {
  return Promise.all([checkModel(env), checkPaperclip(env, fetchImpl), Promise.resolve(checkIngest(env)), checkTelegram(env, fetchImpl), checkBuzz(env, fetchImpl)]);
}
