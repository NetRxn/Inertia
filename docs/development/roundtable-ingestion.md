# Roundtable ingestion slice

## Implementation plan and test contract

1. Classify explicitly supplied source kind/readiness; hash and retain raw source unchanged. Normalize transcript line endings and outer whitespace only. Summary-only sources cannot become transcripts.
2. Inject a transformer that receives untrusted text as data. Validate its structured extractive notes, decisions and tasks against exact transcript line evidence. Unknown owners remain null. No model-selected destination, HTML, URLs or publication policy.
3. Build deterministic versioned output with separate transcript and structured notes, provenance and content digest.
4. Reconcile publication before write. Require an adapter with atomic source revision binding, expected-previous-version comparison and idempotent writes. Read back every field/content/audience before success. Unknown reads/writes stay pending; never turn uncertainty into success.
5. Test readiness, summary-only, tampering, text injection, unknown owner, duplicate/corrected source, failed writes/readbacks and audience mismatch. Supply synthetic fixture demo, not a fake LLM integration.

## Verified DAO interface and required additive work

Inspected 2026-10-22: FWTX-DAO/dao-platform, src/app/_actions/meeting-notes.ts, blob a215482eaf598f1b79cedb0018d800ee345b4906.
https://github.com/FWTX-DAO/dao-platform/blob/main/src/app/_actions/meeting-notes.ts

getMeetingNotes/getMeetingNoteById requireAuth. createMeetingNote accepts title/date/attendees/agenda/notes/actionItems/tags and sets authorId from the session; updateMeetingNote checks author or admin. These are Next.js server actions, not a stable machine-ingestion HTTP API. No transcript, source revision/hash, idempotency key or audience field is exposed in the reviewed action contract. Current reads are authenticated; this does not establish finer audience isolation.

Proposed additive DAO patch (not implemented here): preserve existing user UI/actions, add a machine ingestion service backed by the same meeting records with separate transcript content, immutable source/output revision records and a unique operation key. Enforce configured destination/audience and principal permissions server-side; atomically compare expected previous output version and bind source ID+revision to a content hash. Provide authenticated lookup by operation key returning authoritative absent/present, and readback of both outputs plus audience/digests. Authentication and credential provisioning require separate authorized setup. Do not expose or guess a route until agreed and implemented in that repository. The pending adapter fails closed.

Drive/Gemini readiness, concrete export formats and folder configuration remain unverified. The source envelope is our internal ingestion contract, not a claimed Google API payload. Raw originals must be retained by the authorized source adapter; the pure preparation return preserves them unchanged. Plain text line citations support auditability but do not establish that a quoted utterance is an approved decision. Extractive mode intentionally refuses paraphrases; a richer summarizer needs a reviewed validation policy. Render all outputs as text, never HTML.

No second durable ledger: the future DAO versioned publication store owns the operation receipt. Its atomic idempotency/compare-and-swap guarantees are required; the existing server actions cannot satisfy the publisher port unchanged. This slice is not registered as an enabled production job until that adapter is implemented. In-policy automatic publication needs no routine per-meeting approval.

Further source verification: src/app/_lib/auth.ts blob f59e82fdb1117c9e383e6d9e5b044a1038dd1314 uses a privy-token cookie and server-side Privy verification. src/core/database/schema.ts blob e9cf4cd866ddeb2b5e0048cfc28c397e46feb3f3 confirms meeting_notes has no transcript/version/audience columns. Its separate documents table supports Pinata network/isPublic/shares; reuse should be evaluated in the DAO patch, not assumed equivalent to meeting-level publication authority.

## Run

npm run build && node dist/examples/roundtable-dry-run.js

The executable uses only synthetic text and deterministic fixture extraction. Expected publication status is pending until a conforming live adapter exists. Tests use an in-memory publication port solely as a fixture, including revision binding and compare-and-swap examples. No production persistence is simulated as installed. A rejected update or unresolved readback remains pending for an adapter-specific exception path; core does not auto-create issues or expose transcript text in exception logs. Native exception issue/document wiring should use the existing pinned Paperclip ctx.issues/ctx.issues.documents APIs when the source job is installed.

## Review correction: context and attribution

Extraction now requires the complete unchanged source line, including its speaker label and negation. Every extracted item is explicitly marked verification=unverified; placing a line in a decisions/actions collection does not authorize a decision or create executable work. Owner is always null in this extraction mode; any non-null model attribution is rejected. A future trusted structured-owner input and semantic review policy can add attribution without treating mere name presence as proof. Paraphrases require a separately reviewed semantic validation boundary. Full transcript remains available to contextualize selected lines. The source envelope is cloned before asynchronous transformation so caller mutation cannot redirect private content to another meeting or audience.

## Proposed website caller adapter

The separate [website publication adapter](website-publication-adapter.md) now implements exact-byte preparation/readback against the proposed member-only contract, with explicit auth/conflict/rate-limit/withdrawal outcomes and shared v1 digest vectors. It is not enabled in the worker, does not replace the pending publisher, and has no live credential or endpoint. Caller-owned native persistence and website acceptance remain required before enablement.
