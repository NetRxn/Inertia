import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const boundary = vi.hoisted(() => ({
  getMember: vi.fn(), saveUpload: vi.fn(), createShare: vi.fn(), getDb: vi.fn(),
}));
vi.mock('../src/identity/session', () => ({ getMemberFromCookies: boundary.getMember }));
vi.mock('../src/db/client', () => ({ getDb: boundary.getDb }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../src/shares/files', async importOriginal => ({
  ...await importOriginal<typeof import('../src/shares/files')>(),
  saveUpload: boundary.saveUpload,
}));
vi.mock('../src/shares/shares', async importOriginal => ({
  ...await importOriginal<typeof import('../src/shares/shares')>(),
  createShare: boundary.createShare,
}));

import { POST } from '../src/app/api/shares/route';
import { readShareForm } from '../src/shares/form';

const FILE_LIMIT = 10 * 1024 * 1024;
const BODY_LIMIT = FILE_LIMIT + 64 * 1024;

beforeEach(() => {
  vi.clearAllMocks();
  boundary.getMember.mockResolvedValue({ id: 'fixture-member' });
  boundary.saveUpload.mockResolvedValue({ id: 'fixture-file' });
  boundary.createShare.mockImplementation(async (_db, _member, share) => ({ id: 'fixture-share', ...share }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function formRequest(fileBytes: number): NextRequest {
  const form = new FormData();
  form.set('kind', 'resource');
  form.set('description', 'Fixture upload');
  const data = new Uint8Array(fileBytes);
  data.set(new TextEncoder().encode('%PDF-'));
  form.set('file', new File([data], 'fixture.pdf', { type: 'application/pdf' }));
  return new NextRequest('http://fixture.test/api/shares', { method: 'POST', body: form });
}

describe('share upload request boundary', () => {
  it.each([undefined, '1'])('rejects a chunked oversized body with Content-Length %s before exhausting it', async contentLength => {
    let pulls = 0;
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        if (pulls > 40) controller.close();
        else controller.enqueue(new Uint8Array(1024 * 1024));
      },
      cancel() { canceled = true; },
    }, { highWaterMark: 0 });
    const request = new NextRequest('http://fixture.test/api/shares', {
      method: 'POST', body: stream, duplex: 'half',
      headers: { 'content-type': 'multipart/form-data; boundary=fixture', ...(contentLength ? { 'content-length': contentLength } : {}) },
    });
    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(pulls).toBeLessThanOrEqual(11);
    expect(canceled).toBe(true);
    expect(boundary.saveUpload).not.toHaveBeenCalled();
    expect(boundary.createShare).not.toHaveBeenCalled();
  });

  it('refuses declared excess before reading or parsing the body', async () => {
    const request = new NextRequest('http://fixture.test/api/shares', {
      method: 'POST', body: 'fixture',
      headers: { 'content-type': 'multipart/form-data; boundary=fixture', 'content-length': String(BODY_LIMIT + 1) },
    });
    const parse = vi.spyOn(request, 'formData');
    expect((await POST(request)).status).toBe(413);
    expect(parse).not.toHaveBeenCalled();
  });

  it('rejects a file over 10 MiB before file.arrayBuffer or storage', async () => {
    const request = formRequest(FILE_LIMIT + 1);
    const allocated: number[] = [];
    const original = File.prototype.arrayBuffer;
    vi.spyOn(File.prototype, 'arrayBuffer').mockImplementation(function (this: File) {
      allocated.push(this.size);
      return original.call(this);
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'That file is over the 10 MB limit. Try a smaller one?' });
    expect(allocated).not.toContain(FILE_LIMIT + 1);
    expect(boundary.saveUpload).not.toHaveBeenCalled();
  });

  it('accepts a file exactly at 10 MiB including multipart overhead', async () => {
    const response = await POST(formRequest(FILE_LIMIT));
    expect(response.status).toBe(201);
    expect((await response.json()).share.fileId).toBe('fixture-file');
    expect(boundary.saveUpload.mock.calls[0][2].bytes.byteLength).toBe(FILE_LIMIT);
  });

  it('returns a normal bad request for malformed multipart without storage', async () => {
    const request = new NextRequest('http://fixture.test/api/shares', {
      method: 'POST', body: '--fixture\r\nbroken',
      headers: { 'content-type': 'multipart/form-data; boundary=fixture' },
    });
    expect((await POST(request)).status).toBe(400);
    expect(boundary.saveUpload).not.toHaveBeenCalled();
  });

  it('bounds retained parser parts for one-byte and empty incoming chunks', async () => {
    const retainedParts: number[] = [];
    const NativeBlob = Blob;
    vi.stubGlobal('Blob', class extends NativeBlob {
      constructor(parts: BlobPart[] = [], options?: BlobPropertyBag) {
        retainedParts.push(parts.length);
        super(parts, options);
      }
    });
    const text = 'x'.repeat(16 * 1024);
    const input = new TextEncoder().encode(`description=${text}`);
    let offset = 0;
    let empty = true;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset === input.length) { controller.close(); return; }
        if (empty) controller.enqueue(new Uint8Array());
        else controller.enqueue(input.subarray(offset, ++offset));
        empty = !empty;
      },
    }, { highWaterMark: 0 });
    const request = new NextRequest('http://fixture.test/api/shares', {
      method: 'POST', body, duplex: 'half',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect((await readShareForm(request)).get('description')).toBe(text);
    expect(retainedParts).toEqual([1]);
  });
});
