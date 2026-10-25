import { getDb } from '../../../../../db/client';
import { createDocumentDownloadHandler } from '../../../../../documents/download';
import { getMemberFromCookies } from '../../../../../identity/session';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const handle = createDocumentDownloadHandler({ db: getDb(), getMember: () => getMemberFromCookies() });
  return handle(id);
}
