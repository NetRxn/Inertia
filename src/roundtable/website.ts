/** Caller-side adapter for a PROPOSED website API, not a live integration. */
import { isDeepStrictEqual } from 'node:util';
import type { Publication, Prepared } from './ingestion.js';
import { publicationOperationId, publicationOutputHash, sha256 } from './codec.js';

export interface MeetingMetadata {
  title: string;
  /** Explicit DAO meeting date, never inferred from ingestion time. */
  date: string;
  attendees: string | null;
  agenda: string | null;
  tags: string[];
}
export interface WebsiteBinding { origin: string; principalId: string }
export interface WebsiteEnvelope {
  contractVersion: 'roundtable-publication-v1';
  meeting: MeetingMetadata;
  publication: Publication;
}
/** Persist this entire record in caller-owned private native plugin state BEFORE I/O. */
export interface WebsiteOperation extends WebsiteBinding {
  recordVersion: 'website-operation-v1';
  operationId: string;
  /** Serialize once; this exact UTF-8 string is the body of every retry. */
  body: string;
  bodyHash: string;
}
export interface WebsiteReceipt {
  state: 'present'; publicationId: string; meetingNoteId: string;
  operationId: string; outputHash: string; requestBodyHash: string;
  audience: 'members'; current: boolean; currentOutputHash: string;
  readbackPath: string; envelope: WebsiteEnvelope;
}
export type WebsiteOutcome =
  | { state: 'published' | 'already-published'; receipt: WebsiteReceipt }
  | { state: 'pending' | 'blocked' | 'conflict'; code: string }
  | { state: 'deferred'; retryAt: number; code: 'rate_limited' };
