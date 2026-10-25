import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { members, files as filesTable } from '../src/db/schema';
import { saveUpload } from '../src/shares/files';
import { ShareValidationError } from '../src/shares/shares';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
const UTF8 = new TextEncoder();

let storageDir: string;
let ownerId: string;
let db: Db;

// One database for the whole file (migrations are the expensive part); the
// files table is emptied between tests so each test starts clean.
beforeAll(async () => {
  db = (await createTestDb()) as Db;
  const [member] = await db
    .insert(members)
    .values({ externalId: 'm-ana', email: 'ana@example.org', displayName: 'Ana Rodriguez' })
    .returning();
  ownerId = member.id;
});

beforeEach(async () => {
  await db.delete(filesTable);
  storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'member-uploads-'));
});

afterEach(async () => {
  await fs.rm(storageDir, { recursive: true, force: true });
});

describe('saveUpload', () => {
  it('accepts a PNG', async () => {
    const { id } = await saveUpload(
      db,
      ownerId,
      { name: 'plot.png', type: 'image/png', bytes: PNG_BYTES },
      storageDir,
    );

    const [row] = await db.select().from(filesTable);
    expect(row.id).toBe(id);
    expect(row.name).toBe('plot.png');
    expect(row.mimeType).toBe('image/png');
    expect(row.size).toBe(PNG_BYTES.length);
    expect(row.uploadedBy).toBe(ownerId);

    // The bytes on disk are exactly what was uploaded.
    const onDisk = new Uint8Array(await fs.readFile(row.path));
    expect(Array.from(onDisk)).toEqual(Array.from(PNG_BYTES));
  });

  it('accepts a PDF and a JPEG', async () => {
    await saveUpload(
      db,
      ownerId,
      { name: 'policy.pdf', type: 'application/pdf', bytes: UTF8.encode('%PDF-1.7 stub') },
      storageDir,
    );
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    await saveUpload(db, ownerId, { name: 'photo.jpg', type: 'image/jpeg', bytes: jpeg }, storageDir);
    expect(await db.select().from(filesTable)).toHaveLength(2);
  });

  it('rejects SVG', async () => {
    await expect(
      saveUpload(
        db,
        ownerId,
        { name: 'logo.svg', type: 'image/svg+xml', bytes: UTF8.encode('<svg xmlns="http://www.w3.org/2000/svg"/>') },
        storageDir,
      ),
    ).rejects.toThrow(ShareValidationError);
    expect(await db.select().from(filesTable)).toHaveLength(0);
  });

  it('rejects HTML renamed to .png (magic-byte mismatch)', async () => {
    await expect(
      saveUpload(
        db,
        ownerId,
        { name: 'evil.png', type: 'image/png', bytes: UTF8.encode('<html><body>hi</body></html>') },
        storageDir,
      ),
    ).rejects.toThrow(/PNG/i);
    expect(await db.select().from(filesTable)).toHaveLength(0);
  });

  it('rejects 10 MB + 1 byte', async () => {
    const bytes = new Uint8Array(10 * 1024 * 1024 + 1);
    bytes.set(PNG_BYTES.subarray(0, 8));
    await expect(
      saveUpload(db, ownerId, { name: 'big.png', type: 'image/png', bytes }, storageDir),
    ).rejects.toThrow(/10 MB/i);
    expect(await db.select().from(filesTable)).toHaveLength(0);

    // Exactly 10 MB is fine.
    const exact = new Uint8Array(10 * 1024 * 1024);
    exact.set(PNG_BYTES.subarray(0, 8));
    await saveUpload(db, ownerId, { name: 'exact.png', type: 'image/png', bytes: exact }, storageDir);
    expect(await db.select().from(filesTable)).toHaveLength(1);
  });

  it('storage key never contains the original name', async () => {
    const { id } = await saveUpload(
      db,
      ownerId,
      { name: '../../travel photos (final).png', type: 'image/png', bytes: PNG_BYTES },
      storageDir,
    );
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const [row] = await db.select().from(filesTable);
    expect(row.path).not.toContain('travel');
    expect(row.path.startsWith(storageDir)).toBe(true);
    expect(row.path.slice(storageDir.length + 1)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // The directory holds exactly one file: the random key.
    const stored = await fs.readdir(storageDir);
    expect(stored).toEqual([row.path.slice(storageDir.length + 1)]);
  });
});
