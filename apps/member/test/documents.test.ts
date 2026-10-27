import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { documents as documentsTable, members } from '../src/db/schema';
import { getDocument, listDocuments, saveDocument } from '../src/documents/documents';

let db: Db;
let ana: { id: string };
let rob: { id: string };

beforeAll(async () => {
  db = (await createTestDb()) as Db;
});

beforeEach(async () => {
  await db.delete(documentsTable);
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

describe('documents', () => {
  it('saves a document with its sources and reads it back for the owner', async () => {
    const sources = [{ kind: 'meeting' as const, id: 'm1', title: 'October general' }];
    const { id } = await saveDocument(db, ana.id, { title: 'Garden brief', body: 'Draft text', sources });
    const doc = await getDocument(db, ana.id, id);
    expect(doc?.title).toBe('Garden brief');
    expect(doc?.content).toBe('Draft text');
    expect(doc?.sources).toEqual(sources);
  });

  it('getDocument returns null for another member', async () => {
    const { id } = await saveDocument(db, ana.id, { title: 'Mine', body: 'x', sources: [] });
    expect(await getDocument(db, rob.id, id)).toBeNull();
  });

  it('getDocument returns null for a malformed id', async () => {
    expect(await getDocument(db, ana.id, 'not-a-uuid')).toBeNull();
  });

  it('listDocuments lists only the owner\'s documents, newest first', async () => {
    await saveDocument(db, ana.id, { title: 'First', body: 'x', sources: [] });
    await saveDocument(db, rob.id, { title: 'Rob\'s', body: 'x', sources: [] });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await saveDocument(db, ana.id, { title: 'Second', body: 'x', sources: [] });
    const titles = (await listDocuments(db, ana.id)).map((doc) => doc.title);
    expect(titles).toEqual(['Second', 'First']);
  });
});
