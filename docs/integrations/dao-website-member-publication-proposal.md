# DAO website: member publication and authoritative knowledge contract

Status: proposed implementation contract for the website team. Owner: website rollout by John; Inertia owns the caller/adapter. Version 1, 2026-10-23. No website changes, credential provisioning, or deployment are included in this document.

Implementation coordination note (2026-10-23): see the separate [v1.1 clarification addendum](dao-website-publication-v1.1-clarifications.md) for the full receipt field shape, metadata bounds and shared synthetic fixtures. The original wire version and digest algorithms below are unchanged; no endpoint is live by virtue of this document.

## 1. Outcome and boundaries

After one authorized setup, a ready Roundtable transcript produces a separate transcript and readable notes on the member portal automatically. Retries produce one publication; corrections produce a visible new version without overwriting somebody else's changes. Ordinary publication requires neither a per-meeting vote nor human approval. Missing inputs, conflicts and policy violations become actionable exceptions rather than partial public posts.

The same deployed agent can retrieve authorized DAO source material to ground grant applications: governance rules, formation documents and other organizational facts. The DAO website remains the organizational source of truth. Public-search failure is not evidence that a DAO fact is absent. Search authenticated holdings before asking a person to gather facts.

Keep Paperclip as work/agent authority and Buzz as its conversational surface. This contract adds no task engine, vector database, graph store, identity provider or governance workflow. Vocdoni decisions and external grant submission remain separate operations.

## 2. Inspected source and changes required

