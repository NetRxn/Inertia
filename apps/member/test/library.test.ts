import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { files, members, organization } from '../src/db/schema';
import { addLibraryDocument, canEditLibrary, LibraryError, listLibrary, removeLibraryDocument, setLibraryPinned } from '../src/documents/library';

describe('document library', () => {
  let db: Db;
  let admin: { id: string; role: 'admin' };
  let member: { id: string; role: 'member' };

  beforeEach(async () => {
    db = (await createTestDb()) as Db;
    const [a, m] = await db
      .insert(members)
      .values([
        { externalId: 'm-ana', email: 'ana@example.org', displayName: 'Ana', role: 'admin' },
        { externalId: 'm-rob', email: 'rob@example.org', displayName: 'Rob' },
      ])
      .returning();
    admin = { id: a.id, role: 'admin' };
    member = { id: m.id, role: 'member' };
    await db.insert(organization).values({ id: 1, name: 'Riverside Commons' });
  });

  it('lists what admins add for every member, pinned first, then newest', async () => {
    const policy = await addLibraryDocument(db, admin, { title: 'Treasury policy', description: '', category: 'policy', linkUrl: 'https://docs.example.org/treasury' });
    await addLibraryDocument(db, admin, { title: 'One-pager', description: 'Who we are', category: 'one-pager', linkUrl: 'https://docs.example.org/one-pager' });
    await setLibraryPinned(db, admin, policy.id, true);
    expect((await listLibrary(db)).map((d) => [d.title, d.pinned])).toEqual([['Treasury policy', true], ['One-pager', false]]);
  });

  it('keeps an uploaded file with its name', async () => {
    const [file] = await db.insert(files).values({ name: 'one-pager.pdf', path: '/tmp/x', mimeType: 'application/pdf', size: 10, uploadedBy: admin.id }).returning();
    await addLibraryDocument(db, admin, { title: 'One-pager', description: '', category: 'one-pager', fileId: file.id });
    expect(await listLibrary(db)).toEqual([expect.objectContaining({ title: 'One-pager', fileId: file.id, fileName: 'one-pager.pdf', linkUrl: null })]);
  });

  it('refuses members unless the organization lets everyone add', async () => {
    const input = { title: 'Notes', description: '', category: 'other' as const, linkUrl: 'https://docs.example.org/notes' };
    expect(await canEditLibrary(db, member)).toBe(false);
    await expect(addLibraryDocument(db, member, input)).rejects.toThrow(LibraryError);
    await db.update(organization).set({ libraryEditors: 'members' });
    expect(await canEditLibrary(db, member)).toBe(true);
    await expect(addLibraryDocument(db, member, input)).resolves.toMatchObject({ id: expect.any(String) });
  });

  it('takes web links only, and needs a title and exactly one of file or link', async () => {
    await expect(addLibraryDocument(db, admin, { title: 'x', description: '', category: 'other', linkUrl: 'javascript:alert(1)' })).rejects.toThrow('https://');
    await expect(addLibraryDocument(db, admin, { title: ' ', description: '', category: 'other', linkUrl: 'https://a.example.org' })).rejects.toThrow('title');
    await expect(addLibraryDocument(db, admin, { title: 'x', description: '', category: 'other' })).rejects.toThrow('file or a link');
  });

  it('lets editors remove a document', async () => {
    const doc = await addLibraryDocument(db, admin, { title: 'Old', description: '', category: 'other', linkUrl: 'https://a.example.org' });
    await expect(removeLibraryDocument(db, member, doc.id)).rejects.toThrow(LibraryError);
    await removeLibraryDocument(db, admin, doc.id);
    expect(await listLibrary(db)).toEqual([]);
  });
});
