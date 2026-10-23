import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prepare, type Source } from '../../src/roundtable/ingestion.js';
import * as website from '../../src/roundtable/website.js';

const binding = { origin: 'https://dao.example', principalId: 'synthetic-integration' };
const meeting = { title: 'Synthetic Roundtable', date: '2026-10-23', attendees: null, agenda: null, tags: [] };
const source: Source = { meetingId: 'synthetic-meeting', sourceId: 'synthetic-source', revision: '1', ready: true, kind: 'transcript', audience: 'members', text: 'Speaker: We did not approve.\r\nSpeaker: Prépare “budget” \\ draft.' };
const transform = async ({ transcript }: { transcript: string }) => ({ notes: [{ text: transcript.split('\n')[0], line: 1 }], decisions: [], actions: [{ text: transcript.split('\n')[1], line: 2, owner: null }] });
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
async function operation() { return website.prepareWebsiteOperation(await prepare(source, transform), meeting, binding); }
function receipt(record: website.WebsiteOperation, current = true) {
  const envelope = JSON.parse(record.body);
  return { state: 'present', publicationId: 'p_synthetic', meetingNoteId: 'm_synthetic', operationId: envelope.publication.operationId,
    outputHash: envelope.publication.outputHash, requestBodyHash: record.bodyHash, audience: 'members', current,
    currentOutputHash: current ? envelope.publication.outputHash : 'f'.repeat(64),
    readbackPath: '/api/integrations/v1/roundtables/operations/' + envelope.publication.operationId, envelope };
}
function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
const absent = () => json({ code: 'operation_absent' }, 404);
function present(record: website.WebsiteOperation, current = true) {
  const value = receipt(record, current);
  return json(value, 200, { ETag: '"' + value.outputHash + '"' });
}
function harness(responses: Array<Response | Error>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let now = 1_000;
  const client = website.createWebsitePublisher({ ...binding, token: 'synthetic-token', clock: () => now, random: () => 0.5,
    fetch: (async (url, init) => {
      calls.push({ url: String(url), init: init! });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      if (!response) throw Error('Unexpected fixture request');
      return response;
    }) as typeof fetch });
  return { client, calls, setNow: (value: number) => { now = value; } };
}

describe('website exact-byte operation preparation', () => {
  it('exposes the proposed-contract preparation and transport seam', () => {
    expect(website.prepareWebsiteOperation).toBeTypeOf('function');
    expect(website.createWebsitePublisher).toBeTypeOf('function');
  });
  it('binds metadata and source to a serializable byte record without raw originals or credentials', async () => {
    const record = await operation();
    const value = JSON.parse(record.body);
    expect(value).toEqual({ contractVersion: 'roundtable-publication-v1', meeting, publication: expect.objectContaining({ audience: 'members' }) });
    expect(value.publication).not.toHaveProperty('raw');
    expect(record.body).not.toContain('synthetic-token');
    expect(record.bodyHash).toBe(sha(record.body));
    expect(record).toEqual(JSON.parse(JSON.stringify(record)));
    expect(Object.isFrozen(record)).toBe(true);
  });
  it('snapshots metadata and preserves the exact body after caller-owned persistence/restart', async () => {
    const input = { ...meeting, tags: ['original'] };
    const record = website.prepareWebsiteOperation(await prepare(source, transform), input, binding);
    input.tags.push('mutated');
    const restored = JSON.parse(JSON.stringify(record));
    const h = harness([absent(), json({}, 201), present(record)]);
    expect((await h.client.publish(restored)).state).toBe('published');
    expect(h.calls[1]?.init.body).toBe(record.body);
    expect(JSON.parse(record.body).meeting.tags).toEqual(['original']);
  });
  it.each(['2026-02-30', '2026-1-01', '', '2026-10-23T00:00:00Z'])('rejects invalid meeting date %s rather than guessing', async date => {
    const awaited = await prepare(source, transform);
    expect(() => website.prepareWebsiteOperation(awaited, { ...meeting, date }, binding)).toThrow();
  });
  it('rejects nonmember audience, original mismatch and forged evidence before I/O', async () => {
    const p = await prepare(source, transform);
    for (const bad of [{ ...p, audience: 'public' }, { ...p, raw: p.raw + 'changed' }, { ...p, notes: { ...p.notes, verifiedBy: 'machine' } }]) {
      expect(() => website.prepareWebsiteOperation(bad, meeting, binding)).toThrow();
    }
  });
  it('rejects metadata-only corrections explicitly, keeping extractive-v1 hashes unchanged', async () => {
    const first = await operation();
    const prior = JSON.parse(first.body).publication;
    const p = await prepare(source, transform, prior.outputHash);
    expect(() => website.prepareWebsiteOperation(p, { ...meeting, title: 'Renamed' }, binding, first)).toThrow('metadata_only_correction_unsupported');
  });
  it('requires a bound previous operation for corrections and exact CAS parent', async () => {
    const first = await operation();
    const p = await prepare({ ...source, revision: '2', text: source.text + '\nCorrection.' }, transform, JSON.parse(first.body).publication.outputHash);
    expect(() => website.prepareWebsiteOperation(p, meeting, binding)).toThrow('previous_operation_required');
    expect(() => website.prepareWebsiteOperation({ ...p, expectedPreviousOutputHash: 'a'.repeat(64) }, meeting, binding, first)).toThrow();
    expect(website.prepareWebsiteOperation(p, meeting, binding, first).operationId).not.toBe(first.operationId);
  });
  it.each(['http://dao.example', 'https://secret@dao.example', 'https://dao.example/x', 'https://dao.example/?q=x'])('rejects unsafe origin %s', async origin => {
    const p = await prepare(source, transform);
    expect(() => website.prepareWebsiteOperation(p, meeting, { ...binding, origin })).toThrow();
  });
});

