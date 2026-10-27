import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { conversations as conversationsTable, members } from '../src/db/schema';
import {
  appendMessage,
  ConversationForbiddenError,
  getOrCreateConversation,
  listMessages,
} from '../src/assistant/conversations';

let db: Db;
let ana: { id: string };
let rob: { id: string };

beforeAll(async () => {
  db = (await createTestDb()) as Db;
});

beforeEach(async () => {
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

describe('conversations', () => {
  it('creates a conversation and reopens it for its owner', async () => {
    const { id } = await getOrCreateConversation(db, ana.id);
    expect((await getOrCreateConversation(db, ana.id, id)).id).toBe(id);
  });

  it('member B cannot open member A\'s conversation', async () => {
    const { id } = await getOrCreateConversation(db, ana.id);
    await expect(getOrCreateConversation(db, rob.id, id)).rejects.toBeInstanceOf(ConversationForbiddenError);
  });

  it('an unknown or malformed id starts a fresh conversation', async () => {
    const fresh = await getOrCreateConversation(db, ana.id, '00000000-0000-4000-8000-000000000000');
    expect(fresh.id).not.toBe('00000000-0000-4000-8000-000000000000');
    expect((await getOrCreateConversation(db, ana.id, 'nope')).id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('messages persist with sources', async () => {
    const { id } = await getOrCreateConversation(db, ana.id);
    const sources = [{ kind: 'meeting' as const, id: 'm1', title: 'Garden planning' }];
    await appendMessage(db, id, { role: 'user', content: 'What happened?', sources: [] });
    await appendMessage(db, id, { role: 'assistant', content: 'We picked a lot.', sources });

    const stored = await listMessages(db, id);
    expect(stored.map((m) => [m.role, m.content])).toEqual([
      ['user', 'What happened?'],
      ['assistant', 'We picked a lot.'],
    ]);
    expect(stored[1].sources).toEqual(sources);
  });
});
