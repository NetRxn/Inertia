import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { simulateReadableStream, type LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { conversations as conversationsTable, members, messages as messagesTable } from '../src/db/schema';
import { createFixtureAdapters, defaultFixture, FIXTURE_NOW } from '../src/adapters';
import type { Meeting } from '../src/adapters';
import { createChatHandler } from '../src/assistant/chat-handler';
import { ModelNotConfiguredError } from '../src/assistant/model';
import { appendMessage, getOrCreateConversation, listMessages } from '../src/assistant/conversations';
import type { Member } from '../src/identity/session';

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

const gardenMeeting: Meeting = {
  id: 'meet-1',
  date: FIXTURE_NOW.toISOString(),
  title: 'Garden planning',
  summary: 'We picked the north lot.',
  decisions: [],
  openQuestions: [],
  actionItems: [],
  transcriptUrl: null,
};

/** A model that calls searchMeetings on its first step and answers on its second. */
function scriptedModel(): LanguageModel {
  let calls = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      calls += 1;
      const chunks: LanguageModelV4StreamPart[] =
        calls === 1
          ? [
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'searchMeetings', input: JSON.stringify({ query: 'garden' }) },
              { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage },
            ]
          : [
              { type: 'text-start', id: 't1' },
              { type: 'text-delta', id: 't1', delta: 'We picked the north lot (Garden planning).' },
              { type: 'text-end', id: 't1' },
              { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage },
            ];
      return { stream: simulateReadableStream({ chunks }) };
    },
  });
}

let db: Db;
let ana: Member;
let rob: Member;

function handler(opts: { member?: Member | null; model?: () => LanguageModel } = {}) {
  return createChatHandler({
    db,
    adapters: createFixtureAdapters({ ...defaultFixture(FIXTURE_NOW), meetings: [gardenMeeting] }),
    getMember: async () => (opts.member === undefined ? ana : opts.member),
    getModel: opts.model ?? scriptedModel,
    now: () => FIXTURE_NOW,
  });
}

function post(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  db = (await createTestDb()) as Db;
});

beforeEach(async () => {
  await db.delete(messagesTable);
  await db.delete(conversationsTable);
  await db.delete(members);
  [ana] = await db
    .insert(members)
    .values({ externalId: 'm-ana', email: 'ana@example.org', displayName: 'Ana Rodriguez' })
    .returning();
  [rob] = await db
    .insert(members)
    .values({ externalId: 'm-rob', email: 'rob@example.org', displayName: 'Rob Chen' })
    .returning();
});

describe('POST /api/chat', () => {
  it('stores the assistant message with the meeting source ref', async () => {
    const response = await handler()(post({ message: 'What did we decide about the garden?' }));
    expect(response.status).toBe(200);
    const conversationId = response.headers.get('x-conversation-id');
    expect(conversationId).toMatch(/^[0-9a-f-]{36}$/);

    const body = await response.text();
    // The sources reach the UI as message metadata.
    expect(body).toContain('"sources"');
    expect(body).toContain('Garden planning');

    await vi.waitFor(async () => expect(await listMessages(db, conversationId!)).toHaveLength(2));
    const [user, assistant] = await listMessages(db, conversationId!);
    expect(user).toMatchObject({ role: 'user', content: 'What did we decide about the garden?', sources: [] });
    expect(assistant.role).toBe('assistant');
    expect(assistant.content).toBe('We picked the north lot (Garden planning).');
    expect(assistant.sources).toEqual([{ kind: 'meeting', id: 'meet-1', title: 'Garden planning' }]);
  });

  it('stores no empty assistant reply and never replays one to the model', async () => {
    const { id } = await getOrCreateConversation(db, ana.id);
    // A reply stored before this fix: empty assistant text would reach the provider as empty content.
    await appendMessage(db, id, { role: 'user', content: 'First question', sources: [] });
    await appendMessage(db, id, { role: 'assistant', content: '', sources: [] });

    const prompts: unknown[] = [];
    const silent = () =>
      new MockLanguageModelV4({
        doStream: async (options) => {
          prompts.push(options.prompt);
          return {
            stream: simulateReadableStream({
              chunks: [{ type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage }] as LanguageModelV4StreamPart[],
            }),
          };
        },
      });

    const response = await handler({ model: silent })(post({ conversationId: id, message: 'Second question' }));
    await response.text();

    // Only the question is stored; the empty reply is not.
    await vi.waitFor(async () => expect(await listMessages(db, id)).toHaveLength(3));
    await new Promise((resolve) => setTimeout(resolve, 50));
    const stored = await listMessages(db, id);
    expect(stored.map((m) => [m.role, m.content])).toEqual([
      ['user', 'First question'],
      ['assistant', ''],
      ['user', 'Second question'],
    ]);

    // The model never saw an assistant message without content.
    const prompt = prompts[0] as { role: string; content: unknown }[];
    const assistants = prompt.filter((m) => m.role === 'assistant');
    expect(assistants).toEqual([]);
  });

  it('continues an existing conversation', async () => {
    const { id } = await getOrCreateConversation(db, ana.id);
    const response = await handler()(post({ conversationId: id, message: 'And the garden?' }));
    expect(response.headers.get('x-conversation-id')).toBe(id);
    await response.text();
    await vi.waitFor(async () => expect(await listMessages(db, id)).toHaveLength(2));
  });

  it('returns 401 without a member', async () => {
    const response = await handler({ member: null })(post({ message: 'hi' }));
    expect(response.status).toBe(401);
  });

  it('returns 503 with the setup message when the model is not configured', async () => {
    const response = await handler({
      model: () => {
        throw new ModelNotConfiguredError('missing');
      },
    })(post({ message: 'hi' }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error:
        "The assistant isn't configured yet. Set MEMBER_APP_MODEL_PROVIDER and MEMBER_APP_MODEL in apps/member/.env.local.",
    });
  });

  it('returns 403 for another member\'s conversation', async () => {
    const { id } = await getOrCreateConversation(db, rob.id);
    const response = await handler()(post({ conversationId: id, message: 'peek' }));
    expect(response.status).toBe(403);
    expect(await listMessages(db, id)).toEqual([]);
  });

  it('rejects an empty or 4001-character message with 400', async () => {
    expect((await handler()(post({ message: '' }))).status).toBe(400);
    expect((await handler()(post({ message: '   ' }))).status).toBe(400);
    expect((await handler()(post({ message: 'x'.repeat(4001) }))).status).toBe(400);
    expect((await handler()(post({}))).status).toBe(400);
    expect((await handler()(new Request('http://localhost/api/chat', { method: 'POST', body: '{' }))).status).toBe(400);
  });
});
