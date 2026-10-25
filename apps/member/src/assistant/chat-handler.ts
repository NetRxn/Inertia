import { isStepCount, streamText, type LanguageModel, type ModelMessage } from 'ai';
import type { Adapters, SourceRef } from '../adapters/types';
import type { Db } from '../db/client';
import type { Member } from '../identity/session';
import { appendMessage, ConversationForbiddenError, getOrCreateConversation, listMessages } from './conversations';
import { buildGreetingContext } from './greeting';
import { ModelNotConfiguredError } from './model';
import { SYSTEM_PROMPT } from './system-prompt';
import { createAssistantTools } from './tools';

export const MESSAGE_MAX = 4000;
const MAX_STEPS = 5;

export const NOT_CONFIGURED_MESSAGE =
  "The assistant isn't configured yet. Set MEMBER_APP_MODEL_PROVIDER and MEMBER_APP_MODEL in apps/member/.env.local.";

/** What the chat sends to the UI alongside each assistant message. */
export type ChatMetadata = { conversationId: string; sources?: SourceRef[] };

export type ChatHandlerDeps = {
  db: Db;
  adapters: Adapters;
  getMember: (request: Request) => Promise<Member | null>;
  getModel: () => LanguageModel;
  now?: () => Date;
};

function json(status: number, body: unknown) {
  return Response.json(body, { status });
}

/** Each source once, in the order it was first read. */
function dedupe(refs: SourceRef[]): SourceRef[] {
  const seen = new Map<string, SourceRef>();
  for (const ref of refs) if (!seen.has(`${ref.kind}:${ref.id}`)) seen.set(`${ref.kind}:${ref.id}`, ref);
  return [...seen.values()];
}

async function readBody(request: Request): Promise<{ conversationId?: string; message: string } | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null) return null;
  const { conversationId, message } = body as Record<string, unknown>;
  if (typeof message !== 'string' || !message.trim() || message.length > MESSAGE_MAX) return null;
  if (conversationId !== undefined && typeof conversationId !== 'string') return null;
  return { conversationId, message: message.trim() };
}

/**
 * POST /api/chat. Streams the assistant's reply (at most five tool steps) and,
 * when it finishes, stores the member's message and the reply with the sources
 * the tools read. The conversation id goes back as a header and as message
 * metadata; the sources ride along as metadata so the UI can draw chips.
 */
export function createChatHandler(deps: ChatHandlerDeps) {
  return async function POST(request: Request): Promise<Response> {
    const member = await deps.getMember(request);
    if (!member) return json(401, { error: 'Sign in to chat.' });

    const body = await readBody(request);
    if (!body) return json(400, { error: `Ask something between 1 and ${MESSAGE_MAX} characters.` });

    let model: LanguageModel;
    try {
      model = deps.getModel();
    } catch (error) {
      if (error instanceof ModelNotConfiguredError) return json(503, { error: NOT_CONFIGURED_MESSAGE });
      throw error;
    }

    let conversationId: string;
    try {
      conversationId = (await getOrCreateConversation(deps.db, member.id, body.conversationId)).id;
    } catch (error) {
      if (error instanceof ConversationForbiddenError) return json(403, { error: "That conversation isn't yours." });
      throw error;
    }

    const history = await listMessages(deps.db, conversationId);
    // An empty message would reach the provider as empty content, which it rejects.
    const messages: ModelMessage[] = history
      .filter((m) => m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }));
    if (history.length === 0) {
      // A new conversation: hand the assistant what changed so it can greet.
      const greeting = await buildGreetingContext(deps.adapters, member, null, deps.now?.() ?? new Date());
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: greeting },
          { type: 'text', text: body.message },
        ],
      });
    } else {
      messages.push({ role: 'user', content: body.message });
    }

    const collected: SourceRef[] = [];
    const tools = createAssistantTools({ adapters: deps.adapters, db: deps.db, memberId: member.id }, (refs) =>
      collected.push(...refs),
    );

    const result = streamText({
      model,
      instructions: SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: isStepCount(MAX_STEPS),
      onEnd: async ({ text }) => {
        await appendMessage(deps.db, conversationId, { role: 'user', content: body.message, sources: [] });
        // A reply with no text (every step spent on tool calls) isn't kept.
        if (text.trim()) {
          await appendMessage(deps.db, conversationId, { role: 'assistant', content: text, sources: dedupe(collected) });
        }
      },
    });

    return result.toUIMessageStreamResponse({
      headers: { 'x-conversation-id': conversationId },
      messageMetadata: ({ part }): ChatMetadata | undefined => {
        if (part.type === 'start') return { conversationId };
        if (part.type === 'finish') return { conversationId, sources: dedupe(collected) };
        return undefined;
      },
    });
  };
}
