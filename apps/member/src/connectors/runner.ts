import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { buzzConfig, queryBuzz, type BuzzConfig } from './buzz';
import { DigestBuffer, postDigest, type Digest } from './digest';
import { pollTelegram, telegramConfig, type TelegramConfig } from './telegram';

export type ConnectorState = { telegramOffset: number; buzzSince: number; pending: Digest[] };

export type RunnerDeps = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  log?: (message: string) => void;
  readState?: () => Promise<ConnectorState | null>;
  writeState?: (state: ConnectorState) => Promise<void>;
};

export type RunnerConfig = {
  appUrl: string;
  ingestToken: string;
  telegram: TelegramConfig | null;
  buzz: BuzzConfig | null;
  flushMinutes: number;
  buzzPollSeconds: number;
  stateFile: string;
};

export function runnerConfig(env: Record<string, string | undefined>): RunnerConfig {
  const appUrl = env.MEMBER_APP_BASE_URL?.trim();
  const ingestToken = env.MEMBER_APP_INGEST_TOKEN?.trim();
  if (!appUrl || !ingestToken) throw new Error('Set MEMBER_APP_BASE_URL and MEMBER_APP_INGEST_TOKEN so connectors can deliver to the app.');
  const telegram = telegramConfig(env);
  const buzz = buzzConfig(env);
  if (!telegram && !buzz) throw new Error('Nothing to connect: set TELEGRAM_BOT_TOKEN and/or BUZZ_RELAY_URL, BUZZ_READER_SECRET_KEY and BUZZ_CHANNEL_IDS.');
  return {
    appUrl,
    ingestToken,
    telegram,
    buzz,
    flushMinutes: Math.max(1, Number(env.CONNECTOR_FLUSH_MINUTES) || 15),
    buzzPollSeconds: Math.max(15, Number(env.BUZZ_POLL_SECONDS) || 60),
    stateFile: env.CONNECTOR_STATE_FILE?.trim() || 'data/connectors.json',
  };
}

/**
 * The connector loop, one step at a time so it can be driven by tests:
 * read new chat, and when it's time, deliver digests to the app.
 */
export function createRunner(config: RunnerConfig, deps: RunnerDeps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? ((m: string) => console.log(`[connectors] ${m}`));
  const readState = deps.readState ?? (async () => {
    try {
      return JSON.parse(await readFile(config.stateFile, 'utf8')) as ConnectorState;
    } catch {
      return null;
    }
  });
  const writeState = deps.writeState ?? (async (state: ConnectorState) => {
    await mkdir(path.dirname(config.stateFile), { recursive: true });
    await writeFile(config.stateFile, JSON.stringify(state, null, 2));
  });
  const telegramBuffer = new DigestBuffer('Telegram');
  const buzzBuffer = new DigestBuffer('Buzz');
  let state: ConnectorState = { telegramOffset: 0, buzzSince: Math.floor(now().getTime() / 1000) - 24 * 3600, pending: [] };
  let lastFlush = now().getTime();
  let lastBuzz = 0;

  return {
    async start() {
      state = { ...state, ...(await readState()) };
      log(`starting: ${[config.telegram && 'Telegram', config.buzz && `Buzz (${config.buzz.channels.length} channel${config.buzz.channels.length === 1 ? '' : 's'})`].filter(Boolean).join(' and ')}; delivering to ${config.appUrl} every ${config.flushMinutes} min`);
    },

    /** Reads Telegram (long poll) and, when due, Buzz. */
    async read(waitSeconds = 25) {
      if (config.telegram) {
        try {
          const { lines, offset } = await pollTelegram(config.telegram, state.telegramOffset, fetchImpl, waitSeconds);
          lines.forEach((l) => telegramBuffer.add(l));
          if (offset !== state.telegramOffset) {
            state.telegramOffset = offset;
            await writeState(state);
          }
          if (lines.length) log(`telegram: ${lines.length} new message${lines.length === 1 ? '' : 's'}`);
        } catch (error) {
          log(`telegram: ${error instanceof Error ? error.message : error}`);
        }
      }
      if (config.buzz && now().getTime() - lastBuzz >= config.buzzPollSeconds * 1000) {
        lastBuzz = now().getTime();
        try {
          const { lines, newest } = await queryBuzz(config.buzz, state.buzzSince, fetchImpl);
          lines.forEach((l) => buzzBuffer.add(l));
          // Re-read the newest second next time; the buffer drops repeats by message id.
          if (newest > state.buzzSince) {
            state.buzzSince = newest;
            await writeState(state);
          }
          if (lines.length) log(`buzz: ${lines.length} message${lines.length === 1 ? '' : 's'}`);
        } catch (error) {
          log(`buzz: ${error instanceof Error ? error.message : error}`);
        }
      }
    },

    /** Delivers digests when the flush interval has passed (or when forced). Undelivered ones are kept and retried. */
    async flush(force = false) {
      if (!force && now().getTime() - lastFlush < config.flushMinutes * 60_000) return 0;
      lastFlush = now().getTime();
      const queue = [...state.pending, ...telegramBuffer.drain(), ...buzzBuffer.drain()];
      const failed: Digest[] = [];
      let delivered = 0;
      for (const digest of queue) {
        try {
          await postDigest(config.appUrl, config.ingestToken, digest, fetchImpl);
          delivered++;
        } catch (error) {
          failed.push(digest);
          log(`deliver "${digest.title}": ${error instanceof Error ? error.message : error}`);
        }
      }
      state.pending = failed.slice(-200);
      await writeState(state);
      if (delivered) log(`delivered ${delivered} digest${delivered === 1 ? '' : 's'}`);
      return delivered;
    },

    state: () => state,
  };
}