export class WebsitePreparationError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'WebsitePreparationError'; }
}
const ROOT = '/api/integrations/v1/roundtables';
const BODY_LIMIT = 4 * 1024 * 1024;
const RECEIPT_LIMIT = BODY_LIMIT + 64 * 1024;
const HEX = /^[a-f0-9]{64}$/;
function fail(code = 'invalid_operation'): never { throw new WebsitePreparationError(code); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, names: string[]): void {
  if (Object.keys(value).length !== names.length || names.some(name => !Object.hasOwn(value, name))) fail();
}
function text(value: unknown, max: number, empty = false): asserts value is string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) fail();
}
function binding(value: WebsiteBinding): void {
  let url: URL;
  try { url = new URL(value.origin); } catch { fail('invalid_binding'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || value.origin !== url.origin) fail('invalid_binding');
  text(value.principalId, 500);
}
function metadata(value: unknown): asserts value is MeetingMetadata {
  const m = object(value);
  keys(m, ['title', 'date', 'attendees', 'agenda', 'tags']);
  text(m.title, 500); text(m.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date) || !Number.isFinite(Date.parse(m.date)) || new Date(m.date).toISOString().slice(0, 10) !== m.date) fail('invalid_meeting_date');
  for (const field of ['attendees', 'agenda']) if (m[field] !== null) text(m[field], 100_000, true);
  if (!Array.isArray(m.tags) || m.tags.length > 100) fail();
  for (const tag of m.tags) text(tag, 500);
}
function publication(value: unknown): asserts value is Publication {
  const p = object(value);
  keys(p, ['meetingId', 'sourceId', 'revision', 'sourceHash', 'audience', 'transcript', 'notes', 'outputVersion', 'expectedPreviousOutputHash', 'outputHash', 'operationId']);
  for (const field of ['meetingId', 'sourceId', 'revision']) text(p[field], 500);
  if (p.audience !== 'members') fail('audience_mismatch');
  if (p.outputVersion !== 'extractive-v1') fail('unsupported_output_version');
  for (const field of ['sourceHash', 'outputHash', 'operationId']) if (typeof p[field] !== 'string' || !HEX.test(p[field])) fail();
  if (p.expectedPreviousOutputHash !== null && (typeof p.expectedPreviousOutputHash !== 'string' || !HEX.test(p.expectedPreviousOutputHash))) fail();
  text(p.transcript, 2_000_000);
  if (p.transcript !== p.transcript.replace(/\r\n?/g, '\n').trim()) fail();
  const lines = p.transcript.split('\n');
  const n = object(p.notes); keys(n, ['notes', 'decisions', 'actions']);
  for (const category of ['notes', 'decisions', 'actions']) {
    const rows = n[category];
    if (!Array.isArray(rows) || rows.length > 1000) fail();
    for (const item of rows) {
      const row = object(item);
      keys(row, category === 'actions' ? ['text', 'line', 'owner', 'verification'] : ['text', 'line', 'verification']);
      text(row.text, 10_000);
      if (typeof row.line !== 'number' || !Number.isSafeInteger(row.line) || row.line < 1 || lines[row.line - 1] !== row.text || /[<>]/.test(row.text) || row.verification !== 'unverified' || (category === 'actions' && row.owner !== null)) fail('invalid_evidence');
    }
  }
  const typed = value as Publication;
  if (publicationOutputHash(typed) !== p.outputHash || publicationOperationId(typed) !== p.operationId) fail('invalid_publication_digest');
}
function envelope(value: unknown): asserts value is WebsiteEnvelope {
  const e = object(value); keys(e, ['contractVersion', 'meeting', 'publication']);
  if (e.contractVersion !== 'roundtable-publication-v1') fail('unsupported_contract_version');
  metadata(e.meeting); publication(e.publication);
}
function restore(record: WebsiteOperation): WebsiteEnvelope {
  keys(object(record), ['recordVersion', 'origin', 'principalId', 'operationId', 'body', 'bodyHash']);
  binding(record);
  if (record.recordVersion !== 'website-operation-v1' || typeof record.body !== 'string' || Buffer.byteLength(record.body, 'utf8') > BODY_LIMIT || sha256(record.body) !== record.bodyHash) fail();
  let parsed: unknown;
  try { parsed = JSON.parse(record.body); } catch { fail(); }
  envelope(parsed);
  // Only canonical records created by this adapter are resumable. This also rejects
  // duplicate keys, whitespace rewrites and non-finite JSON before any network I/O.
  if (JSON.stringify(parsed) !== record.body || parsed.publication.operationId !== record.operationId) fail();
  return parsed;
}
export function prepareWebsiteOperation(prepared: Prepared, meeting: MeetingMetadata, target: WebsiteBinding, previous?: WebsiteOperation): Readonly<WebsiteOperation> {
  binding(target);
  const { raw, ...p } = structuredClone(prepared);
  publication(p); metadata(meeting);
  if (typeof raw !== 'string' || sha256(raw) !== p.sourceHash || raw.replace(/\r\n?/g, '\n').trim() !== p.transcript) fail('original_source_mismatch');
  if (p.expectedPreviousOutputHash !== null) {
    if (!previous) fail('previous_operation_required');
    const old = restore(previous).publication;
    if (previous.origin !== target.origin || previous.principalId !== target.principalId || old.meetingId !== p.meetingId || old.outputHash !== p.expectedPreviousOutputHash) fail('previous_operation_mismatch');
    const content = (v: Publication) => JSON.stringify([v.sourceId, v.revision, v.sourceHash, v.transcript, v.notes, v.outputVersion]);
    if (content(old) === content(p)) fail('metadata_only_correction_unsupported');
  } else if (previous) fail('unexpected_previous_operation');
  const body = JSON.stringify({ contractVersion: 'roundtable-publication-v1', meeting: structuredClone(meeting), publication: p });
  if (Buffer.byteLength(body, 'utf8') > BODY_LIMIT) fail('body_too_large');
  return Object.freeze({ recordVersion: 'website-operation-v1', origin: target.origin, principalId: target.principalId,
    operationId: p.operationId, body, bodyHash: sha256(body) });
}