describe('website publication reconciliation', () => {
  it('looks up before sending and requires full readback after the write', async () => {
    const record = await operation();
    const h = harness([absent(), json({}, 201), present(record)]);
    expect(await h.client.publish(record)).toMatchObject({ state: 'published', receipt: { current: true } });
    expect(h.calls.map(c => c.init.method)).toEqual(['GET', 'POST', 'GET']);
    expect(h.calls[1]).toMatchObject({ url: binding.origin + '/api/integrations/v1/roundtables/publications', init: {
      redirect: 'error', body: record.body, headers: { Authorization: 'Bearer synthetic-token', 'Idempotency-Key': record.operationId, 'If-None-Match': '*', 'Content-Type': 'application/json; charset=utf-8' } } });
    expect(h.calls.every(c => c.init.signal && c.init.cache === 'no-store')).toBe(true);
  });
  it('replays an older immutable receipt without rolling current state backward', async () => {
    const record = await operation(); const h = harness([present(record, false)]);
    expect(await h.client.publish(record)).toMatchObject({ state: 'already-published', receipt: { current: false } });
    expect(h.calls).toHaveLength(1);
  });
  it.each([new Error('lost response'), json({}, 503)])('recovers ambiguous commit only through full receipt', async failure => {
    const record = await operation(); const h = harness([absent(), failure, present(record)]);
    expect((await h.client.publish(record)).state).toBe('published');
    expect(h.calls.filter(c => c.init.method === 'POST')).toHaveLength(1);
  });
  it('keeps unknown readback pending and retries identical persisted bytes only after authoritative absence', async () => {
    const record = await operation(); const h = harness([absent(), json({}, 503), json({}, 503), absent(), json({}, 201), present(record)]);
    expect((await h.client.publish(record)).state).toBe('pending');
    expect((await h.client.publish(JSON.parse(JSON.stringify(record)))).state).toBe('published');
    expect(h.calls.filter(c => c.init.method === 'POST').map(c => c.init.body)).toEqual([record.body, record.body]);
  });
  it.each([json({}, 404), json({}, 503), new Error('timeout'), json({}, 200), json({}, 302)])('never treats unproven absence as permission to write', async response => {
    const record = await operation(); const h = harness([response]);
    expect((await h.client.publish(record)).state).toBe('pending'); expect(h.calls).toHaveLength(1);
  });
  it.each(['bodyHash', 'metadata', 'transcript', 'audience', 'operationId', 'current', 'etag', 'envelopeExtra'])('rejects mismatched full readback: %s', async mutation => {
    const record = await operation(); const value = receipt(record); let etag = '"' + value.outputHash + '"';
    if (mutation === 'bodyHash') value.requestBodyHash = 'a'.repeat(64);
    if (mutation === 'metadata') value.envelope.meeting.title = 'Different';
    if (mutation === 'transcript') value.envelope.publication.transcript += 'Changed';
    if (mutation === 'audience') value.envelope.publication.audience = 'public';
    if (mutation === 'operationId') value.operationId = 'a'.repeat(64);
    if (mutation === 'current') value.currentOutputHash = 'a'.repeat(64);
    if (mutation === 'etag') etag = '"wrong"';
    if (mutation === 'envelopeExtra') value.envelope.publication.verifiedBy = 'machine';
    const h = harness([json(value, 200, { ETag: etag })]);
    expect((await h.client.publish(record)).state).toBe('conflict'); expect(h.calls).toHaveLength(1);
  });
  it.each([401, 403])('pauses on auth %s, including subsequent operations', async status => {
    const record = await operation(); const h = harness([json({}, status)]);
    expect((await h.client.publish(record)).state).toBe('blocked');
    expect((await h.client.publish(record)).state).toBe('blocked'); expect(h.calls).toHaveLength(1);
  });
  it('does not hammer after a rate limit and returns a jittered not-before time', async () => {
    const record = await operation(); const h = harness([json({}, 429, { 'Retry-After': '60' }), present(record)]);
    const result = await h.client.publish(record);
    expect(result).toMatchObject({ state: 'deferred', retryAt: 61_500 });
    expect((await h.client.publish(record)).state).toBe('deferred'); expect(h.calls).toHaveLength(1);
    h.setNow(61_500); expect((await h.client.publish(record)).state).toBe('already-published');
  });
  it.each([409, 412])('surfaces CAS/idempotency conflict %s without rebasing or another write', async status => {
    const record = await operation(); const h = harness([absent(), json({ code: status === 412 ? 'stale_publication' : 'idempotency_key_reused' }, status), absent()]);
    expect((await h.client.publish(record)).state).toBe('conflict');
    expect(h.calls.map(c => c.init.method)).toEqual(['GET', 'POST', 'GET']);
  });
  it('stops on a withdrawn operation without resurrecting it', async () => {
    const record = await operation(); const h = harness([json({}, 410)]);
    expect(await h.client.publish(record)).toMatchObject({ state: 'blocked', code: 'withdrawn' }); expect(h.calls).toHaveLength(1);
  });
  it.each([400, 413, 422, 428])('surfaces actionable request rejection %s', async status => {
    const record = await operation(); const h = harness([absent(), json({ code: 'untrusted text' }, status)]);
    expect(await h.client.publish(record)).toMatchObject({ state: 'blocked' }); expect(h.calls).toHaveLength(2);
  });
  it('uses If-Match for a valid source correction', async () => {
    const first = await operation(); const prior = JSON.parse(first.body).publication;
    const p = await prepare({ ...source, revision: '2', text: source.text + '\nCorrection.' }, transform, prior.outputHash);
    const record = website.prepareWebsiteOperation(p, meeting, binding, first);
    const h = harness([absent(), json({}, 201), present(record)]);
    expect((await h.client.publish(record)).state).toBe('published');
    const headers = h.calls[1]?.init.headers as Record<string, string>;
    expect(headers['If-Match']).toBe('"' + prior.outputHash + '"'); expect(headers).not.toHaveProperty('If-None-Match');
  });
  it('rejects corrupt or differently scoped persisted records without I/O', async () => {
    const record = await operation(); const h = harness([]);
    for (const bad of [{ ...record, body: record.body + ' ' }, { ...record, bodyHash: 'a'.repeat(64) }, { ...record, principalId: 'someone-else' }, { ...record, origin: 'https://elsewhere.example' }]) {
      expect((await h.client.publish(bad)).state).toBe('blocked');
    }
    expect(h.calls).toHaveLength(0);
  });
});

