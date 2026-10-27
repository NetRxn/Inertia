import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { files } from '../db/schema';
import { ShareValidationError } from './shares';

/** Uploads stop at 10 MB. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Uploads land here, under a random UUID key, when the caller says otherwise. */
export const DEFAULT_STORAGE_DIR = 'data/uploads';

const ascii = (text: string) => Array.from(text, (ch) => ch.charCodeAt(0));

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Allowed types, with the magic bytes each one must actually carry. */
const ALLOWED_TYPES: Record<string, { label: string; matches: (bytes: Uint8Array) => boolean }> = {
  'image/png': { label: 'PNG', matches: (b) => startsWith(b, PNG_SIGNATURE) },
  'image/jpeg': { label: 'JPEG', matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  'image/webp': {
    label: 'WebP',
    matches: (b) => startsWith(b, ascii('RIFF')) && startsWith(b.subarray(8), ascii('WEBP')),
  },
  'image/gif': {
    label: 'GIF',
    matches: (b) => startsWith(b, ascii('GIF87a')) || startsWith(b, ascii('GIF89a')),
  },
  'application/pdf': { label: 'PDF', matches: (b) => startsWith(b, ascii('%PDF-')) },
};

/**
 * Saves an uploaded file under a fresh UUID key (the original name is metadata
 * only) and records it in the files table, owned by the uploader.
 * Throws ShareValidationError with a member-readable message on rejection.
 */
export async function saveUpload(
  db: Db,
  ownerId: string,
  file: { name: string; type: string; bytes: Uint8Array },
  storageDir: string = DEFAULT_STORAGE_DIR,
): Promise<{ id: string }> {
  const allowed = ALLOWED_TYPES[file.type];
  if (!allowed) {
    throw new ShareValidationError('We take PNG, JPEG, WebP, GIF and PDF files only.');
  }
  if (file.bytes.length > MAX_UPLOAD_BYTES) {
    throw new ShareValidationError('That file is over the 10 MB limit. Try a smaller one?');
  }
  if (!allowed.matches(file.bytes)) {
    throw new ShareValidationError(`That file does not look like a ${allowed.label} file.`);
  }

  const key = randomUUID();
  // Upload paths are caller-supplied (tests pass a temp dir), so this join is
  // deliberately dynamic; the ignore keeps Turbopack from tracing the repo.
  const destination = path.join(/*turbopackIgnore: true*/ storageDir, key);
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(destination, file.bytes);

  const [row] = await db
    .insert(files)
    .values({
      name: file.name,
      path: destination,
      mimeType: file.type,
      size: file.bytes.length,
      uploadedBy: ownerId,
    })
    .returning();
  return { id: row.id };
}

/** Removes an upload's row and bytes; used when a share fails validation after saving. */
export async function deleteUpload(db: Db, fileId: string): Promise<void> {
  const [row] = await db
    .select({ path: files.path })
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);
  if (!row) return;
  await db.delete(files).where(eq(files.id, fileId));
  await fs.unlink(row.path).catch(() => {
    // The bytes may already be gone; the row is what matters.
  });
}

/**
 * A Content-Disposition value for an upload's original name. Header values
 * must be Latin-1, so the full name rides as RFC 5987 `filename*` (UTF-8,
 * percent-encoded) beside a printable-ASCII `filename` fallback.
 */
export function contentDisposition(type: 'inline' | 'attachment', name: string): string {
  let fallback = name.replace(/[^\x20-\x7e]|["\\]/g, '').trim();
  const extension = /\.[A-Za-z0-9]+$/.exec(fallback)?.[0] ?? '';
  if (!fallback.slice(0, fallback.length - extension.length).trim()) fallback = `file${extension}`;
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
