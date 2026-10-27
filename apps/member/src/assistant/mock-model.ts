import type { LanguageModelV4, LanguageModelV4Prompt, LanguageModelV4StreamPart } from '@ai-sdk/provider';

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

/** The title of the first <source> block in the latest tool result, if any. */
function firstSourceTitle(prompt: LanguageModelV4Prompt): string | null {
  const toolMessage = [...prompt].reverse().find((message) => message.role === 'tool');
  if (!toolMessage) return null;
  const match = JSON.stringify(toolMessage.content).match(/<source kind=\\"[^"\\]*\\" id=\\"[^"\\]*\\" title=\\"([^"\\]*)\\"/);
  return match ? match[1] : null;
}

function streamOf(parts: LanguageModelV4StreamPart[]): ReadableStream<LanguageModelV4StreamPart> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

/**
 * A scripted assistant for local runs and e2e (MEMBER_APP_MODEL_PROVIDER=mock).
 * Its first step looks up the latest meetings; its second answers from the
 * first source it read and cites it by title. It never calls a real model.
 */
export function createMockModel(): LanguageModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'mock',
    modelId: 'scripted',
    supportedUrls: {},
    async doGenerate() {
      throw new Error('The scripted mock model only streams.');
    },
    async doStream({ prompt }) {
      const hasToolResult = prompt.some((message) => message.role === 'tool');
      if (!hasToolResult) {
        return {
          stream: streamOf([
            { type: 'stream-start', warnings: [] },
            { type: 'tool-call', toolCallId: 'mock-call-1', toolName: 'searchMeetings', input: JSON.stringify({ query: '' }) },
            { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage },
          ]),
        };
      }
      const title = firstSourceTitle(prompt);
      const text = title
        ? `Here's the latest from the DAO's records: the most recent meeting was ${title} (${title}).`
        : "I couldn't find that in the DAO's records.";
      return {
        stream: streamOf([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'mock-text' },
          { type: 'text-delta', id: 'mock-text', delta: text },
          { type: 'text-end', id: 'mock-text' },
          { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage },
        ]),
      };
    },
  };
}