it('accepts full receipt content from JSONB despite object-key reordering, without changing digest semantics', async () => {
  const record = await operation(); const value = receipt(record);
  function reordered(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(reordered);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reordered(child)]));
    return value;
  }
  const h = harness([json(reordered(value), 200, { ETag: '"' + value.outputHash + '"' })]);
  expect((await h.client.publish(record)).state).toBe('already-published');
});
it('handles an oversized response safely without source/credential details', async () => {
  const record = await operation();
  const h = harness([new Response(new Uint8Array(4 * 1024 * 1024 + 65537), { headers: { 'Content-Type': 'application/json' } })]);
  expect(await h.client.publish(record)).toEqual({ state: 'pending', code: 'receipt_unavailable' });
  expect(h.calls).toHaveLength(1);
});
it('rejects invalid UTF-8 receipt bytes before parsing', async () => {
  const record = await operation(); const h = harness([new Response(Uint8Array.from([0xff]), { headers: { 'Content-Type': 'application/json' } })]);
  expect((await h.client.publish(record)).state).toBe('pending'); expect(h.calls).toHaveLength(1);
});
it('rejects duplicate-key persisted bodies even with a recomputed exact-byte digest', async () => {
  const record = await operation(); const body = record.body.replace('"contractVersion":', '"contractVersion":"wrong","contractVersion":');
  const h = harness([]);
  expect((await h.client.publish({ ...record, body, bodyHash: sha(body) })).state).toBe('blocked'); expect(h.calls).toHaveLength(0);
});
it('refuses a body above 4 MiB without truncating content', async () => {
  const p = await prepare({ ...source, text: '😀'.repeat(800_000) }, async () => ({ notes: [], decisions: [], actions: [] }));
  const oversized = { ...meeting, attendees: '😀'.repeat(50_000), agenda: '😀'.repeat(50_000), tags: Array.from({ length: 100 }, () => '😀'.repeat(250)) };
  // Core transcript remains under 2,000,000 UTF-16 units; encoded transport limit is independent.
  const padded = await prepare({ ...source, text: '😀'.repeat(990_000) }, async () => ({ notes: [], decisions: [], actions: [] }));
  expect(() => website.prepareWebsiteOperation(padded, oversized, binding)).toThrow('body_too_large');
  expect(website.prepareWebsiteOperation(p, meeting, binding).body.length).toBeGreaterThan(1_600_000);
});
it('honors date-form Retry-After and preserves unknown state on the write path', async () => {
  const record = await operation(); const h = harness([absent(), json({}, 429, { 'Retry-After': 'Thu, 01 Jan 1970 00:02:00 GMT' })]);
  expect(await h.client.publish(record)).toMatchObject({ state: 'deferred', retryAt: 120_500 });
  expect(h.calls.map(c => c.init.method)).toEqual(['GET', 'POST']);
});
it('pauses on auth revocation after a write, without claiming success', async () => {
  const record = await operation(); const h = harness([absent(), json({}, 201), json({}, 403)]);
  expect(await h.client.publish(record)).toMatchObject({ state: 'blocked', code: 'scope_denied' });
  expect((await h.client.publish(record)).state).toBe('blocked'); expect(h.calls).toHaveLength(3);
});

