import { describe, it, expect } from 'vitest';
import { getFastModel, getModel, ModelNotConfiguredError } from '../src/assistant/model';

describe('getModel', () => {
  it('throws ModelNotConfiguredError when env is empty', () => {
    expect(() => getModel({})).toThrow(ModelNotConfiguredError);
  });

  it('throws when the provider is unknown', () => {
    expect(() => getModel({ MEMBER_APP_MODEL_PROVIDER: 'carrier-pigeon', MEMBER_APP_MODEL: 'x' })).toThrow(
      ModelNotConfiguredError,
    );
  });

  it('requires a model id', () => {
    expect(() => getModel({ MEMBER_APP_MODEL_PROVIDER: 'anthropic' })).toThrow(ModelNotConfiguredError);
  });

  it('requires base URL for openai-compatible', () => {
    expect(() => getModel({ MEMBER_APP_MODEL_PROVIDER: 'openai-compatible', MEMBER_APP_MODEL: 'local-model' })).toThrow(
      ModelNotConfiguredError,
    );
    const model = getModel({
      MEMBER_APP_MODEL_PROVIDER: 'openai-compatible',
      MEMBER_APP_MODEL: 'local-model',
      MEMBER_APP_MODEL_BASE_URL: 'http://localhost:11434/v1',
    });
    expect(typeof model).toBe('object');
    expect((model as { modelId: string }).modelId).toBe('local-model');
  });

  it('builds an anthropic model', () => {
    const model = getModel({ MEMBER_APP_MODEL_PROVIDER: 'anthropic', MEMBER_APP_MODEL: 'claude-opus-5-5' });
    expect((model as { modelId: string }).modelId).toBe('claude-opus-5-5');
    expect((model as { provider: string }).provider).toMatch(/anthropic/);
  });

  it('provider mock returns the scripted mock outside production and throws ModelNotConfiguredError when NODE_ENV is production', () => {
    const model = getModel({ MEMBER_APP_MODEL_PROVIDER: 'mock', NODE_ENV: 'test' });
    expect((model as { provider: string }).provider).toBe('mock');
    expect(() => getModel({ MEMBER_APP_MODEL_PROVIDER: 'mock', NODE_ENV: 'production' })).toThrow(
      ModelNotConfiguredError,
    );
  });

  it('uses MEMBER_APP_FAST_MODEL for background work and falls back to the main model', () => {
    const env = {
      MEMBER_APP_MODEL_PROVIDER: 'openai-compatible',
      MEMBER_APP_MODEL: 'glm-4.7',
      MEMBER_APP_MODEL_BASE_URL: 'https://api.z.ai/api/paas/v4',
    };
    expect((getFastModel(env) as { modelId: string }).modelId).toBe('glm-4.7');
    expect((getFastModel({ ...env, MEMBER_APP_FAST_MODEL: 'glm-4.7-flash' }) as { modelId: string }).modelId).toBe('glm-4.7-flash');
  });
});
