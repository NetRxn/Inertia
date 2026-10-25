import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { members, shares as sharesTable, files as filesTable } from '../src/db/schema';
import {
  createShare,
  deleteShare,
  listShares,
  ShareValidationError,
} from '../src/shares/shares';

const noPreview = async () => null;

async function insertMember(db: Db, email: string, displayName: string) {
  const [row] = await db
    .insert(members)
    .values({ externalId: `m-${email.split('@')[0]}`, email, displayName })
    .returning();
  return row;
}

let db: Db;
let author: Awaited<ReturnType<typeof insertMember>>;
let other: Awaited<ReturnType<typeof insertMember>>;

// One database for the whole file, emptied between tests: migrations into a
// fresh PGlite are expensive, and the full suite runs files in parallel.
beforeAll(async () => {
  db = (await createTestDb()) as Db;
});

beforeEach(async () => {
  await db.delete(sharesTable);
  await db.delete(filesTable);
  await db.delete(members);
  author = await insertMember(db, 'ana@example.org', 'Ana Rodriguez');
  other = await insertMember(db, 'rob@example.org', 'Rob Chen');
});

describe('createShare', () => {
  it('saves an idea with only a description', async () => {
    const share = await createShare(
      db,
      author.id,
      { description: 'A tool library for the garden' },
      { fetchPreview: noPreview },
    );

    expect(share.id).toBeTruthy();
    expect(share.description).toBe('A tool library for the garden');
    expect(share.authorName).toBe('Ana Rodriguez');
    expect(share.linkUrl).toBeNull();

    const rows = await db.select().from(sharesTable);
    expect(rows).toHaveLength(1);
    expect(rows[0].memberId).toBe(author.id);
    expect(rows[0].linkUrl).toBeNull();
  });

  it('defaults kind to idea', async () => {
    const share = await createShare(db, author.id, { description: 'Hello' }, { fetchPreview: noPreview });
    expect(share.kind).toBe('idea');

    const rows = await db.select().from(sharesTable);
    expect(rows[0].kind).toBe('idea');
  });

  it('rejects an empty share', async () => {
    await expect(createShare(db, author.id, {}, { fetchPreview: noPreview })).rejects.toThrow(
      ShareValidationError,
    );
    await expect(
      createShare(db, author.id, { description: '   ' }, { fetchPreview: noPreview }),
    ).rejects.toThrow(ShareValidationError);

    // Nothing was written.
    const rows = await db.select().from(sharesTable);
    expect(rows).toHaveLength(0);

    // A link on its own is enough to share.
    const linkOnly = await createShare(
      db,
      author.id,
      { linkUrl: 'https://example.org/post' },
      { fetchPreview: noPreview },
    );
    expect(linkOnly.linkUrl).toBe('https://example.org/post');
  });

  it('rejects a javascript: link', async () => {
    await expect(
      createShare(
        db,
        author.id,
        { description: 'Look', linkUrl: 'javascript:alert(1)' },
        { fetchPreview: noPreview },
      ),
    ).rejects.toThrow(/http/i);

    const rows = await db.select().from(sharesTable);
    expect(rows).toHaveLength(0);
  });

  it('rejects a description over 2000 characters', async () => {
    await expect(
      createShare(db, author.id, { description: 'a'.repeat(2001) }, { fetchPreview: noPreview }),
    ).rejects.toThrow(ShareValidationError);

    const exact = await createShare(
      db,
      author.id,
      { description: 'a'.repeat(2000) },
      { fetchPreview: noPreview },
    );
    expect(exact.description).toHaveLength(2000);
  });

  it('saves without preview when the preview fetch returns null', async () => {
    let fetchedUrl: string | null = null;
    const share = await createShare(
      db,
      author.id,
      { description: 'Grant programme', linkUrl: 'https://example.org/grants' },
      {
        fetchPreview: async (url) => {
          fetchedUrl = url;
          return null;
        },
      },
    );

    expect(fetchedUrl).toBe('https://example.org/grants');
    expect(share.previewTitle).toBeNull();

    const [row] = await db.select().from(sharesTable);
    expect(row.linkUrl).toBe('https://example.org/grants');
    expect(row.linkTitle).toBeNull();
    expect(row.linkDescription).toBeNull();
    expect(row.linkImageUrl).toBeNull();
  });

  it('saves the preview when the fetcher returns one', async () => {
    const share = await createShare(
      db,
      author.id,
      { description: 'Grant programme', linkUrl: 'https://example.org/grants' },
      {
        fetchPreview: async () => ({
          title: 'City micro-grants',
          description: 'Funding for urban farms',
          imageUrl: 'https://example.org/cover.png',
        }),
      },
    );

    expect(share.previewTitle).toBe('City micro-grants');
    expect(share.previewDescription).toBe('Funding for urban farms');
    expect(share.previewImageUrl).toBe('https://example.org/cover.png');

    const [row] = await db.select().from(sharesTable);
    expect(row.linkTitle).toBe('City micro-grants');
    expect(row.linkImageUrl).toBe('https://example.org/cover.png');
  });

  it('rejects someone else\'s file', async () => {
    const insertFile = async (ownerId: string) => {
      const [row] = await db
        .insert(filesTable)
        .values({
          name: 'plot.png',
          path: 'data/uploads/some-uuid',
          mimeType: 'image/png',
          size: 12,
          uploadedBy: ownerId,
        })
        .returning();
      return row;
    };

    const foreign = await insertFile(other.id);
    await expect(
      createShare(db, author.id, { description: 'See', fileId: foreign.id }, { fetchPreview: noPreview }),
    ).rejects.toThrow(ShareValidationError);

    const own = await insertFile(author.id);
    const share = await createShare(
      db,
      author.id,
      { description: 'See', fileId: own.id },
      { fetchPreview: noPreview },
    );
    expect(share.fileId).toBe(own.id);
  });
});

