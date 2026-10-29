import { describe, it, expect, vi } from 'vitest';
import type { LanguageModelV4 } from '@ai-sdk/provider';
import { z } from 'zod';
import { createAskJson } from '../src/org/llm';

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

/** A model that replies with `reply`, or whose API call fails when `reply` is an Error. */
function model(id: string, reply: string | Error, calls: string[]): LanguageModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'test',
    modelId: id,
    supportedUrls: {},
    async doGenerate() {
      throw new Error('stream only');
    },
    async doStream() {
      calls.push(id);
      if (reply instanceof Error) throw reply;
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: 't' });
            controller.enqueue({ type: 'text-delta', id: 't', delta: reply });
            controller.enqueue({ type: 'text-end', id: 't' });
            controller.enqueue({ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage });
            controller.close();
          },
        }),
      };
    },
  } as LanguageModelV4;
}

const ask = { system: 's', prompt: 'p', schema: z.object({ ok: z.boolean() }) };

describe('createAskJson', () => {
  it('sends the ask to the fallback when the first model fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const calls: string[] = [];
    const askJson = createAskJson(model('fast', new Error('overloaded'), calls), undefined, model('main', '{"ok":true}', calls));
    await expect(askJson(ask)).resolves.toEqual({ ok: true });
    expect(calls[0]).toBe('fast');
    expect(calls.at(-1)).toBe('main');
  });

  it('fails without a fallback', async () => {
    const calls: string[] = [];
    const askJson = createAskJson(model('fast', new Error('overloaded'), calls));
    await expect(askJson(ask)).rejects.toThrow();
  });

  it('does not fall back for a reply that is not JSON', async () => {
    const calls: string[] = [];
    const askJson = createAskJson(model('fast', 'no json here', calls), undefined, model('main', '{"ok":true}', calls));
    await expect(askJson(ask)).rejects.toThrow(/usable JSON/);
    expect(calls.every((id) => id === 'fast')).toBe(true);
  });
});
