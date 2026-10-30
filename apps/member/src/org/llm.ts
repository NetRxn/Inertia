import { streamText, type LanguageModel } from 'ai';
import type { SharedV4ProviderOptions } from '@ai-sdk/provider';
import type { z } from 'zod';

/** Asks for JSON in a plain text reply and checks it, so it works with any provider. */
export type AskJson = <T>(args: { system: string; prompt: string; schema: z.ZodType<T>; maxOutputTokens?: number }) => Promise<T>;

export class ModelReplyError extends Error {}

/** The outermost JSON object in a reply, ignoring code fences or chatter around it. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new ModelReplyError('The model reply had no JSON object.');
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * With a fallback, a call the first model can't answer at all (overloaded, unavailable)
 * is sent once to the fallback instead, e.g. from a busy fast model to the main one.
 */
export function createAskJson(model: LanguageModel, providerOptions?: SharedV4ProviderOptions, fallback?: LanguageModel): AskJson {
  return async ({ system, prompt, schema, maxOutputTokens = 4000 }) => {
    let lastError: unknown;
    let current = model;
    let canFallBack = Boolean(fallback);
    for (let attempt = 0; attempt < 2; attempt++) {
      // Streamed, so long replies survive proxies that cut idle requests.
      const result = streamText({
        model: current,
        providerOptions,
        system: `${system}\n\nReply with one JSON object only, no other text.`,
        prompt: attempt ? `${prompt}\n\nYour previous reply was not valid JSON for the requested shape. Reply with the JSON object only.` : prompt,
        maxOutputTokens,
        // Failures reach us through result.text below; skip the SDK's default stack dump.
        onError: () => {},
      });
      let text: string;
      try {
        text = await result.text;
      } catch (error) {
        if (!canFallBack || !fallback) throw error;
        console.warn('[model] Background model failed; trying the main model.', error instanceof Error ? error.message : error);
        canFallBack = false;
        current = fallback;
        attempt--;
        continue;
      }
      try {
        return schema.parse(extractJson(text));
      } catch (error) {
        lastError = error;
      }
    }
    throw new ModelReplyError(`The model did not return usable JSON: ${lastError instanceof Error ? lastError.message : 'unknown error'}`);
  };
}
