import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { files, libraryDocuments } from '../db/schema';
import { getOrganization } from '../org/organization';
import { LIBRARY_CATEGORIES, type LibraryCategory } from './library-categories';

export { LIBRARY_CATEGORIES, type LibraryCategory };

export type LibraryDocument = Pick<typeof libraryDocuments.$inferSelect, 'id' | 'title' | 'description' | 'category' | 'fileId' | 'linkUrl' | 'pinned' | 'createdAt'> & {
  fileName: string | null;
};

type Editor = { id: string; role: string };

export class LibraryError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admins always; members too when the organization allows it. */
export async function canEditLibrary(db: Db, member: Editor): Promise<boolean> {
  if (member.role === 'admin') return true;
  return (await getOrganization(db))?.libraryEditors === 'members';
}

async function requireEditor(db: Db, member: Editor): Promise<void> {
  if (!(await canEditLibrary(db, member))) throw new LibraryError('Only admins can change the library.');
}

/** Every key document, pinned first, then newest. Visible to every member. */
export async function listLibrary(db: Db): Promise<LibraryDocument[]> {
  return db
    .select({
      id: libraryDocuments.id,
      title: libraryDocuments.title,
      description: libraryDocuments.description,
      category: libraryDocuments.category,
      fileId: libraryDocuments.fileId,
      linkUrl: libraryDocuments.linkUrl,
      pinned: libraryDocuments.pinned,
      createdAt: libraryDocuments.createdAt,
      fileName: files.name,
    })
    .from(libraryDocuments)
    .leftJoin(files, eq(files.id, libraryDocuments.fileId))
    .orderBy(desc(libraryDocuments.pinned), desc(libraryDocuments.createdAt));
}

export async function addLibraryDocument(
  db: Db,
  member: Editor,
  input: { title: string; description: string; category: LibraryCategory; fileId?: string | null; linkUrl?: string | null },
): Promise<{ id: string }> {
  await requireEditor(db, member);
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new LibraryError('Give the document a title.');
  const linkUrl = input.linkUrl?.trim() || null;
  const fileId = input.fileId || null;
  if (Boolean(linkUrl) === Boolean(fileId)) throw new LibraryError('Add a file or a link.');
  // Links open from the library, so only web addresses.
  if (linkUrl && !/^https?:\/\/[^\s]+$/i.test(linkUrl)) throw new LibraryError('Links should start with https://.');
  if (!LIBRARY_CATEGORIES.some((c) => c.category === input.category)) throw new LibraryError('Pick a category.');
  const [row] = await db
    .insert(libraryDocuments)
    .values({ title, description: input.description.trim().slice(0, 600), category: input.category, fileId, linkUrl, addedBy: member.id })
    .returning();
  return { id: row.id };
}

export async function setLibraryPinned(db: Db, member: Editor, id: string, pinned: boolean): Promise<void> {
  await requireEditor(db, member);
  if (!UUID.test(id)) return;
  await db.update(libraryDocuments).set({ pinned }).where(eq(libraryDocuments.id, id));
}

/** Takes a document out of the library. An uploaded file stays stored, like a share's. */
export async function removeLibraryDocument(db: Db, member: Editor, id: string): Promise<void> {
  await requireEditor(db, member);
  if (!UUID.test(id)) return;
  await db.delete(libraryDocuments).where(eq(libraryDocuments.id, id));
}
