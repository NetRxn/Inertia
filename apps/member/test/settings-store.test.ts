import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { integrationSettings } from '../src/db/schema';
import { decryptSecret, encryptSecret, SecretKeyMissingError } from '../src/settings/secrets';
import { effectiveEnv, getIntegrationSetting, saveIntegrationSetting, settingsEnv } from '../src/settings/store';

const KEY = { MEMBER_APP_SECRET_KEY: 'a-test-key-that-is-long-enough-to-use-123' };

describe('secrets', () => {
  it('round-trips and never stores the plaintext', () => {
    const sealed = encryptSecret('123456:ABC-token', KEY);
    expect(sealed).not.toContain('123456:ABC-token');
    expect(decryptSecret(sealed, KEY)).toBe('123456:ABC-token');
  });

  it('refuses without a key, and with a short one', () => {
    expect(() => encryptSecret('x', {})).toThrow(SecretKeyMissingError);
    expect(() => encryptSecret('x', { MEMBER_APP_SECRET_KEY: 'short' })).toThrow(SecretKeyMissingError);
  });

  it('fails on a different key', () => {
    const sealed = encryptSecret('token', KEY);
    expect(() => decryptSecret(sealed, { MEMBER_APP_SECRET_KEY: 'another-key-that-is-long-enough-to-use-456' })).toThrow();
  });
});

describe('integration settings', () => {
  let db: Db;
  beforeEach(async () => {
    db = (await createTestDb()) as Db;
  });

  it('saves a setting and reads it back without the secret', async () => {
    await saveIntegrationSetting(db, 'telegram', { chatIds: '-1001' }, '123456:ABC', null, KEY);
    const setting = await getIntegrationSetting(db, 'telegram');
    expect(setting).toEqual({ config: { chatIds: '-1001' }, hasSecret: true, updatedAt: expect.any(Date) });
    const [row] = await db.select().from(integrationSettings).where(eq(integrationSettings.id, 'telegram'));
    expect(row.secret).not.toContain('123456:ABC');
  });

  it('keeps the stored secret when saved again without one', async () => {
    await saveIntegrationSetting(db, 'telegram', { chatIds: '' }, '123456:ABC', null, KEY);
    await saveIntegrationSetting(db, 'telegram', { chatIds: '-1002' }, undefined, null, KEY);
    expect(await settingsEnv(db, KEY)).toMatchObject({ TELEGRAM_BOT_TOKEN: '123456:ABC', TELEGRAM_CHAT_IDS: '-1002' });
  });

  it('maps the model setting onto the model variables', async () => {
    await saveIntegrationSetting(db, 'model', { provider: 'anthropic', model: 'claude-sonnet-5-5', fastModel: 'claude-haiku-5-5', baseUrl: '' }, 'sk-test', null, KEY);
    expect(await settingsEnv(db, KEY)).toEqual({
      MEMBER_APP_MODEL_PROVIDER: 'anthropic',
      MEMBER_APP_MODEL: 'claude-sonnet-5-5',
      MEMBER_APP_FAST_MODEL: 'claude-haiku-5-5',
      MEMBER_APP_MODEL_API_KEY: 'sk-test',
      ANTHROPIC_API_KEY: 'sk-test',
    });
  });

  it('overlays saved settings on the environment', async () => {
    await saveIntegrationSetting(db, 'model', { provider: 'openai-compatible', model: 'glm-5', fastModel: '', baseUrl: 'https://api.z.ai/api/paas/v4' }, undefined, null, KEY);
    const env = await effectiveEnv(db, { ...KEY, MEMBER_APP_MODEL: 'old', MEMBER_APP_MODEL_API_KEY: 'from-env', OTHER: 'kept' }, { fresh: true });
    expect(env).toMatchObject({ MEMBER_APP_MODEL: 'glm-5', MEMBER_APP_MODEL_PROVIDER: 'openai-compatible', MEMBER_APP_MODEL_BASE_URL: 'https://api.z.ai/api/paas/v4', MEMBER_APP_MODEL_API_KEY: 'from-env', OTHER: 'kept' });
    expect(env.MEMBER_APP_FAST_MODEL).toBeUndefined();
  });

  it('ignores a secret it cannot read instead of failing', async () => {
    await saveIntegrationSetting(db, 'telegram', { chatIds: '' }, '123456:ABC', null, KEY);
    expect(await settingsEnv(db, { MEMBER_APP_SECRET_KEY: 'another-key-that-is-long-enough-to-use-456' })).toEqual({ TELEGRAM_CHAT_IDS: '' });
  });
});
