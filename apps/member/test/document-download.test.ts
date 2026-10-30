import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { documents as documentsTable, members } from '../src/db/schema';
import { saveDocument } from '../src/documents/documents';
import { createDocumentDownloadHandler, documentFilename } from '../src/documents/download';
import type { Member } from '../src/identity/session';

let db: Db;
let ana: Member;
let rob: Member;

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

function download(id: string, member: Member | null) {
  const handle = createDocumentDownloadHandler({ db, getMember: async () => member });
  return handle(id);
}

describe('document download', () => {
  it('download returns markdown for the owner and 404 for others', async () => {
    const { id } = await saveDocument(db, ana.id, {
      title: 'Garden Brief',
      body: '# Garden brief\n\nWe picked the north lot.',
      sources: [],
    });

    const mine = await download(id, ana);
    expect(mine.status).toBe(200);
    expect(mine.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(mine.headers.get('content-disposition')).toBe('attachment; filename="garden-brief.md"');
    expect(mine.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await mine.text()).toBe('# Garden brief\n\nWe picked the north lot.');

    expect((await download(id, rob)).status).toBe(404);
  });

  it('answers 404 for a missing or malformed id and 401 without a member', async () => {
    const { id } = await saveDocument(db, ana.id, { title: 'Mine', body: 'x', sources: [] });
    expect((await download('00000000-0000-4000-8000-000000000000', ana)).status).toBe(404);
    expect((await download('../etc/passwd', ana)).status).toBe(404);
    expect((await download(id, null)).status).toBe(401);
  });

  it('filename is slugified and never contains / or ..', () => {
    expect(documentFilename('Garden Brief')).toBe('garden-brief.md');
    expect(documentFilename('../../etc/passwd')).toBe('etc-passwd.md');
    expect(documentFilename('a/b\\c')).toBe('a-b-c.md');
    expect(documentFilename('Ünïcode “quotes”\r\nand more!')).toBe('unicode-quotes-and-more.md');
    expect(documentFilename('...')).toBe('document.md');
    expect(documentFilename('')).toBe('document.md');
    expect(documentFilename('x'.repeat(300)).length).toBeLessThanOrEqual(83);

    for (const title of ['../..', '/', 'a/../b', '..\\..\\x', 'name.with.dots..md']) {
      const name = documentFilename(title);
      expect(name).not.toContain('/');
      expect(name).not.toContain('\\');
      expect(name).not.toContain('..');
      expect(name).toMatch(/^[a-z0-9-]+\.md$/);
    }
  });
});
