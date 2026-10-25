import { asc, eq } from 'drizzle-orm';
import type { SourceRef } from '../adapters/types';
import type { Db } from '../db/client';
import { conversations, messages } from '../db/schema';

/** The conversation belongs to someone else. */
export class ConversationForbiddenError extends Error {}

export type StoredMessage = typeof messages.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reopens the member's conversation, or starts a new one when there is no id
 * (or it no longer exists). Another member's conversation throws.
 */
export async function getOrCreateConversation(
  db: Db,
  memberId: string,
  conversationId?: string,
): Promise<{ id: string }> {
  if (conversationId && UUID.test(conversationId)) {
    const [existing] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (existing) {
      if (existing.memberId !== memberId) throw new ConversationForbiddenError('Not your conversation.');
      return { id: existing.id };
    }
  }
  const [created] = await db.insert(conversations).values({ memberId }).returning();
  return { id: created.id };
}

/** Adds one message, with the sources it cites, and marks the conversation active. */
export async function appendMessage(
  db: Db,
  conversationId: string,
  msg: { role: 'user' | 'assistant'; content: string; sources: SourceRef[] },
): Promise<void> {
  await db.insert(messages).values({ conversationId, ...msg });
  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
}

/** A conversation's messages, oldest first. */
export async function listMessages(db: Db, conversationId: string): Promise<StoredMessage[]> {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
}
