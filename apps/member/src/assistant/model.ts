import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { createMockModel } from './mock-model';

/** The assistant has no usable model; the chat route answers 503 with setup help. */
export class ModelNotConfiguredError extends Error {}

/**
 * The assistant's model, chosen by environment so the provider stays swappable:
 * MEMBER_APP_MODEL_PROVIDER (anthropic | openai-compatible), MEMBER_APP_MODEL,
 * and MEMBER_APP_MODEL_BASE_URL for openai-compatible. Tests and e2e may set
 * the provider to `mock`, which is refused in production.
 */
export function getModel(env: Record<string, string | undefined> = process.env): LanguageModel {
  const provider = env.MEMBER_APP_MODEL_PROVIDER?.trim();
  const modelId = env.MEMBER_APP_MODEL?.trim();

  if (provider === 'mock') {
    if (env.NODE_ENV === 'production') {
      throw new ModelNotConfiguredError('The mock model is for tests only.');
    }
    return createMockModel();
  }
  if (!provider) throw new ModelNotConfiguredError('MEMBER_APP_MODEL_PROVIDER is not set.');
  if (!modelId) throw new ModelNotConfiguredError('MEMBER_APP_MODEL is not set.');

  switch (provider) {
    case 'anthropic':
      // The API key comes from ANTHROPIC_API_KEY, read by the provider.
      return createAnthropic()(modelId);
    case 'openai-compatible': {
      const baseURL = env.MEMBER_APP_MODEL_BASE_URL?.trim();
      if (!baseURL) throw new ModelNotConfiguredError('MEMBER_APP_MODEL_BASE_URL is not set.');
      return createOpenAICompatible({ name: 'member-app', baseURL, apiKey: env.MEMBER_APP_MODEL_API_KEY })(modelId);
    }
    default:
      throw new ModelNotConfiguredError(`Unknown MEMBER_APP_MODEL_PROVIDER "${provider}".`);
  }
}