it('matches the website team shared wire fixture including exact bytes and both digest layers', async () => {
  const { readFileSync } = await import('node:fs');
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/website-publication-v1.json', import.meta.url), 'utf8'));
  const [{ prepared }] = JSON.parse(readFileSync(new URL('../fixtures/roundtable-extractive-v1.json', import.meta.url), 'utf8'));
  const record = website.prepareWebsiteOperation(prepared, meeting, binding);
  expect(record).toEqual(fixture.record);
  expect(sha(record.body)).toBe(fixture.postReceipt.requestBodyHash);
  const h = harness([absent(), json(fixture.postReceipt, 201, fixture.responseHeaders), json(fixture.getReceipt, 200, fixture.responseHeaders)]);
  expect((await h.client.publish(record)).state).toBe('published');
  expect(h.calls[1]?.init.headers).toMatchObject(fixture.requestHeaders);
});

it('requires an actual credential string before issuing any request', () => {
  for (const token of [undefined, null, 123, '', 'contains\r\nheader']) {
    expect(() => website.createWebsitePublisher({ ...binding, token: token as unknown as string, fetch: globalThis.fetch })).toThrow('invalid_credential');
  }
});
it('does not shorten an unrepresentably large Retry-After into an early retry', async () => {
  const record = await operation(); const h = harness([json({}, 429, { 'Retry-After': '9'.repeat(400) })]);
  expect(await h.client.publish(record)).toMatchObject({ state: 'blocked', code: 'retry_after_out_of_range' });
  expect((await h.client.publish(record)).state).toBe('blocked'); expect(h.calls).toHaveLength(1);
});
it('freezes supplied v1 metadata by rejecting the changed-body receipt rather than calling it already published', async () => {
  const first = await operation();
  const changed = website.prepareWebsiteOperation(await prepare(source, transform), { ...meeting, title: 'Changed title' }, binding);
  expect(changed.operationId).toBe(first.operationId); expect(changed.bodyHash).not.toBe(first.bodyHash);
  const h = harness([present(first)]);
  expect(await h.client.publish(changed)).toMatchObject({ state: 'conflict', code: 'receipt_mismatch' }); expect(h.calls).toHaveLength(1);
});
it('honors a concurrent auth pause before writing after a slower absence lookup', async () => {
  const record = await operation(); let release!: (r: Response) => void; let calls = 0;
  const client = website.createWebsitePublisher({ ...binding, token: 'synthetic-token', fetch: (async () => {
    calls++;
    if (calls === 1) return new Promise<Response>(resolve => { release = resolve; });
    return json({}, 403);
  }) as typeof fetch });
  const slower = client.publish(record);
  expect((await client.publish(record)).state).toBe('blocked');
  release(absent());
  expect((await slower).state).toBe('blocked'); expect(calls).toBe(2);
});

