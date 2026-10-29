import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { createMockModel } from './mock-model';
import { createAskJson, type AskJson } from '../org/llm';

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
      // The key is ANTHROPIC_API_KEY (or MEMBER_APP_MODEL_API_KEY). MEMBER_APP_MODEL_BASE_URL is
      // optional, for a gateway that speaks the Anthropic Messages API.
      return createAnthropic({
        apiKey: env.ANTHROPIC_API_KEY?.trim() || env.MEMBER_APP_MODEL_API_KEY?.trim() || undefined,
        baseURL: env.MEMBER_APP_MODEL_BASE_URL?.trim() || undefined,
      })(modelId);
    case 'openai-compatible': {
      const baseURL = env.MEMBER_APP_MODEL_BASE_URL?.trim();
      if (!baseURL) throw new ModelNotConfiguredError('MEMBER_APP_MODEL_BASE_URL is not set.');
      return createOpenAICompatible({ name: 'member-app', baseURL, apiKey: env.MEMBER_APP_MODEL_API_KEY })(modelId);
    }
    default:
      throw new ModelNotConfiguredError(`Unknown MEMBER_APP_MODEL_PROVIDER "${provider}".`);
  }
}

/**
 * A cheaper model for background work such as reading meetings and uploads, set with
 * MEMBER_APP_FAST_MODEL on the same provider (e.g. claude-haiku-5-5 with anthropic).
 * Falls back to MEMBER_APP_MODEL.
 */
export function getFastModel(env: Record<string, string | undefined> = process.env): LanguageModel {
  const fast = env.MEMBER_APP_FAST_MODEL?.trim();
  return getModel(fast ? { ...env, MEMBER_APP_MODEL: fast } : env);
}

/**
 * Extra request settings for background calls. MEMBER_APP_MODEL_THINKING=off
 * turns off step-by-step reasoning on providers that support it (Z.ai GLM),
 * which keeps extraction quick and cheap. Opt-in, since other servers may reject the field.
 */
export function backgroundProviderOptions(env: Record<string, string | undefined> = process.env) {
  if (env.MEMBER_APP_MODEL_PROVIDER?.trim() !== 'openai-compatible' || env.MEMBER_APP_MODEL_THINKING?.trim() !== 'off') return undefined;
  return { memberApp: { thinking: { type: 'disabled' } } };
}

/**
 * JSON asks for background work: the fast model, falling back to MEMBER_APP_MODEL
 * when the fast one can't answer (a busy flash model shouldn't stop Find work).
 */
export function backgroundAskJson(env: Record<string, string | undefined> = process.env): AskJson {
  const fallback = env.MEMBER_APP_FAST_MODEL?.trim() && env.MEMBER_APP_FAST_MODEL.trim() !== env.MEMBER_APP_MODEL?.trim() ? getModel(env) : undefined;
  return createAskJson(getFastModel(env), backgroundProviderOptions(env), fallback);
}