describe('deleteShare', () => {
  it('author can delete, others get forbidden', async () => {
    const share = await createShare(db, author.id, { description: 'Mine' }, { fetchPreview: noPreview });

    expect(await deleteShare(db, share.id, other.id)).toBe('forbidden');
    expect(await deleteShare(db, share.id, author.id)).toBe('deleted');

    // Soft delete: the row stays, flagged.
    const [row] = await db.select().from(sharesTable).where(eq(sharesTable.id, share.id));
    expect(row.deletedAt).not.toBeNull();

    // A deleted share is no longer deletable or findable.
    expect(await deleteShare(db, share.id, author.id)).toBe('not-found');
    expect(await listShares(db, { limit: 10 })).toEqual([]);
  });

  it('deleteShare answers not-found for an unknown id', async () => {
    expect(await deleteShare(db, author.id, 'not-a-uuid')).toBe('not-found');
  });
});

describe('listShares', () => {
  it('listShares hides deleted', async () => {
    const first = await createShare(db, author.id, { description: 'First' }, { fetchPreview: noPreview });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await createShare(db, other.id, { description: 'Second' }, { fetchPreview: noPreview });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const third = await createShare(db, author.id, { description: 'Third' }, { fetchPreview: noPreview });

    await deleteShare(db, second.id, other.id);

    const list = await listShares(db, { limit: 10 });
    expect(list.map((s) => s.id)).toEqual([third.id, first.id]);

    // The summary carries the author's name and external id.
    expect(list[0].authorName).toBe('Ana Rodriguez');
    expect(list[0].authorExternalId).toBe('m-ana');
  });

  it('honours the limit', async () => {
    for (const text of ['one', 'two', 'three']) {
      await createShare(db, author.id, { description: text }, { fetchPreview: noPreview });
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const list = await listShares(db, { limit: 2 });
    expect(list.map((s) => s.description)).toEqual(['three', 'two']);
  });

  it('withFile lists only shares that carry a file, beyond the newest text-only posts', async () => {
    const [file] = await db
      .insert(filesTable)
      .values({ name: 'plan.pdf', path: '/tmp/none', mimeType: 'application/pdf', size: 3, uploadedBy: author.id })
      .returning();
    const withFile = await createShare(
      db,
      author.id,
      { description: 'The plan', fileId: file.id },
      { fetchPreview: noPreview },
    );
    for (const text of ['one', 'two']) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await createShare(db, other.id, { description: text }, { fetchPreview: noPreview });
    }

    const list = await listShares(db, { limit: 1, withFile: true });
    expect(list.map((s) => s.id)).toEqual([withFile.id]);
    expect(list[0].fileName).toBe('plan.pdf');
  });
});
