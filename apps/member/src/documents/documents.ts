import { and, desc, eq } from 'drizzle-orm';
import type { SourceRef } from '../adapters/types';
import type { Db } from '../db/client';
import { documents } from '../db/schema';

export type Document = typeof documents.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Saves a member's private document, with the sources it drew on. */
export async function saveDocument(
  db: Db,
  ownerId: string,
  doc: { title: string; body: string; sources: SourceRef[] },
): Promise<{ id: string }> {
  const [row] = await db
    .insert(documents)
    .values({ memberId: ownerId, title: doc.title, content: doc.body, sources: doc.sources })
    .returning();
  return { id: row.id };
}

/** A member's own documents, newest first. */
export async function listDocuments(db: Db, ownerId: string): Promise<Document[]> {
  return db.select().from(documents).where(eq(documents.memberId, ownerId)).orderBy(desc(documents.createdAt));
}

/** One of the member's own documents; another member's (or a missing one) is null. */
export async function getDocument(db: Db, ownerId: string, id: string): Promise<Document | null> {
  if (!UUID.test(id)) return null;
  const [row] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.memberId, ownerId)))
    .limit(1);
  return row ?? null;
}
