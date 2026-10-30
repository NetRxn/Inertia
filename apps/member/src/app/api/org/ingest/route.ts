import { timingSafeEqual } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDb } from '../../../../db/client';
import { addSource, IngestError } from '../../../../org/ingest';

const MAX_BODY_BYTES = 1024 * 1024;
const KINDS = ['chat-export', 'meeting', 'note', 'document', 'link'] as const;

function authorized(request: NextRequest, token: string | undefined): boolean {
  if (!token) return false;
  const given = Buffer.from((request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Lets an integration (a Telegram bot, a webhook, a script) add something to
 * what Inertia knows. It needs MEMBER_APP_INGEST_TOKEN as a bearer token and
 * sends JSON: { kind, title, text, origin? }. Batch chat into digests, e.g. one
 * per chat per day, rather than one call per message.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request, process.env.MEMBER_APP_INGEST_TOKEN?.trim() || undefined)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Too large.' }, { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Too large.' }, { status: 413 });

  let body: { kind?: unknown; title?: unknown; text?: unknown; origin?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Send JSON: { kind, title, text, origin }.' }, { status: 400 });
  }
  const kind = KINDS.find((k) => k === body.kind);
  if (!kind || typeof body.title !== 'string' || typeof body.text !== 'string') {
    return NextResponse.json({ error: `Send JSON: { kind (${KINDS.join(', ')}), title, text, origin }.` }, { status: 400 });
  }
  try {
    const { source, duplicate } = await addSource(getDb(), {
      kind,
      title: body.title,
      content: body.text,
      origin: typeof body.origin === 'string' ? body.origin : null,
    });
    revalidatePath('/org');
    return NextResponse.json({ id: source.id, duplicate }, { status: duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof IngestError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