export interface WebsitePublisherConfig extends WebsiteBinding {
  /** Scoped credential, never written into the persisted operation or errors. */
  token: string;
  fetch: typeof globalThis.fetch;
  /** Epoch milliseconds; scheduler owns waiting and persistence of outcomes. */
  clock?: () => number;
  random?: () => number;
}
async function boundedJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim();
  if (contentType !== 'application/json' || !response.body) throw Error('invalid_response');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > RECEIPT_LIMIT) { await reader.cancel(); throw Error('response_too_large'); }
      chunks.push(chunk.value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes))) as unknown;
  } finally { reader.releaseLock(); }
}
function verifyReceipt(value: unknown, record: WebsiteOperation, response: Response): WebsiteReceipt | null {
  const r = object(value);
  if (r.state !== 'present') return null;
  keys(r, ['state', 'publicationId', 'meetingNoteId', 'operationId', 'outputHash', 'requestBodyHash', 'audience', 'current', 'currentOutputHash', 'readbackPath', 'envelope']);
  text(r.publicationId, 500); text(r.meetingNoteId, 500);
  // JSONB may reorder object keys. Compare every value against the validated saved
  // envelope, but never canonicalize/recompute extractive-v1 hashes from that order.
  const expected = restore(record);
  const p = expected.publication;
  if (!isDeepStrictEqual(r.envelope, expected) || r.operationId !== record.operationId || r.outputHash !== p.outputHash || r.requestBodyHash !== record.bodyHash || r.audience !== 'members' || typeof r.current !== 'boolean' || typeof r.currentOutputHash !== 'string' || !HEX.test(r.currentOutputHash) || (r.current ? r.currentOutputHash !== r.outputHash : r.currentOutputHash === r.outputHash) || r.readbackPath !== `${ROOT}/operations/${record.operationId}` || response.headers.get('etag') !== `"${p.outputHash}"`) fail('receipt_mismatch');
  return value as WebsiteReceipt;
}
/** No blind retries or own scheduler. Call again with the saved record after resolving the outcome. */
export function createWebsitePublisher(config: WebsitePublisherConfig): { publish(record: WebsiteOperation): Promise<WebsiteOutcome> } {
  // Snapshot scope and credentials; a different identity requires explicit new configuration.
  const { origin, principalId, token, fetch: requestFetch } = config;
  binding({ origin, principalId });
  if (typeof token !== 'string' || !/^[A-Za-z0-9\-._~+/]+=*$/.test(token)) fail('invalid_credential');
  const now = config.clock ?? Date.now; const random = config.random ?? Math.random;
  let paused: WebsiteOutcome | undefined;
  let retryAt = 0;
  async function request(path: string, method: 'GET' | 'POST', record: WebsiteOperation, p: Publication): Promise<Response> {
    const url = origin + path;
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json; charset=utf-8';
      headers['Idempotency-Key'] = record.operationId;
      if (p.expectedPreviousOutputHash === null) headers['If-None-Match'] = '*';
      else headers['If-Match'] = `"${p.expectedPreviousOutputHash}"`;
    }
    const response = await requestFetch(url, { method, headers, ...(method === 'POST' ? { body: record.body } : {}),
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (response.redirected || (response.url && response.url !== url) || (response.status >= 300 && response.status < 400)) {
      await response.body?.cancel(); throw Error('unexpected_redirect');
    }
    return response;
  }
  async function status(response: Response): Promise<WebsiteOutcome | undefined> {
    const code = response.status;
    if (code === 401 || code === 403) {
      paused = { state: 'blocked', code: code === 401 ? 'authentication_required' : 'scope_denied' };
      await response.body?.cancel(); return paused;
    }
    if (code === 429) {
      const raw = response.headers.get('retry-after'); const time = now();
      const numeric = raw !== null && /^\d+$/.test(raw.trim());
      const delay = numeric ? Number(raw) * 1000 : raw ? Date.parse(raw) - time : NaN;
      if ((numeric && !Number.isFinite(delay)) || !Number.isFinite(time) || (Number.isFinite(delay) && Math.abs(time + delay + 1000) > Number.MAX_SAFE_INTEGER)) {
        paused = { state: 'blocked', code: 'retry_after_out_of_range' };
        await response.body?.cancel(); return paused;
      }
      const r = random(); const jitter = Number.isFinite(r) ? Math.max(0, Math.min(1, r)) * 1000 : 0;
      // Concurrent responses may extend the integration cooldown, never shorten it.
      retryAt = Math.max(retryAt, time + Math.max(1000, Number.isFinite(delay) ? delay : 1000) + jitter);
      await response.body?.cancel(); return { state: 'deferred', code: 'rate_limited', retryAt };
    }
    if (code === 410) { await response.body?.cancel(); return { state: 'blocked', code: 'withdrawn' }; }
    return undefined;
  }
  type Read = { state: 'absent' } | { state: 'present'; receipt: WebsiteReceipt } | WebsiteOutcome;
  async function read(record: WebsiteOperation, p: Publication): Promise<Read> {
    try {
      const response = await request(`${ROOT}/operations/${record.operationId}`, 'GET', record, p);
      const classified = await status(response); if (classified) return classified;
      if (response.status === 404) {
        const value = await boundedJson(response);
        if (value && typeof value === 'object' && 'code' in value && value.code === 'operation_absent') return { state: 'absent' };
        return { state: 'pending', code: 'absence_unproven' };
      }
      if (response.status !== 200) { await response.body?.cancel(); return { state: 'pending', code: 'receipt_unavailable' }; }
      const value = await boundedJson(response);
      if (!value || typeof value !== 'object' || !('state' in value) || value.state !== 'present') return { state: 'pending', code: 'invalid_receipt' };
      try {
        const receipt = verifyReceipt(value, record, response);
        if (receipt) return { state: 'present', receipt };
      } catch { return { state: 'conflict', code: 'receipt_mismatch' }; }
      return { state: 'pending', code: 'invalid_receipt' };
    } catch { return { state: 'pending', code: 'receipt_unavailable' }; }
  }
  return {
    async publish(input) {
      let record: WebsiteOperation; let p: Publication;
      try {
        record = structuredClone(input); p = restore(record).publication;
        if (record.origin !== origin || record.principalId !== principalId) fail('binding_mismatch');
      } catch { return { state: 'blocked', code: 'invalid_operation' }; }
      if (paused) return paused;
      if (retryAt > now()) return { state: 'deferred', code: 'rate_limited', retryAt };
      const before = await read(record, p);
      if (before.state === 'present') return { state: 'already-published', receipt: before.receipt };
      if (before.state !== 'absent') return before;
      // Another concurrent lookup may have paused/deferred this same integration.
      if (paused) return paused;
      if (retryAt > now()) return { state: 'deferred', code: 'rate_limited', retryAt };
      let conflict: WebsiteOutcome | undefined;
      try {
        const response = await request(`${ROOT}/publications`, 'POST', record, p);
        const classified = await status(response); if (classified) return classified;
        if (response.status === 409 || response.status === 412) {
          conflict = { state: 'conflict', code: response.status === 412 ? 'stale_publication' : 'publication_conflict' };
        } else if (response.status >= 400 && response.status < 500) {
          const codes: Record<number, string> = { 400: 'invalid_payload', 413: 'body_too_large', 422: 'publication_rejected', 428: 'precondition_required' };
          await response.body?.cancel(); return { state: 'blocked', code: codes[response.status] ?? 'request_rejected' };
        }
        // A POST acknowledgement is not evidence of success. Never use its content.
        await response.body?.cancel();
      } catch { /* Uncertain write: same-operation readback, never inline replay. */ }
      // A concurrent operation may pause/defer the integration while this POST is in flight.
      // Leave the write unconfirmed until a later permitted readback.
      if (paused) return paused;
      if (retryAt > now()) return { state: 'deferred', code: 'rate_limited', retryAt };
      const after = await read(record, p);
      // Auth/withdrawal/rate-limit take priority even when a write conflict was observed.
      if (after.state === 'blocked' || after.state === 'deferred') return after;
      if (conflict) return conflict;
      if (after.state === 'present') return { state: 'published', receipt: after.receipt };
      if (after.state === 'absent') return { state: 'pending', code: 'write_unconfirmed' };
      return after;
    },
  };
}