it.each([[60, 1], [1, 60]])('preserves the longest integration cooldown across concurrent %is then %is rate limits', async (firstDelay, secondDelay) => {
  const first = await operation();
  const second = website.prepareWebsiteOperation(await prepare({ ...source, meetingId: 'another-synthetic-meeting' }, transform), meeting, binding);
  const pending: Array<(response: Response) => void> = [];
  const methods: string[] = [];
  let now = 1_000;
  const client = website.createWebsitePublisher({ ...binding, token: 'synthetic-token', clock: () => now, random: () => 0,
    fetch: (async (_url, init) => {
      methods.push(init!.method!);
      if (methods.length <= 2) return new Promise<Response>(resolve => { pending.push(resolve); });
      return present(first);
    }) as typeof fetch });
  const firstAttempt = client.publish(first);
  const secondAttempt = client.publish(second);
  expect(pending).toHaveLength(2);
  pending[0]!(json({}, 429, { 'Retry-After': String(firstDelay) }));
  expect(await firstAttempt).toEqual({ state: 'deferred', code: 'rate_limited', retryAt: firstDelay === 60 ? 61_000 : 2_000 });
  pending[1]!(json({}, 429, { 'Retry-After': String(secondDelay) }));
  expect(await secondAttempt).toEqual({ state: 'deferred', code: 'rate_limited', retryAt: 61_000 });
  for (const time of [2_001, 60_999]) {
    now = time;
    expect(await client.publish(first)).toEqual({ state: 'deferred', code: 'rate_limited', retryAt: 61_000 });
    expect(methods).toEqual(['GET', 'GET']);
  }
  now = 61_000;
  expect((await client.publish(first)).state).toBe('already-published');
  expect(methods).toEqual(['GET', 'GET', 'GET']);
});
it.each([403, 429])('honors concurrent integration status %i before readback after an in-flight write', async status => {
  const first = await operation();
  const second = website.prepareWebsiteOperation(await prepare({ ...source, meetingId: 'another-synthetic-meeting' }, transform), meeting, binding);
  let releasePost!: (response: Response) => void;
  let postStarted!: () => void;
  const started = new Promise<void>(resolve => { postStarted = resolve; });
  const methods: string[] = [];
  let now = 1_000;
  const client = website.createWebsitePublisher({ ...binding, token: 'synthetic-token', clock: () => now, random: () => 0,
    fetch: (async (_url, init) => {
      methods.push(init!.method!);
      if (methods.length === 1) return absent();
      if (methods.length === 2) return new Promise<Response>(resolve => { releasePost = resolve; postStarted(); });
      if (methods.length === 3) return json({}, status, { 'Retry-After': '60' });
      return present(first);
    }) as typeof fetch });
  const writing = client.publish(first);
  await started;
  const expected = status === 403
    ? { state: 'blocked', code: 'scope_denied' }
    : { state: 'deferred', code: 'rate_limited', retryAt: 61_000 };
  expect(await client.publish(second)).toEqual(expected);
  releasePost(json({}, 201));
  expect(await writing).toEqual(expected);
  expect(methods).toEqual(['GET', 'POST', 'GET']);
  expect(await client.publish(first)).toEqual(expected);
  expect(methods).toEqual(['GET', 'POST', 'GET']);
  if (status === 429) {
    now = 61_000;
    expect((await client.publish(first)).state).toBe('already-published');
    expect(methods).toEqual(['GET', 'POST', 'GET', 'GET']);
  }
});
