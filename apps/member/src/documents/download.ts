import type { Db } from '../db/client';
import type { Member } from '../identity/session';
import { getDocument } from './documents';

const SLUG_MAX = 80;

/**
 * "<slug>.md" from a document's title: lowercase ASCII letters, digits and
 * single hyphens only, so the name can never carry a path separator or "..".
 */
export function documentFilename(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX)
    .replace(/^-+|-+$/g, '');
  return `${slug || 'document'}.md`;
}

export type DocumentDownloadDeps = {
  db: Db;
  getMember: () => Promise<Member | null>;
};

/** Serves one of the member's own drafts as a Markdown attachment; anyone else's is a 404. */
export function createDocumentDownloadHandler(deps: DocumentDownloadDeps) {
  return async (id: string): Promise<Response> => {
    const member = await deps.getMember();
    if (!member) {
      return Response.json({ error: 'Sign in to download documents.' }, { status: 401 });
    }

    const doc = await getDocument(deps.db, member.id, id);
    if (!doc) {
      return new Response(null, { status: 404 });
    }

    return new Response(doc.content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${documentFilename(doc.title)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  };
}
