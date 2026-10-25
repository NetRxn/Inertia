import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { files, members, shares } from '../db/schema';
import type { ShareSummary } from '../feed/build-feed';
import type { LinkPreview } from './preview';

export type { LinkPreview };

export type ShareKind = 'idea' | 'resource' | 'event' | 'update';

/** A member-readable reason a share was refused. */
export class ShareValidationError extends Error {}

const KINDS: ShareKind[] = ['idea', 'resource', 'event', 'update'];
const DESCRIPTION_MAX = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CreateShareInput = {
  kind?: ShareKind;
  description?: string;
  linkUrl?: string;
  fileId?: string;
};

export type CreateShareDeps = {
  fetchPreview: (url: string) => Promise<LinkPreview | null>;
};

function isHttpUrl(link: string): boolean {
  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Saves one member's post. A share needs something in it — words, a link or a
 * file — and the link must be http(s). The link preview is best effort: a null
 * preview (or a fetcher that throws) still saves.
 */
export async function createShare(
  db: Db,
  authorId: string,
  input: CreateShareInput,
  deps: CreateShareDeps,
): Promise<ShareSummary> {
  const description = (input.description ?? '').trim();
  const linkUrl = input.linkUrl?.trim() ?? '';
  const kind = input.kind ?? 'idea';

  if (!KINDS.includes(kind)) {
    throw new ShareValidationError('Pick a share type: idea, resource, event or update.');
  }
  if (description.length > DESCRIPTION_MAX) {
    throw new ShareValidationError('Descriptions max out at 2000 characters. Trim it a little?');
  }
  if (!description && !linkUrl && !input.fileId) {
    throw new ShareValidationError('Write something, add a link, or attach a file.');
  }
  if (linkUrl && !isHttpUrl(linkUrl)) {
    throw new ShareValidationError('Links need to start with http:// or https://.');
  }

  if (input.fileId) {
    const [file] = await db.select().from(files).where(eq(files.id, input.fileId)).limit(1);
    if (!file || file.uploadedBy !== authorId) {
      throw new ShareValidationError("That file isn't yours to share.");
    }
  }

  let preview: LinkPreview | null = null;
  if (linkUrl) {
    try {
      preview = await deps.fetchPreview(linkUrl);
    } catch {
      preview = null;
    }
  }

  const [row] = await db
    .insert(shares)
    .values({
      memberId: authorId,
      kind,
      description,
      linkUrl: linkUrl || null,
      linkTitle: preview?.title ?? null,
      linkDescription: preview?.description ?? null,
      linkImageUrl: preview?.imageUrl ?? null,
      fileId: input.fileId ?? null,
    })
    .returning();

  const [author] = await db
    .select({ displayName: members.displayName, externalId: members.externalId })
    .from(members)
    .where(eq(members.id, authorId))
    .limit(1);
  if (!author) {
    throw new Error('createShare: author disappeared after insert');
  }

  return {
    id: row.id,
    kind: row.kind,
    description: row.description,
    linkUrl: row.linkUrl,
    previewTitle: row.linkTitle,
    authorName: author.displayName,
    createdAt: row.createdAt.toISOString(),
    authorExternalId: author.externalId,
    previewDescription: row.linkDescription,
    previewImageUrl: row.linkImageUrl,
    fileId: row.fileId,
  };
}

/** Lists shares newest first, leaving deleted ones out. */
export async function listShares(db: Db, opts: { limit: number }): Promise<ShareSummary[]> {
  const rows = await db
    .select({
      id: shares.id,
      kind: shares.kind,
      description: shares.description,
      linkUrl: shares.linkUrl,
      linkTitle: shares.linkTitle,
      linkDescription: shares.linkDescription,
      linkImageUrl: shares.linkImageUrl,
      fileId: shares.fileId,
      fileName: files.name,
      createdAt: shares.createdAt,
      authorName: members.displayName,
      authorExternalId: members.externalId,
    })
    .from(shares)
    .innerJoin(members, eq(shares.memberId, members.id))
    .leftJoin(files, eq(shares.fileId, files.id))
    .where(isNull(shares.deletedAt))
    .orderBy(desc(shares.createdAt))
    .limit(opts.limit);

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    description: row.description,
    linkUrl: row.linkUrl,
    previewTitle: row.linkTitle,
    authorName: row.authorName,
    createdAt: row.createdAt.toISOString(),
    authorExternalId: row.authorExternalId,
    previewDescription: row.linkDescription,
    previewImageUrl: row.linkImageUrl,
    fileId: row.fileId,
    fileName: row.fileName ?? null,
  }));
}

/**
 * Soft-deletes a share. Only its author may delete it; a share that is gone
 * (or never was) answers 'not-found' rather than leaking its existence.
 */
export async function deleteShare(
  db: Db,
  shareId: string,
  memberId: string,
): Promise<'deleted' | 'not-found' | 'forbidden'> {
  if (!UUID.test(shareId)) return 'not-found';
  const [share] = await db
    .select()
    .from(shares)
    .where(and(eq(shares.id, shareId), isNull(shares.deletedAt)))
    .limit(1);
  if (!share) return 'not-found';
  if (share.memberId !== memberId) return 'forbidden';
  await db.update(shares).set({ deletedAt: new Date() }).where(eq(shares.id, shareId));
  return 'deleted';
}
