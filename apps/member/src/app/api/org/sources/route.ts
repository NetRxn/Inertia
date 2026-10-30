import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDb } from '../../../../db/client';
import { getMemberFromCookies } from '../../../../identity/session';
import { addSource, fileToText, htmlToText, IngestError } from '../../../../org/ingest';
import { fetchPublicPage } from '../../../../shares/preview';
import { readShareForm, ShareBodyTooLargeError } from '../../../../shares/form';

const KINDS = ['meeting', 'document', 'note', 'link'] as const;
type Kind = (typeof KINDS)[number];

/**
 * Adds something to what Inertia knows: one or more files, a link, or pasted
 * text. Any signed-in member can add; admins can hide things later.
 */
export async function POST(request: NextRequest) {
  const member = await getMemberFromCookies();
  if (!member) return NextResponse.json({ error: 'Sign in to add things.' }, { status: 401 });

  let form: FormData;
  try {
    form = await readShareForm(request);
  } catch (error) {
    if (error instanceof ShareBodyTooLargeError) return NextResponse.json({ error: 'That is over the 10 MB limit.' }, { status: 413 });
    return NextResponse.json({ error: "Couldn't read that. Try again?" }, { status: 400 });
  }

  const db = getDb();
  const kindValue = form.get('kind');
  const kind: Kind | null = typeof kindValue === 'string' && (KINDS as readonly string[]).includes(kindValue) ? (kindValue as Kind) : null;
  const titleValue = form.get('title');
  const title = typeof titleValue === 'string' ? titleValue.trim() : '';
  const results: { title: string; duplicate: boolean }[] = [];

  try {
    for (const entry of form.getAll('file')) {
      if (!(entry instanceof File) || entry.size === 0) continue;
      const read = fileToText(entry.name, new Uint8Array(await entry.arrayBuffer()));
      const { source, duplicate } = await addSource(db, {
        kind: kind === 'meeting' ? 'meeting' : read.kind,
        title: title && form.getAll('file').length === 1 ? title : read.title,
        origin: entry.name,
        content: read.text,
        addedBy: member.id,
      });
      results.push({ title: source.title, duplicate });
    }

    const link = form.get('link');
    if (typeof link === 'string' && link.trim()) {
      let url: URL;
      try {
        url = new URL(link.trim());
      } catch {
        return NextResponse.json({ error: 'That link is not a web address.' }, { status: 400 });
      }
      const page = await fetchPublicPage(url.toString(), { timeoutMs: 10_000, maxBytes: 1_000_000 });
      if (!page) return NextResponse.json({ error: "Couldn't open that link. Paste the text instead?" }, { status: 422 });
      const read = htmlToText(page.html);
      const { source, duplicate } = await addSource(db, { kind: 'link', title: title || read.title || url.hostname, origin: page.url, content: read.text, addedBy: member.id });
      results.push({ title: source.title, duplicate });
    }

    const text = form.get('text');
    if (typeof text === 'string' && text.trim()) {
      const { source, duplicate } = await addSource(db, { kind: kind === 'meeting' ? 'meeting' : 'note', title: title || text.trim().split('\n')[0].slice(0, 80), content: text, addedBy: member.id });
      results.push({ title: source.title, duplicate });
    }
  } catch (error) {
    if (error instanceof IngestError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  if (!results.length) return NextResponse.json({ error: 'Add a file, a link or some text.' }, { status: 400 });
  for (const path of ['/', '/org', '/org/data']) revalidatePath(path);
  return NextResponse.json({ added: results });
}
