# Publication contract v1.1 clarification — 2026-10-23

Status: proposed, for coordination with the website team. This addendum clarifies the [v1 proposal](dao-website-member-publication-proposal.md); it does not indicate a deployed endpoint, authorize production setup, or introduce a new wire version. The body `contractVersion` remains `roundtable-publication-v1`, `outputVersion` remains `extractive-v1`, and both existing core digest algorithms and POST fields are unchanged.

## Change note

The first Inertia caller implementation exposed three details that need explicit agreement before website implementation: the full GET receipt envelope field, metadata field types/limits, and JSONB object-order handling. These are now pinned below. No existing field is renamed. Metadata-only corrections remain unsupported, as the original proposal required until a metadata-bound versioned codec exists.

## Full GET receipt

GET `/api/integrations/v1/roundtables/operations/{operationId}` returns HTTP 200 and exactly these fields:

```typescript
{
  state: "present",
  publicationId: string,
  meetingNoteId: string,
  operationId: string,
  outputHash: string,
  requestBodyHash: string,
  audience: "members",
  current: boolean,
  currentOutputHash: string,
  readbackPath: "/api/integrations/v1/roundtables/operations/" + operationId,
  envelope: { contractVersion: "roundtable-publication-v1", meeting, publication }
}
```

`envelope` is the complete immutable POST body content, including the meeting metadata snapshot and publication. No raw original, public URL, machine-supplied author, or verification attribution is added. `ETag` is the quoted historical operation's `outputHash`, including when `current=false`; `currentOutputHash` identifies the currently selected version. For `current=true` the two hashes agree, and for `current=false` they differ. This adapter supports only current records whose current digest is known; withdrawn/purged operations return 410 instead. Headers include `Content-Type: application/json` and `Cache-Control: private, no-store`.

POST success remains the smaller receipt in the v1 proposal (no envelope/currentOutputHash required). Inertia never considers that acknowledgment sufficient: it performs GET readback before reporting success. A missing/malformed receipt is pending; a claimed present receipt with mismatched content is a conflict.

JSONB may reorder object keys. Full readback compares every nested field and array element semantically against the saved exact request body, allowing only object-property order to differ. The stored `requestBodyHash` still covers the original exact bytes. This comparison is NOT a new canonicalization or digest algorithm.

For validation of extractive-v1 outputHash, construct the notes object using the original core schema property order: outer `notes`, `decisions`, `actions`; ordinary excerpt `text`, `line`, `verification`; action excerpt `text`, `line`, `owner`, `verification`. Apply the unchanged JavaScript array/string serialization algorithm from v1. Do not hash a reordered JSONB representation, substitute generic sorted JSON, or hash raw source from normalized transcript. The raw source digest remains source-adapter attested.

## Metadata types and client bounds

- `title`: nonblank string, maximum 500 UTF-16 code units.
- `date`: real calendar date exactly `YYYY-MM-DD`, supplied by the source adapter.
- `attendees`, `agenda`: string or null, maximum 100,000 UTF-16 code units each; empty string is allowed.
- `tags`: array of at most 100 nonblank strings, each maximum 500 UTF-16 code units.
- Text rejects control characters except tab/newline/carriage return. Transcript uses the existing normalized extractive-v1 content and two-million-code-unit limit.
- POST body remains capped at 4 MiB of UTF-8 bytes. No truncation. Receipt reader is bounded to 4 MiB + 64 KiB to cover the stored envelope plus receipt fields.

These are caller-side bounds, not proof that the website currently enforces them. The website team should implement equivalent validation in its route/service acceptance suite. Changes need coordinated fixtures, not silent widening in one repository.

## Shared synthetic fixtures

- [Exact request record, headers, POST receipt and full GET receipt](../../test/fixtures/website-publication-v1.json).
- [Historical extractive-v1 golden vectors](../../test/fixtures/roundtable-extractive-v1.json): source CRLF/CR normalization, non-ASCII/emoji, JSON escaping, notes property order and action owner=null.
- [Shared core digest functions](../../src/roundtable/codec.ts).
- [Caller contract tests](../../test/roundtable/website.test.ts) and [codec tests](../../test/roundtable/codec.test.ts).

Fixtures contain synthetic text only. `record.body` is a JSON string: decode that string once and transmit its UTF-8 bytes. Do not pretty-print/reconstruct it before hashing or retrying. The fixture origin and principal are nonproduction placeholders; there is no usable credential. Website acceptance still requires real PostgreSQL transactions, route authorization, cache isolation, concurrency and retention tests described in v1. These mocked-I/O caller tests cannot substitute for those server tests.

## Versioned metadata correction follow-on

A different title/date/attendee/agenda/tag value changes the request-body digest but not the current core operation identity. Reusing that operation with different bytes must produce an idempotency conflict. Merely advancing `expectedPreviousOutputHash` with identical source/notes is also rejected by Inertia preparation as `metadata_only_correction_unsupported`.

Do not change extractive-v1 hashing in place. A follow-on proposal must define a new explicit adapter envelope/operation codec that binds the metadata snapshot, source/output identity and previous version, plus CAS semantics interoperable with both original and newer receipts. It must supply cross-language golden vectors and managed human-correction tests. Until both sides implement it, keep the existing record untouched and surface one native exception: metadata-only correction needs the versioned website correction contract. Do not silently report success, invent a source revision, or route around version history through the legacy edit path.
