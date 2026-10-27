import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const boundary = vi.hoisted(() => ({ addSource: vi.fn(), getDb: vi.fn() }));
vi.mock('../src/db/client', () => ({ getDb: boundary.getDb }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../src/org/ingest', async (importOriginal) => ({ ...(await importOriginal<typeof import('../src/org/ingest')>()), addSource: boundary.addSource }));

import { POST } from '../src/app/api/org/ingest/route';

const request = (body: unknown, token?: string) =>
  new NextRequest('http://fixture.test/api/org/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MEMBER_APP_INGEST_TOKEN', 'secret-token');
  boundary.addSource.mockResolvedValue({ source: { id: 'src-1' }, duplicate: false });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('integration ingest endpoint', () => {
  it('refuses without the right token, or when no token is configured', async () => {
    expect((await POST(request({ kind: 'note', title: 't', text: 'x' }))).status).toBe(401);
    expect((await POST(request({ kind: 'note', title: 't', text: 'x' }, 'wrong')))).toMatchObject({ status: 401 });
    vi.stubEnv('MEMBER_APP_INGEST_TOKEN', '');
    expect((await POST(request({ kind: 'note', title: 't', text: 'x' }, '')))).toMatchObject({ status: 401 });
    expect(boundary.addSource).not.toHaveBeenCalled();
  });

  it('adds a chat digest as a source', async () => {
    const response = await POST(request({ kind: 'chat-export', title: 'Telegram: FWTX DAO, Oct 27', text: '[12:30] Rob: I can host', origin: 'telegram:-100123' }, 'secret-token'));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'src-1', duplicate: false });
    expect(boundary.addSource).toHaveBeenCalledWith(undefined, { kind: 'chat-export', title: 'Telegram: FWTX DAO, Oct 27', content: '[12:30] Rob: I can host', origin: 'telegram:-100123' });
  });

  it('rejects bad shapes and oversized bodies', async () => {
    expect((await POST(request('not json', 'secret-token'))).status).toBe(400);
    expect((await POST(request({ kind: 'sermon', title: 't', text: 'x' }, 'secret-token'))).status).toBe(400);
    expect((await POST(request({ kind: 'note', title: 't', text: 'x'.repeat(1024 * 1024 + 10) }, 'secret-token'))).status).toBe(413);
  });
});
