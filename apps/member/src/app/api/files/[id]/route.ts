import { promises as fs } from 'node:fs';
import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '../../../../db/client';
import { getMemberFromCookies } from '../../../../identity/session';
import { files } from '../../../../db/schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound() {
  return new NextResponse(null, { status: 404 });
}

/**
 * Serves a stored upload to signed-in members. The stored MIME type goes out
 * with nosniff, and PDFs are attachments so a mismatched file can never run
 * as a page in the app's origin.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const member = await getMemberFromCookies();
  if (!member) {
    return NextResponse.json({ error: 'Sign in to view files.' }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return notFound();
  }

  const [file] = await getDb().select().from(files).where(eq(files.id, id)).limit(1);
  if (!file) {
    return notFound();
  }

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(file.path);
  } catch {
    return notFound();
  }

  // Only characters that survive the quoting reach the filename.
  const filename = JSON.stringify(file.name.replace(/["\\\r\n]/g, ''));
  const disposition = file.mimeType === 'application/pdf' ? 'attachment' : 'inline';

  return new NextResponse(new Blob([new Uint8Array(bytes)]), {
    status: 200,
    headers: {
      'Content-Type': file.mimeType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `${disposition}; filename=${filename}`,
      // Uploads are immutable per id, so a member's browser may keep its copy.
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
