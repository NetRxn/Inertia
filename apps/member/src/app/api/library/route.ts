import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDb } from '../../../db/client';
import { getMemberFromCookies } from '../../../identity/session';
import { addLibraryDocument, canEditLibrary, LibraryError, type LibraryCategory } from '../../../documents/library';
import { deleteUpload, saveUpload, MAX_UPLOAD_BYTES } from '../../../shares/files';
import { readShareForm, ShareBodyTooLargeError } from '../../../shares/form';
import { ShareValidationError } from '../../../shares/shares';

const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '');

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Adds a key document to the library: an uploaded PDF or image, or a link. Editors only. */
export async function POST(request: NextRequest) {
  const member = await getMemberFromCookies();
  if (!member) return NextResponse.json({ error: 'Sign in to add documents.' }, { status: 401 });
  if (!(await canEditLibrary(getDb(), member))) return NextResponse.json({ error: 'Only admins can change the library.' }, { status: 403 });

  let form: FormData;
  try {
    form = await readShareForm(request);
  } catch (error) {
    if (error instanceof ShareBodyTooLargeError) return NextResponse.json({ error: 'That file is over the 10 MB limit.' }, { status: 413 });
    return badRequest('We could not read that. Try again?');
  }

  const db = getDb();
  const file = form.get('file');
  const input = {
    title: text(form.get('title')),
    description: text(form.get('description')),
    category: text(form.get('category')) as LibraryCategory,
    linkUrl: text(form.get('link')) || null,
  };

  let fileId: string | null = null;
  try {
    if (file instanceof File && file.size > 0) {
      if (input.linkUrl) return badRequest('Add a file or a link, not both.');
      if (file.size > MAX_UPLOAD_BYTES) return badRequest('That file is over the 10 MB limit.');
      fileId = (await saveUpload(db, member.id, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) })).id;
    }
    const document = await addLibraryDocument(db, member, { ...input, fileId });
    revalidatePath('/org');
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    if (fileId) await deleteUpload(db, fileId).catch(() => undefined);
    if (error instanceof LibraryError) return NextResponse.json({ error: error.message }, { status: error.message.startsWith('Only admins') ? 403 : 400 });
    if (error instanceof ShareValidationError) return badRequest(error.message);
    throw error;
  }
}
