# DAO website: member publication and authoritative knowledge contract

Status: website implementation proposed; Inertia caller merged and contract-tested at [f9423e5](https://github.com/NetRxn/Inertia/tree/f9423e5f12e0b8ee9df4d9614da2a6871c741ffb). Website deployment and credential provisioning pending.

Owners: John, website rollout; Inertia, caller/adapter. Version 1, 2026-10-23.

The [v1.1 addendum](dao-website-publication-v1.1-clarifications.md) specifies receipt fields, metadata bounds and shared synthetic fixtures. Wire version and digest algorithms remain unchanged.

## 1. Outcome and boundaries

After authorized setup, ready Roundtable sources publish separate transcripts and notes to the member portal. Retries deduplicate; corrections create visible versions with concurrency protection. Routine publication requires no per-meeting vote or approval. Missing inputs, conflicts and policy violations block publication and raise actionable exceptions.

The deployed agent retrieves authorized governance, formation and organizational sources for grant applications. The DAO website is the organizational source of truth. Search authenticated holdings before declaring a source gap or requesting manual fact collection.

Paperclip retains work/agent authority; Buzz remains its conversational surface. Scope excludes new task engines, vector databases, graph stores, identity providers and governance workflows. Vocdoni decisions and external grant submission remain separate operations.

## 2. Inspected source and changes required

Website review pinned to [FWTX-DAO/dao-platform d9654bd](https://github.com/FWTX-DAO/dao-platform/tree/d9654bd9c988f65f7b940fd8acb3d6c05f51c377). Recheck changes before implementation. Target: Next.js platform; the Astro website repository is out of scope.

- [Meeting actions](https://github.com/FWTX-DAO/dao-platform/blob/d9654bd9c988f65f7b940fd8acb3d6c05f51c377/src/app/_actions/meeting-notes.ts): list/detail/create use requireAuth; edit/delete allow author or admin. Existing fields: title, date, attendees, agenda, notes, actionItems, tags. No stable machine ingestion HTTP route.
- [Schema](https://github.com/FWTX-DAO/dao-platform/blob/d9654bd9c988f65f7b940fd8acb3d6c05f51c377/src/core/database/schema.ts): meeting_notes has text fields and author_id, timestamps; no transcript, audience or publication revisions. members has status/expiresAt; member_roles has isActive/expiresAt; roles has level. documents has Pinata/CID metadata; document_shares has expiry.
- [Auth](https://github.com/FWTX-DAO/dao-platform/blob/d9654bd9c988f65f7b940fd8acb3d6c05f51c377/src/app/_lib/auth.ts): Reuse Privy session verification and the existing membership/RBAC tables through a centralized policy helper; the new portal contract explicitly requires active membership, role expiry and status checks.
- [Document actions](https://github.com/FWTX-DAO/dao-platform/blob/d9654bd9c988f65f7b940fd8acb3d6c05f51c377/src/app/_actions/documents.ts): Reuse the existing uploader/admin/public/share permission model and document storage. The new contract requires consistent resource-scoped authorization on search, detail and content, including share expiry.
- [Existing bearer route pattern](https://github.com/FWTX-DAO/dao-platform/blob/d9654bd9c988f65f7b940fd8acb3d6c05f51c377/src/app/api/admin/member-emails/route.ts) demonstrates server-side constant-time bearer verification. Reuse the pattern, never its broad export credential or permission.
- Inertia baseline [f9423e5](https://github.com/NetRxn/Inertia/tree/f9423e5f12e0b8ee9df4d9614da2a6871c741ffb): [Roundtable core](../../src/roundtable/ingestion.ts), [HTTP caller](../../src/roundtable/website.ts) and [integration plan](../development/roundtable-ingestion.md). Caller merged and contract-tested; website implementation and live integration pending.

## 3. Authorization: one policy service used everywhere

Introduce reusable server-side policy helpers, retaining Privy and the existing RBAC tables:

1. Active member means members.status = 'active', member expiry null or strictly later than database now, and EXISTS an active, unexpired member_roles row joining roles.level >= 10. Use EXISTS, not lowest-role selection. Expiry equal to now denies. Owner confirms this portal policy and membership lifecycle mapping at rollout. Require a paid subscription only if DAO policy specifies it.
2. Reads require that active membership predicate. Admin privileges for this surface additionally require active membership and an unexpired existing admin-role assignment. Expired admin roles deny access.
3. Every meeting list, detail, search, server action, API, transcript download and historical-version read applies the same gate. Authorize before sending protected records into client props.
4. Existing human author/admin edit rights remain, after membership authorization. Managed publications go through the revision service; legacy updates may not bypass version/CAS checks. Recommended v1 UI: a dedicated managed-record correction action and the existing legacy-record editor.
5. Machine requests authenticate a dedicated, revocable integration principal, not a browser cookie, copied admin token or caller-supplied authorId. Configure one responsible active member user and scope set. Verify that account remains active on every request; removing membership or revoking the principal stops its access.
6. Scopes: roundtable:publish and roundtable:receipt for one configured collection; dao:knowledge:read for explicitly approved document IDs/collections. The machine cannot change audiences, share documents, grant membership, select another author, or read member profiles. Receipt scope permits full readback only of publications owned by that principal/collection. Knowledge access remains resource-scoped.
7. Store only a random integration credential's digest, key ID, expiry, revokedAt, scopes, responsible user and approved resource constraints. Use HTTPS and constant-time digest comparison; enforce expiry/revocation per request, rate limits and content-free audit events. Provisioning/rotation is a separately authorized deployment step. An environment-held digest configuration can replace a table for the single demo principal, with identical semantics; no credential-management UI is required.
8. Documents additionally require existing per-document ACL, augmented with non-expired shares and active document status. The machine must satisfy BOTH its resource allowlist and the responsible user's effective ACL. Allow public documents explicitly; require document-specific authorization for private files. Apply the predicate before search pagination/count/snippets, not after returning metadata.

For protected responses use Cache-Control: private, no-store; do not place them in shared Next.js/Cloudflare caches, feeds, sitemap, public llms.txt, static exports or unauthenticated search. Render text safely; strip executable markup/links from generated rendering rather than executing transcript instructions. File access must reauthorize through the server. For member-only transcripts prefer DB text in v1; do not upload them to public IPFS/Pinata or reveal permanent public object URLs.

## 4. Minimal additive persistence

Use existing Drizzle migrations and PlanetScale PostgreSQL transactions in the shared DAO relational database. Website/meeting objects remain Drizzle-owned; funding objects use an isolated Alembic-owned schema and separate least-privilege role. Scope introspection and migration history so neither tool manages the other domain. Existing unqualified website tables need an explicit ownership inventory before any namespace move; do not rename them blindly. Shared storage does not bypass the API policy or expand document/member access. See [storage contract](../development/dao-data-consolidation.md). Wire/digest versions are unchanged. Proposed schema:

### meeting_notes additions

- audience text NOT NULL DEFAULT 'members', CHECK audience = 'members' for this feature.
- managed_collection text NULL; external_meeting_id text NULL; current_publication_id text NULL.
- UNIQUE(managed_collection, external_meeting_id) when both present. IDs must be opaque, stable source identities; title/date matching is prohibited.
- Existing author_id remains a valid users FK: server sets the integration's responsible user. Audit separately records integration principal. Existing text columns become a compatibility projection of the current publication.

### meeting_source_versions

- id PK; meeting_note_id FK; source_id text; source_revision text; source_hash char(64); created_at.
- UNIQUE(meeting_note_id, source_id, source_revision). Immutable binding to one source_hash. Reuse with a different hash is a conflict, even if output differs.
- Source revision is opaque. Never sort revision strings to decide which is newer. The Drive adapter resolves order/readiness and retains originals in the authorized Drive folder. Website storage is limited to provenance and publication content.

### meeting_publications

- id PK; meeting_note_id FK; source_version_id FK; integration_id; operation_id char(64); request_body_hash char(64); output_hash char(64); previous_publication_id nullable FK; previous_output_hash nullable; output_version text; audience text CHECK = 'members'; transcript text; structured_notes jsonb; envelope jsonb; created_at; content_purged_at nullable.
- UNIQUE(integration_id, operation_id); UNIQUE(meeting_note_id, output_hash). Immutable versions. Exact client envelope retained for readback; do not reconstruct it from lossy presentation fields.
- Store metadata snapshot (title/date/attendees/agenda/tags) with the publication so corrections are reconstructable. UTF-8 body digest covers metadata as well as the publication envelope.
- Existing meeting_notes.current_publication_id points at the committed version. Foreign keys and ownership checks prevent a pointer to another meeting. Insert source/version, publication and compatibility projection in ONE transaction.
- Retain operation IDs and digests as tombstones when content is purged so old deliveries cannot resurrect deleted content. Purged receipts return 410, not authoritative absence. Deletion/withdrawal must create a managed tombstone and revoke content access, not cascade-delete the only dedup evidence.

Inertia schedules retries; the website stores durable receipts. One publication table plus deduplicated source rows is sufficient. Add no ingestion queue/ledger or workflow state tables without a concrete need.

## 5. Proposed HTTP contract

Proposed additive Next.js routes under /api/integrations/v1 share a revision service with managed human corrections.

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

Only these root/meeting/publication keys are accepted for v1. Reject duplicate JSON object keys, non-finite numbers, invalid UTF-8, unknown output versions and oversized bodies. Limits: 4 MiB encoded body and 2,000,000 transcript UTF-16 code units; return actionable 413 without truncation. ISO date must be the DAO meeting date, supplied independently of upload time. Collection/author/audience are checked against server policy, not derived from generated notes. Reject a supplied audience other than members; do not silently convert it.

Success 201 for new commit, 200 for exact replay:

```json
{"state":"present","publicationId":"p_example","meetingNoteId":"m_example","operationId":"<digest>","outputHash":"<digest>","requestBodyHash":"<digest>","audience":"members","current":true,"readbackPath":"/api/integrations/v1/roundtables/operations/<digest>"}
```

Response ETag is quoted outputHash. A replay of an older version returns its original receipt with current=false and never moves the current pointer backwards.

### Receipt and human reads

GET /api/integrations/v1/roundtables/operations/{operationId} requires roundtable:receipt scope and collection/principal ownership. 200 includes immutable full publication envelope, meeting metadata, body digest, current flag and currentOutputHash. 404 {"code":"operation_absent"} means an authorized query against the primary database found no row. Cross-scope rows return generic 404 without leaking existence; the adapter's scoped identity must stay fixed for an operation. Database outages/timeouts return 503. 410 means a durable withdrawn/purged operation.

Member UI uses existing meeting routes and shared policy service; provide a protected transcript/version read endpoint only if required by that UI. Machine receipt never emits a public URL. Human member reads of history use the same audience and ACL as current content.

### Exact bytes, hashes and future formats

The sender serializes the HTTP body ONCE to UTF-8 and persists/reuses those bytes for all retries of that operation. Server computes SHA-256 over exactly those bytes before parsing; store request_body_hash. Whitespace/key-order changes with the same operation ID return 409 idempotency_key_reused. A caller wanting different title/metadata must issue a new correction operation; see adapter compatibility below.

Current core outputHash is SHA-256(UTF8(JSON.stringify([meetingId, sourceId, revision, sourceHash, audience, transcript, notes, outputVersion, expectedPreviousOutputHash]))). operationId is SHA-256(UTF8(JSON.stringify([meetingId, sourceId, revision, sourceHash, outputHash]))). Preserve current JavaScript array/object serialization and JSON escaping exactly for extractive-v1; publish shared golden vectors for Unicode, newlines, action owner=null and property order. No generic JSON canonicalization may silently change these hashes. Server validates those hashes using the shared codec and validates full-line citations against normalized transcript. sourceHash refers to original pre-normalization UTF-8 source, not the normalized transcript; server records this as adapter-attested provenance because raw originals are not sent. The authorized source adapter verifies originals before sending.

Metadata is not included in today's core outputHash. Therefore freeze meeting metadata for the lifetime of an extractive-v1 core operation; a metadata-only change cannot reuse its operation ID. Implement a versioned adapter envelope/operation codec covering metadata before enabling metadata-only machine corrections. Until that codec is implemented, report metadata-only corrections as unsupported. Human managed corrections also require a new versioned codec.

Validate outputVersion through an explicit extensible registry. extractive-v1 renders candidates as unverified with full source context and unknown action owners. Future reviewed formats may support summaries, structured verified owners and richer evidence. New format requires a schema, digest codec and validation tests. Human verification stores verifiedBy/verifiedAt/evidence in an append-only authenticated annotation or new publication version, never accepts machine-supplied human attribution. Distinguish transcript quotations, candidate decisions and formally ratified decisions. Published candidates grant no execution or submission authority.

### Atomic algorithm and errors

1. Authenticate/scope-check, size-limit/read exact bytes, validate schema/hashes/audience and header consistency.
2. In a transaction, obtain/insert the meeting row via its unique collection+external ID and lock that row FOR UPDATE. On insertion unique conflict, retry select/lock.
3. Check existing operation first. Same principal/key/body hash returns original committed version even if the current version advanced. Different body hash returns 409.
4. Verify source ID+revision/hash binding. For a correction require expectedPreviousOutputHash and If-Match to equal the current output hash; first publication requires no current version and If-None-Match *. Missing precondition is 428; mismatch 412. Two contenders at the same parent produce exactly one winner.
5. Insert immutable rows, update current pointer and legacy projection atomically, commit, then invalidate only protected route caches. An invalidation failure must not roll back evidence or cause duplicate creation; readback is authoritative.
6. Concurrent same-operation inserts reconcile the unique constraint and return the stored matching receipt. Any SQL exception rolls back all writes. Do not report success before commit.

Error JSON: {code, retryable, requestId}; optional safe field path, never transcript or credentials. Codes/statuses: 400 invalid_payload; 401 authentication_required; 403 scope_denied; 409 source_revision_changed / idempotency_key_reused; 412 stale_publication; 413 body_too_large; 422 unsupported_output_version / invalid_evidence / audience_mismatch; 428 precondition_required; 429 rate_limited + Retry-After; 503 unavailable. Unauthorized responses disclose no meeting metadata.

On write timeout, lost response or 5xx, caller reads its operation receipt before retrying the exact body. On 429 honor Retry-After with jitter. On 412/409 do not auto-rebase or overwrite: reread current state and raise a content-free exception for resolution. On 401/403 pause the integration rather than hammering. Full readback must match content, hashes, source binding and audience before Inertia reports success. Unknown remains pending. 410 stops replay and raises a withdrawal/retention outcome; recreation is prohibited.

## 6. Authoritative DAO knowledge for grants

Reuse documents/document_shares and existing authorized storage. Extract a common permission predicate from document actions; require list/detail/download consistency and valid, unexpired shares. Existing detail/download actions can remain for portal UI. Add machine HTTP wrappers; scraped session cookies are prohibited.

Proposed endpoints:

- GET /api/integrations/v1/knowledge?query=<text>&category=<optional>&cursor=<opaque>&limit=20. Require dao:knowledge:read; return only authorized active documents with stable cursor and max limit 50. Minimum response item: id, title, category, sourceKind, version, sha256 (nullable until content actually read), updatedAt, accessClass (public/member/restricted), canonicalPortalPath, authorityStatus (unclassified/current/superseded), effectiveDate (nullable). Unknown authority status must remain unclassified. No excerpt from an unauthorized document, no global counts.
- GET /api/integrations/v1/knowledge/{id}?version=<version>. Repeat ACL/scope checks, return metadata + content descriptor. Version mismatch returns 409 version_changed, never substitute silently. Missing or inaccessible resources return generic 404. Authorization/index failures leave source availability unresolved.
- GET /api/integrations/v1/knowledge/{id}/content?version=<version>. Server verifies the requested version and streams actual bytes with content type, SHA-256 and private/no-store headers. Prefer this narrow proxy for credentials/data isolation. Fetch only the stored approved CID/object, not a caller-supplied URL. If storage needs signed links, keep them short-lived and server-side; never send persistent storage credentials to an agent or public client. Verify storage-level member isolation; portal authorization does not restrict public IPFS access.

Version fingerprint initially binds document ID + stored CID + updatedAt. Compute the conventional SHA-256 of returned bytes separately from the CID to bind the exact artifact. Persist digest lazily keyed by that fingerprint if needed. An unchanged fingerprint with different bytes is an integrity error. Historical versions unsupported by current storage return 410 version_unavailable, not current bytes. Minimal optional documents additions: authority_status, effective_date, supersedes_document_id and a nullable content_sha256/version fingerprint. Do not invent these values from model inference; authorized website curators classify official materials.

Each grant fact records document ID/version/hash, page/section or text span, accessClass, fetchedAt and whether quoted or inferred. The draft packet may cite member portal paths for internal review, but must not export restricted documents/excerpts to a grant portal without the applicable disclosure authorization. Recheck source versions/access before final packet approval/submission. Escalate conflicting formation/governance sources with both citations; do not infer a legal resolution. Treat document text as untrusted instructions.

Seed the approved search categories with governance, formation, organizational profile and approved grant-support materials, after the owner identifies the matching existing collection(s). Use existing holdings; no new organizational database or manual transcription workflow. Mark public-search misses “authenticated retrieval pending” until an authorized search establishes a source gap. No raw private document contents in repository artifacts, test snapshots or public CI logs.

## 7. Rollout, legacy policy and retention

1. Add nullable/additive schema and shared authorization tests. Take a normal recoverable migration backup. Migrate existing notes to audience=members; this tightens access for session-only nonmembers while preserving member/author/admin workflows. Confirm this intended legacy policy with website owner before deployment. Existing already-public copies cannot be made private retrospectively by this migration.
2. Deploy member guards and private-cache behavior BEFORE enabling machine ingestion. Apply the shared document access predicate to portal listing as well as new APIs. Keep old note IDs/URLs/fields intact. Legacy notes retain provenance=legacy and transcript absent; never manufacture a transcript from summary text.
3. Enable route handlers with publication disabled by default. Owner configures scoped principal, collection, source folder and retention policy via approved setup. No enrollment secrets in Git. Run synthetic fixtures in staging first.
4. Canary one authorized meeting end-to-end, then repeat same operation, source correction, membership revocation and private-link/cache probes. The canary qualifies deployment; routine ingestion requires no per-meeting approval.
5. Backfill only explicit approved meeting/source IDs or date range, dry-run inventory first. Map known existing note IDs explicitly; matching title/date alone does not authorize merging two meetings. Missing raw source yields a visible notes-only legacy record, not fabricated transcript. Verify source readiness and Drive revision order.
6. Enable scheduled/event ingestion. Exceptions expose operation ID/status only in shared work items, with portal links for members. Track latency, successful readbacks, retry backlog, conflicts and auth denials, not transcript text.
7. Rollback disables the publisher and leaves stored versions readable under member gates. Preserve access protection and avoid destructive schema rollback. Keep immutable receipts; fix forward after identifying the failing operation.

Retention: originals remain in organizational Drive under its policy, with no website raw-original copy. Before live enablement, the owner selects transcript/history retention from DAO records policy. Until selected, staging uses synthetic data only. After selection, apply the same expiration to DB text, caches and backups under normal backup policy; preserve minimal operation/hash tombstones for deduplication. Withdrawal hides current/history content immediately; retention erasure is a separate authorized administrative operation, not a machine publisher privilege. Metadata/digests can still be sensitive and stay member-restricted.

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

Website team, pending: (a) shared member/document policy and tests; (b) additive migrations/version service; (c) publisher + receipt routes; (d) protected portal display/corrections; (e) knowledge wrappers; (f) staging tests and canary.

Inertia team: shared hash vectors, exact-byte HTTP caller and receipt reconciliation merged and contract-tested. Live source adapter pending Drive access. Coordinate server implementation against synthetic fixtures.

Owner setup checklist:
- Confirm existing-notes members-only migration and membership lifecycle mapping.
- Choose existing authorized source folder/ready signal, first canary and bounded backfill range once access arrives.
- Approve scoped integration credential setup and exact grant-support document collection(s); no broad admin credential required.
- Select retention from DAO records policy and verify storage privacy.
- Website team supplies deployed base URL/contract version and passes acceptance suite; Inertia connects it.
- Second repo administrator performs independent rehearsal. Vocdoni example and Y2 workspace details are separate handoffs, not blockers for this website contract.

Production migration and credential provisioning require separate authorization.