Website source pinned to [FWTX-DAO/dao-platform d9654bd](https://github.com/FWTX-DAO/dao-platform/tree/d9654bd9c988f65f7b940fd8acb3d6c05f51c377). Recheck differences before implementation. This is the Next.js platform, not the separate Astro website repository.

- [Meeting actions](https://github.com/FWTX-DAO/dao-platform/blob/d9654bd9c988f65f7b940fd8acb3d6c05f51c377/src/app/_actions/meeting-notes.ts): list/detail/create use requireAuth; edit/delete allow author or admin. Existing fields: title, date, attendees, agenda, notes, actionItems, tags. No stable machine ingestion HTTP route.
- [Schema](https://github.com/FWTX-DAO/dao-platform/blob/d9654bd9c988f65f7b940fd8acb3d6c05f51c377/src/core/database/schema.ts): meeting_notes has text fields and author_id, timestamps; no transcript, audience or publication revisions. members has status/expiresAt; member_roles has isActive/expiresAt; roles has level. documents has Pinata/CID metadata; document_shares has expiry.
- [Auth](https://github.com/FWTX-DAO/dao-platform/blob/d9654bd9c988f65f7b940fd8acb3d6c05f51c377/src/app/_lib/auth.ts): Reuse Privy session verification and the existing membership/RBAC tables through a centralized policy helper; the new portal contract explicitly requires active membership, role expiry and status checks.
- [Document actions](https://github.com/FWTX-DAO/dao-platform/blob/d9654bd9c988f65f7b940fd8acb3d6c05f51c377/src/app/_actions/documents.ts): Reuse the existing uploader/admin/public/share permission model and document storage. The new contract requires consistent resource-scoped authorization on search, detail and content, including share expiry.
- [Existing bearer route pattern](https://github.com/FWTX-DAO/dao-platform/blob/d9654bd9c988f65f7b940fd8acb3d6c05f51c377/src/app/api/admin/member-emails/route.ts) demonstrates server-side constant-time bearer verification. Reuse the pattern, never its broad export credential or permission.
- Inertia baseline [a3e60ee](https://github.com/NetRxn/Inertia/tree/a3e60ee5f1f9d9a295d3f744d3eca452a4ded947), [Roundtable core](../../src/roundtable/ingestion.ts) and [existing integration plan](../development/roundtable-ingestion.md). Current Publisher is pending, not a live website integration.

## 3. Authorization: one policy service used everywhere

Introduce reusable server-side policy helpers, retaining Privy and the existing RBAC tables:

1. Active member means members.status = 'active', member expiry null or strictly later than database now, and EXISTS an active, unexpired member_roles row joining roles.level >= 10. Use EXISTS, not lowest-role selection. Expiry equal to now denies. This is the proposed portal policy; owner confirms the membership lifecycle mapping during rollout, not meeting-by-meeting. Do not require a paid subscription unless DAO policy says so.
2. Reads require that active membership predicate. Admin privileges for this surface additionally require active membership and an unexpired existing admin-role assignment. A stale admin role is not an escape hatch.
3. Every meeting list, detail, search, server action, API, transcript download and historical-version read applies the same gate. UI hiding alone is insufficient. Do not send a protected record into client props before checking access.
4. Existing human author/admin edit rights remain, after membership authorization. Managed publications go through the revision service; legacy updates may not bypass version/CAS checks. The simplest v1 UI is a dedicated correction action for managed records and the existing editor for legacy records.
5. Machine requests authenticate a dedicated, revocable integration principal, not a browser cookie, copied admin token or caller-supplied authorId. Configure one responsible active member user and scope set. Verify that account remains active on every request; removing membership or revoking the principal stops its access.
6. Scopes: roundtable:publish and roundtable:receipt for one configured collection; dao:knowledge:read for explicitly approved document IDs/collections. The machine cannot change audiences, share documents, grant membership, select another author, or read member profiles. Receipt scope permits full readback only of publications owned by that principal/collection. A knowledge scope is not blanket access to all member-restricted data.
7. Store only a random integration credential's digest, key ID, expiry, revokedAt, scopes, responsible user and approved resource constraints. Use HTTPS and constant-time digest comparison; enforce expiry/revocation per request, rate limits and content-free audit events. Provisioning/rotation is a separately authorized deployment step. An environment-held digest configuration can replace a table for the single demo principal, with identical semantics; no credential-management UI is required.
8. Documents additionally require existing per-document ACL, augmented with non-expired shares and active document status. The machine must satisfy BOTH its resource allowlist and the responsible user's effective ACL. Public documents can be allowed explicitly; neither isPublic nor membership grants permission to every private file. Apply the predicate before search pagination/count/snippets, not after returning metadata.

For protected responses use Cache-Control: private, no-store; do not place them in shared Next.js/Cloudflare caches, feeds, sitemap, public llms.txt, static exports or unauthenticated search. Render text safely; strip executable markup/links from generated rendering rather than executing transcript instructions. File access must reauthorize through the server. For member-only transcripts prefer DB text in v1; do not upload them to public IPFS/Pinata or reveal permanent public object URLs.

## 4. Minimal additive persistence

Use existing Drizzle migrations and PlanetScale PostgreSQL transactions. Names below are proposed, not existing tables.

### meeting_notes additions

- audience text NOT NULL DEFAULT 'members', CHECK audience = 'members' for this feature.
- managed_collection text NULL; external_meeting_id text NULL; current_publication_id text NULL.
- UNIQUE(managed_collection, external_meeting_id) when both present. IDs are opaque, stable source identities, not title/date guesses.
- Existing author_id remains a valid users FK: server sets the integration's responsible user. Audit separately records integration principal. Existing text columns become a compatibility projection of the current publication.

### meeting_source_versions

- id PK; meeting_note_id FK; source_id text; source_revision text; source_hash char(64); created_at.
- UNIQUE(meeting_note_id, source_id, source_revision). Immutable binding to one source_hash. Reuse with a different hash is a conflict, even if output differs.
- Source revision is opaque. Never sort revision strings to decide which is newer. The Drive adapter resolves order/readiness and keeps originals in the authorized Drive folder; website retains provenance, not a second raw-original store.

### meeting_publications

- id PK; meeting_note_id FK; source_version_id FK; integration_id; operation_id char(64); request_body_hash char(64); output_hash char(64); previous_publication_id nullable FK; previous_output_hash nullable; output_version text; audience text CHECK = 'members'; transcript text; structured_notes jsonb; envelope jsonb; created_at; content_purged_at nullable.
- UNIQUE(integration_id, operation_id); UNIQUE(meeting_note_id, output_hash). Immutable versions. Exact client envelope retained for readback; do not reconstruct it from lossy presentation fields.
- Store metadata snapshot (title/date/attendees/agenda/tags) with the publication so corrections are reconstructable. UTF-8 body digest covers metadata as well as the publication envelope.
- Existing meeting_notes.current_publication_id points at the committed version. Foreign keys and ownership checks prevent a pointer to another meeting. Insert source/version, publication and compatibility projection in ONE transaction.
- Retain operation IDs and digests as tombstones when content is purged so old deliveries cannot resurrect deleted content. Purged receipts return 410, not authoritative absence. Deletion/withdrawal must create a managed tombstone and revoke content access, not cascade-delete the only dedup evidence.

No separate ingestion queue/ledger is required here. Inertia handles retry scheduling; website owns durable publication receipts. A migration may use one publication table plus deduplicated source rows; do not add additional workflow state tables without a concrete need.

## 5. Proposed HTTP contract

Routes are additive Next.js route handlers under /api/integrations/v1, using a shared service also called by managed human corrections. They are not available until implemented by the website team.

### Publish

POST /api/integrations/v1/roundtables/publications
Authorization: Bearer <dedicated credential>
Content-Type: application/json; charset=utf-8
Idempotency-Key: <publication.operationId>
If-None-Match: * (first publication) OR If-Match: "<expectedPreviousOutputHash>" (correction)

Body shape (synthetic example; hashes are symbolic here, generated examples must use computed values):

```json
{
  "contractVersion": "roundtable-publication-v1",
  "meeting": {"title": "Roundtable", "date": "2026-10-23", "attendees": null, "agenda": null, "tags": []},
  "publication": {
    "meetingId": "synthetic-meeting-1", "sourceId": "synthetic-source-1", "revision": "revision-1",
    "sourceHash": "<sha256 original source UTF-8 bytes>", "audience": "members",
    "transcript": "Speaker: We discussed preparing a draft.",
    "notes": {"notes": [{"text": "Speaker: We discussed preparing a draft.", "line": 1, "verification": "unverified"}], "decisions": [], "actions": []},
    "outputVersion": "extractive-v1", "outputHash": "<core digest>", "operationId": "<core operation digest>",
    "expectedPreviousOutputHash": null
  }
}
```

Only these root/meeting/publication keys are accepted for v1. Reject duplicate JSON object keys, non-finite numbers, invalid UTF-8, unknown output versions and oversized bodies. Initial cap: 4 MiB encoded body and 2,000,000 transcript characters; 413 is actionable, not silent truncation. ISO date is the DAO's meeting date, never guessed from upload time. Collection/author/audience are checked against server policy, not derived from generated notes. Reject a supplied audience other than members; do not silently convert it.

Success 201 for new commit, 200 for exact replay:

```json
{"state":"present","publicationId":"p_example","meetingNoteId":"m_example","operationId":"<digest>","outputHash":"<digest>","requestBodyHash":"<digest>","audience":"members","current":true,"readbackPath":"/api/integrations/v1/roundtables/operations/<digest>"}
```

Response ETag is quoted outputHash. A replay of an older version returns its original receipt with current=false and never moves the current pointer backwards.

### Receipt and human reads

GET /api/integrations/v1/roundtables/operations/{operationId} requires roundtable:receipt scope and collection/principal ownership. 200 includes immutable full publication envelope, meeting metadata, body digest, current flag and currentOutputHash. 404 {"code":"operation_absent"} means an authorized query against the primary database found no row. Cross-scope rows return generic 404 without leaking existence; the adapter's scoped identity must stay fixed for an operation. Database outages/timeouts return 503, never absent. 410 means a durable withdrawn/purged operation.

Member UI uses existing meeting routes and shared policy service; provide a protected transcript/version read endpoint only if required by that UI. Machine receipt never emits a public URL. Human member reads of history use the same audience and ACL as current content.

### Exact bytes, hashes and future formats

The sender serializes the HTTP body ONCE to UTF-8 and persists/reuses those bytes for all retries of that operation. Server computes SHA-256 over exactly those bytes before parsing; store request_body_hash. Whitespace/key-order changes with the same operation ID produce 409 idempotency_key_reused, not a second mutation. A caller wanting different title/metadata must issue a new correction operation; see adapter compatibility below.

Current core outputHash is SHA-256(UTF8(JSON.stringify([meetingId, sourceId, revision, sourceHash, audience, transcript, notes, outputVersion, expectedPreviousOutputHash]))). operationId is SHA-256(UTF8(JSON.stringify([meetingId, sourceId, revision, sourceHash, outputHash]))). Preserve current JavaScript array/object serialization and JSON escaping exactly for extractive-v1; publish shared golden vectors for Unicode, newlines, action owner=null and property order. No generic JSON canonicalization may silently change these hashes. Server validates those hashes using the shared codec and validates full-line citations against normalized transcript. sourceHash refers to original pre-normalization UTF-8 source, not the normalized transcript; server records this as adapter-attested provenance because raw originals are not sent. The authorized source adapter verifies originals before sending.

Metadata is not included in today's core outputHash. Therefore freeze meeting metadata for the lifetime of an extractive-v1 core operation; a metadata-only change cannot reuse its operation ID. Implement a versioned adapter envelope/operation codec covering metadata before enabling metadata-only machine corrections. Until then those edits are human managed corrections through a new versioned codec, or a clearly reported unsupported operation. Do not pretend the current core already supports them.

Keep outputVersion as an explicit validated registry, not a permanent extractive-only database enum. extractive-v1 renders candidates as unverified with full source context and unknown action owners. Future reviewed formats may support summaries, structured verified owners and richer evidence. New format requires a schema, digest codec and validation tests. Human verification stores verifiedBy/verifiedAt/evidence in an append-only authenticated annotation or new publication version, never accepts machine-supplied human attribution. “Quoted in transcript”, “candidate decision” and “formally ratified decision” are separate concepts. No candidate creates executable work or grant-submission authority merely by being published.

### Atomic algorithm and errors

1. Authenticate/scope-check, size-limit/read exact bytes, validate schema/hashes/audience and header consistency.
2. In a transaction, obtain/insert the meeting row via its unique collection+external ID and lock that row FOR UPDATE. Unique-conflict insertion retries the select/lock, not an unprotected application check.
3. Check existing operation first. Same principal/key/body hash returns original committed version even if the current version advanced. Different body hash returns 409.
4. Verify source ID+revision/hash binding. For a correction require expectedPreviousOutputHash and If-Match to equal the current output hash; first publication requires no current version and If-None-Match *. Missing precondition is 428; mismatch 412. Two contenders at the same parent produce exactly one winner.
5. Insert immutable rows, update current pointer and legacy projection atomically, commit, then invalidate only protected route caches. An invalidation failure must not roll back evidence or cause duplicate creation; readback is authoritative.
6. Concurrent same-operation inserts reconcile the unique constraint and return the stored matching receipt. Any SQL exception rolls back all writes. Do not report success before commit.

Error JSON: {code, retryable, requestId}; optional safe field path, never transcript or credentials. Codes/statuses: 400 invalid_payload; 401 authentication_required; 403 scope_denied; 409 source_revision_changed / idempotency_key_reused; 412 stale_publication; 413 body_too_large; 422 unsupported_output_version / invalid_evidence / audience_mismatch; 428 precondition_required; 429 rate_limited + Retry-After; 503 unavailable. Unauthorized responses disclose no meeting metadata.

On write timeout, lost response or 5xx, caller reads its operation receipt before retrying the exact body. On 429 honor Retry-After with jitter. On 412/409 do not auto-rebase or overwrite: reread current state and raise a content-free exception for resolution. On 401/403 pause the integration rather than hammering. Full readback must match content, hashes, source binding and audience before Inertia reports success. Unknown remains pending. 410 stops replay and raises a withdrawal/retention outcome, never recreate.

## 6. Authoritative DAO knowledge for grants

Reuse documents/document_shares and existing authorized storage. Extract a common permission predicate from document actions; require list/detail/download consistency and valid, unexpired shares. Existing detail/download actions can remain for portal UI. Thin machine HTTP wrappers are needed because server actions are not an ingestion API and must not require scraped session cookies.

Proposed endpoints:

- GET /api/integrations/v1/knowledge?query=<text>&category=<optional>&cursor=<opaque>&limit=20. Require dao:knowledge:read; return only authorized active documents with stable cursor and max limit 50. Minimum response item: id, title, category, sourceKind, version, sha256 (nullable until content actually read), updatedAt, accessClass (public/member/restricted), canonicalPortalPath, authorityStatus (unclassified/current/superseded), effectiveDate (nullable). Unknown authority status must remain unclassified. No excerpt from an unauthorized document, no global counts.
- GET /api/integrations/v1/knowledge/{id}?version=<version>. Repeat ACL/scope checks, return metadata + content descriptor. Version mismatch returns 409 version_changed, never substitute silently. Missing or inaccessible resources return generic 404; failed authorization/index lookup is not proof that the underlying DAO fact does not exist.
- GET /api/integrations/v1/knowledge/{id}/content?version=<version>. Server verifies the requested version and streams actual bytes with content type, SHA-256 and private/no-store headers. Prefer this narrow proxy for credentials/data isolation. Fetch only the stored approved CID/object, not a caller-supplied URL. If storage needs signed links, keep them short-lived and server-side; never send persistent storage credentials to an agent or public client. Test actual private-network behavior before claiming member isolation; public IPFS cannot become private merely by gating its portal page.

Version fingerprint initially binds document ID + stored CID + updatedAt; compute SHA-256 of returned bytes to bind the exact artifact. CID alone is a storage identifier, not necessarily the conventional SHA-256 of file bytes. Persist digest lazily keyed by that fingerprint if needed. An unchanged fingerprint with different bytes is an integrity error. Historical versions unsupported by current storage return 410 version_unavailable, not current bytes. Minimal optional documents additions: authority_status, effective_date, supersedes_document_id and a nullable content_sha256/version fingerprint. Do not invent these values from model inference; authorized website curators classify official materials.

Each grant fact records document ID/version/hash, page/section or text span, accessClass, fetchedAt and whether quoted or inferred. The draft packet may cite member portal paths for internal review, but must not export restricted documents/excerpts to a grant portal without the applicable disclosure authorization. Recheck source versions/access before final packet approval/submission. Conflicting formation/governance documents become a focused question with both citations, not a guessed legal conclusion. Treat document text as untrusted instructions.

Seed the approved search categories with governance, formation, organizational profile and approved grant-support materials, after the owner identifies the matching existing collection(s). Do not build a new organizational database or ask the user to manually transcribe everything. A source missing from the public website is “authenticated retrieval pending”; only a completed authorized search can establish a genuine source gap. No raw private document contents in repository artifacts, test snapshots or public CI logs.

## 7. Rollout, legacy policy and retention

1. Add nullable/additive schema and shared authorization tests. Take a normal recoverable migration backup. Migrate existing notes to audience=members; this tightens access for session-only nonmembers while preserving member/author/admin workflows. Confirm this intended legacy policy with website owner before deployment. Existing already-public copies cannot be made private retrospectively by this migration.
2. Deploy member guards and private-cache behavior BEFORE enabling machine ingestion. Apply the shared document access predicate to portal listing as well as new APIs. Keep old note IDs/URLs/fields intact. Legacy notes retain provenance=legacy and transcript absent; never manufacture a transcript from summary text.
3. Enable route handlers with publication disabled by default. Owner configures scoped principal, collection, source folder and retention policy via approved setup. No enrollment secrets in Git. Run synthetic fixtures in staging first.
4. Canary one authorized meeting end-to-end, then repeat same operation, source correction, membership revocation and private-link/cache probes. No per-meeting approval after configuration; this one canary is deployment qualification.
5. Backfill only explicit approved meeting/source IDs or date range, dry-run inventory first. Map known existing note IDs explicitly; matching title/date alone does not authorize merging two meetings. Missing raw source yields a visible notes-only legacy record, not fabricated transcript. Verify source readiness and Drive revision order.
6. Enable scheduled/event ingestion. Exceptions expose operation ID/status only in shared work items, with portal links for members. Track latency, successful readbacks, retry backlog, conflicts and auth denials, not transcript text.
7. Rollback disables the publisher and leaves stored versions readable under member gates. Do not revert access protection or destructive schema migrations. Keep immutable receipts; fix forward after identifying the failing operation.

Retention: raw originals remain in organization's Drive under its policy. Keep no additional raw-original copy on the website. Before live enablement owner selects transcript/history retention from existing DAO records policy; do not infer an arbitrary deletion deadline. Until selected, staging uses synthetic data only. After selection, apply the same expiration to DB text, caches and backups under normal backup policy; preserve minimal operation/hash tombstones for deduplication. Withdrawal hides current/history content immediately; retention erasure is a separate authorized administrative operation, not a machine publisher privilege. Metadata/digests can still be sensitive and stay member-restricted.

## 8. Acceptance suite required before enablement

Run against real PostgreSQL transactions and route handlers, not only in-memory mocks:

1. No session → no list/detail/transcript/history/search data; authenticated nonmember also denied. Active qualifying member allowed. Suspended/expired member and expired role denied. Mixed level-0 and level-10 roles allowed through EXISTS. Expiry exactly now denied; inactive admin cannot bypass.
2. Direct server action invocation and all legacy URLs obey identical member policy. Private content never appears in shared cache, sitemap, feeds, llms.txt, HTML prerender, public document URL or unauthenticated error body. Two users with different ACLs cannot share a cached response.
3. Machine with correct scope publishes only configured collection/audience/author. Missing/revoked/expired credential or suspended responsible member denied. Receipt scope cannot enumerate another principal's data. Member knowledge scope cannot read arbitrary member profile/document records.
4. Concurrent identical operations (at least 20 requests) commit one publication and one projection. Concurrent distinct corrections from same parent commit one winner; losers get 412. No partial source/publication/projection survives injected DB failure.
5. Same operation ID/different exact bytes, changed metadata, changed audience, or changed transcript returns conflict. Source ID+revision with different source hash returns conflict. New source revision/correct parent commits. Old-operation replay after correction returns old receipt/current=false without rollback.
6. Shared golden vectors match current core outputHash/operationId for CRLF normalization, non-ASCII text, JSON escape characters and action owner=null. Wrong source/output/operation hash rejected at the responsible boundary. Website never claims to verify raw source bytes it did not receive.
7. Acknowledgment loss after commit resolves through readback without duplicate. Primary DB outage yields 503/unknown, not absence. 429 Retry-After honored. Revocation during retry stops. Purged operation returns 410 and cannot resurrect content.
8. Notes and transcript both round-trip unchanged. Full-line negation retained. Extracted decisions/actions clearly unverified, owner null; a model cannot set verifiedBy, official-ratification flags, destination or execution authority. Unsupported richer output rejected until its versioned policy is registered.
9. Knowledge list filters ACL before snippets/counts/pagination. Expired/revoked share denied on list/detail/content. An allowed document version changes between search/read → 409. Byte digest mismatch fails. Restricted citations stay internal to packet review; unauthorized external sharing is not automatic.
10. Legacy notes still render/edit for authorized members; managed correction never bypasses CAS; notes-only records have no invented transcript. Backfill dry-run and duplicate mapping remain safe. Retention/withdrawal suppresses historical content, with dedup tombstones retained.
11. Second administrator follows checklist from clean setup without developer assistance: can see published member record, revoke the integration, observe pending work stop and restore authorized configuration. Record receipts without source text or secrets.

## 9. Delivery order and owner checklist

Website team: (a) shared member/document policy and tests; (b) additive migrations/version service; (c) publisher + receipt routes; (d) protected portal display/corrections; (e) knowledge wrappers; (f) staging tests and canary. Inertia team: shared hash vectors, exact-byte HTTP adapter, receipt reconciliation and live source adapter once Drive access is available. These can proceed in parallel using synthetic fixtures.

Owner setup checklist:
- Confirm existing-notes members-only migration and membership lifecycle mapping.
- Choose existing authorized source folder/ready signal, first canary and bounded backfill range once access arrives.
- Approve scoped integration credential setup and exact grant-support document collection(s); no broad admin credential required.
- Select retention from DAO records policy and verify storage privacy.
- Website team supplies deployed base URL/contract version and passes acceptance suite; Inertia connects it.
- Second repo administrator performs independent rehearsal. Vocdoni example and Y2 workspace details are separate handoffs, not blockers for this website contract.

No request to collect applicant facts manually until authenticated retrieval produces a real gap. No production migration or credential step is authorized merely by merging this proposal.
