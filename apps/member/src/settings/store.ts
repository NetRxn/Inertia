import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { integrationSettings } from '../db/schema';
import { decryptSecret, encryptSecret } from './secrets';

type Env = Record<string, string | undefined>;
export type SettingId = (typeof integrationSettings.$inferSelect)['id'];

export type ModelSettingConfig = { provider: 'anthropic' | 'openai-compatible'; model: string; fastModel: string; baseUrl: string };
export type TelegramSettingConfig = { chatIds: string };

/** A saved setting as the UI may see it: never the secret, only whether one is stored. */
export async function getIntegrationSetting(db: Db, id: SettingId): Promise<{ config: Record<string, string>; hasSecret: boolean; updatedAt: Date } | null> {
  const [row] = await db.select().from(integrationSettings).where(eq(integrationSettings.id, id));
  return row ? { config: row.config, hasSecret: Boolean(row.secret), updatedAt: row.updatedAt } : null;
}

/**
 * Saves a setting. `secret` undefined keeps the stored one, null clears it,
 * a string replaces it (encrypted).
 */
export async function saveIntegrationSetting(db: Db, id: SettingId, config: Record<string, string>, secret: string | null | undefined, by: string | null, env: Env = process.env): Promise<void> {
  const values = {
    config,
    updatedBy: by,
    updatedAt: new Date(),
    ...(secret === undefined ? {} : { secret: secret ? encryptSecret(secret, env) : null }),
  };
  await db.insert(integrationSettings).values({ id, ...values }).onConflictDoUpdate({ target: integrationSettings.id, set: values });
  forgetEffectiveEnv();
}

export async function clearIntegrationSetting(db: Db, id: SettingId): Promise<void> {
  await db.delete(integrationSettings).where(eq(integrationSettings.id, id));
  forgetEffectiveEnv();
}

function readSecret(sealed: string | null, env: Env): string | null {
  if (!sealed) return null;
  try {
    return decryptSecret(sealed, env);
  } catch (error) {
    console.error('[settings] A stored key could not be read (was MEMBER_APP_SECRET_KEY changed?):', error instanceof Error ? error.message : error);
    return null;
  }
}

/** The saved settings as the environment variables they stand for. */
export async function settingsEnv(db: Db, env: Env = process.env): Promise<Record<string, string>> {
  const rows = await db.select().from(integrationSettings);
  const out: Record<string, string> = {};
  for (const row of rows) {
    const secret = readSecret(row.secret, env);
    if (row.id === 'model') {
      const c = row.config as Partial<ModelSettingConfig>;
      if (c.provider) out.MEMBER_APP_MODEL_PROVIDER = c.provider;
      if (c.model) out.MEMBER_APP_MODEL = c.model;
      if (c.fastModel) out.MEMBER_APP_FAST_MODEL = c.fastModel;
      if (c.baseUrl) out.MEMBER_APP_MODEL_BASE_URL = c.baseUrl;
      if (secret) {
        out.MEMBER_APP_MODEL_API_KEY = secret;
        // The Anthropic provider prefers ANTHROPIC_API_KEY, so the saved key must win there too.
        if (c.provider === 'anthropic') out.ANTHROPIC_API_KEY = secret;
      }
    }
    if (row.id === 'telegram') {
      const c = row.config as Partial<TelegramSettingConfig>;
      out.TELEGRAM_CHAT_IDS = c.chatIds ?? '';
      if (secret) out.TELEGRAM_BOT_TOKEN = secret;
    }
  }
  return out;
}

declare global {
  var __memberAppEffectiveEnv: { at: number; env: Env } | undefined;
}

const CACHE_MS = 15_000;

function forgetEffectiveEnv(): void {
  globalThis.__memberAppEffectiveEnv = undefined;
}

/**
 * The environment with saved settings on top: what the model, the connection
 * check and the connectors should read. A saved model without its own base
 * URL or fast model drops the environment's, so the two never mix.
 */
export async function effectiveEnv(db: Db, env: Env = process.env, options: { fresh?: boolean } = {}): Promise<Env> {
  const cached = globalThis.__memberAppEffectiveEnv;
  if (!options.fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.env;
  const saved = await settingsEnv(db, env).catch((error) => {
    console.error('[settings] Could not read saved settings:', error instanceof Error ? error.message : error);
    return {} as Record<string, string>;
  });
  const merged: Env = { ...env };
  if (saved.MEMBER_APP_MODEL) {
    delete merged.MEMBER_APP_MODEL_BASE_URL;
    delete merged.MEMBER_APP_FAST_MODEL;
  }
  Object.assign(merged, saved);
  if (!options.fresh) globalThis.__memberAppEffectiveEnv = { at: Date.now(), env: merged };
  return merged;
}
