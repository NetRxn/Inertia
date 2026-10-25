import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDb } from '../../../db/client';
import { getMemberFromCookies } from '../../../identity/session';
import { createShare, deleteShare, ShareValidationError, type LinkPreview, type ShareKind } from '../../../shares/shares';
import { fetchLinkPreview } from '../../../shares/preview';
import { deleteUpload, saveUpload, MAX_UPLOAD_BYTES } from '../../../shares/files';
import { readShareForm, ShareBodyTooLargeError } from '../../../shares/form';

const KINDS: ShareKind[] = ['idea', 'resource', 'event', 'update'];

function isShareKind(value: FormDataEntryValue | null): value is ShareKind {
  return typeof value === 'string' && KINDS.includes(value as ShareKind);
}

const noPreview = async (): Promise<LinkPreview | null> => null;

/**
 * The preview fetcher for the share route. R25: MEMBER_APP_LINK_PREVIEWS=off
 * keeps e2e runs off the network.
 */
function previewFetcher(): (url: string) => Promise<LinkPreview | null> {
  if (process.env.MEMBER_APP_LINK_PREVIEWS === 'off') {
    return noPreview;
  }
  return (url) => fetchLinkPreview(url);
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const member = await getMemberFromCookies();
  if (!member) {
    return NextResponse.json({ error: 'Sign in to share.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await readShareForm(request);
  } catch (error) {
    if (error instanceof ShareBodyTooLargeError) {
      return NextResponse.json({ error: 'That post is too large. Try a smaller file or less text?' }, { status: 413 });
    }
    return badRequest('We could not read that post. Try again?');
  }

  const kind = form.get('kind');
  const description = form.get('description');
  const link = form.get('link');
  const file = form.get('file');

  if (!isShareKind(kind)) {
    return badRequest('Pick a share type: idea, resource, event or update.');
  }
  if (description != null && typeof description !== 'string') {
    return badRequest('We could not read that post. Try again?');
  }
  if (link != null && typeof link !== 'string') {
    return badRequest('We could not read that post. Try again?');
  }

  const db = getDb();

  // Save the file first so createShare can point at it; if the share then
  // fails validation, the orphan upload is removed again.
  let fileId: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return badRequest('That file is over the 10 MB limit. Try a smaller one?');
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      fileId = (await saveUpload(db, member.id, { name: file.name, type: file.type, bytes })).id;
    } catch (error) {
      if (error instanceof ShareValidationError) return badRequest(error.message);
      throw error;
    }
  }

  try {
    const share = await createShare(
      db,
      member.id,
      {
        kind,
        description: description ?? '',
        linkUrl: link?.trim() || undefined,
        fileId,
      },
      { fetchPreview: previewFetcher() },
    );
    revalidatePath('/work');
    revalidatePath('/');
    return NextResponse.json({ share }, { status: 201 });
  } catch (error) {
    if (error instanceof ShareValidationError) {
      if (fileId) {
        await deleteUpload(db, fileId).catch(() => {
          // Best effort; an unreferenced upload is only clutter.
        });
      }
      return badRequest(error.message);
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  const member = await getMemberFromCookies();
  if (!member) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return badRequest('Which post?');
  }

  const result = await deleteShare(getDb(), id, member.id);
  if (result === 'not-found') {
    return NextResponse.json({ error: 'That post is gone already.' }, { status: 404 });
  }
  if (result === 'forbidden') {
    return NextResponse.json({ error: 'You can only delete your own posts.' }, { status: 403 });
  }
  revalidatePath('/work');
  revalidatePath('/');
  return NextResponse.json({ ok: true });
}
