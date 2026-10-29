# Organization-shared machine reader — source candidate

`POST /api/org/knowledge` wraps the existing member source search/store. It performs no model call, ingestion, task creation or source mutation. This application serves one organization; no caller can select an organization, SQL query, URL, member or private document table.

It requires a distinct `MEMBER_APP_KNOWLEDGE_READ_TOKEN` bearer credential. An absent token denies every request. Member cookies, the ingest token and the reverse Paperclip reader are not read authority. Provisioning, machine ingress and native tool admission are separate operator tasks; this source candidate configures none of them.

Requests:

- `{ "operation":"search", "query":"technology workshops" }` returns the existing search's up-to-eight active organization-shared passages with sourceId,passageId,title,kind,location,text,contentHash,status. Search semantics and fallback are unchanged. A no-hit result is not proof of absence.
- `{ "operation":"find_by_hash", "contentHash":"<sha256>" }` returns exact active source identity, or null. It does not claim full-content readback.
- `{ "operation":"read", "sourceId":"<uuid>", "contentHash":"<sha256>", "offset":0, "limit":8000 }` returns a source identity and `page` with text,offset,end,nextOffset,textLength. Offsets count Unicode codepoints; limit is1..32000. Follow nextOffset to null, reconstruct all pages and verify the full UTF-8 hash. Offset above zero requires contentHash. Changed hash returns409; hidden/missing sources return null.

All results declare `audience:organization_shared` and `evidenceStatus:unverified_source_context`. Personal member documents/conversations are excluded. Responses use no-store. Input is bounded before parsing; source content is paged rather than silently truncated.

`src/organization-search/client.ts` supplies the funding-side bounded HTTPS reader/citation helper. It requires a server-provided authorization callback and secret resolver and checks authorization before and after HTTP. It does not register a native tool, create grants or accept applicant facts. A member passage ID is not a DFW case SourceDocument ID: a preliminary field keeps the exact member source/passage/hash citation in its rationale and uses `evidence_ids:[]` unless separately admitted case evidence exists.

Qualification is synthetic source/HTTP/PostgreSQL evidence. Real corpus→native funding-agent→saved field acceptance remains pending protected endpoint/reference configuration and native catalog admission. Notes may reuse read/hash operations only after reconstructing and verifying the complete source; an identity lookup alone is insufficient for lost-ACK import recovery.

## Funding plugin wiring (source candidate, not activated)

The additive `organization_search` plugin tool accepts only `{query}`. It is
registered in the real manifest/worker and is disabled unless an operator supplies
`organizationKnowledge` with a fixed endpoint, distinct read-token reference and
explicit project/root/agent bindings, with optional rootProjectId for cross-project case roots. It requires server-injected organizationExecution metadata and reuses current native ancestry/active-run
checks before and after HTTP, without adopting checkout. Endpoint/reference/actor
selectors cannot be supplied by a model. Native runner advertisement and its
public-scout exclusion require a separate reviewed native overlay; registration
alone does not grant or advertise the tool. No live credential or ingress has been
configured by this change.

Example protected configuration shape (synthetic references only):

```json
{"organizationKnowledge":{"enabled":true,"endpoint":"https://member.example/api/org/knowledge","readTokenRef":{"type":"secret_ref","secretId":"operator-owned-distinct-read-reference"},"bindings":[{"projectId":"internal-project","rootIssueId":"funding-root","allowedAgentIds":["internal-researcher","case-producer","case-reviewer"]}]}}
```

## Evidence and final review

A member passage is immediately useful as explicitly unverified drafting context:
retain sourceId/passageId/location/contentHash in rationale and use
`evidence_ids:[]`. It is not a case `SourceDocument` and never becomes an accepted
applicant fact through a citation string.

Existing DFW source-bound knowledge already supplies the authority path. Its
`ApplicantDocumentService.admit_uploaded_copy/admit_uploaded_path` ingests a
configured scanned copy; immutable ApplicantDocumentVersion and extracted
ApplicantDocumentFact carry hash, locator, audience and attribution. The existing
central knowledge propose/candidate/review/admit path independently reviews that
exact evidence. `organization_knowledge._sources` checks the current version,
clean scan, exact source hash/quote/locator and audience. Current admitted records
are selected by `select_knowledge` and projected by `knowledge_evidence` into
public drafting/organization context. Mere `register_external_document` leaves
`external_reference/awaiting_secure_access` and is insufficient.

Member shared access is not automatic public publication: current public case
context selects only `public` knowledge. Preserve the actual source audience;
internal member notes must not be relabelled public to cross that boundary. A
controlled member-read/hash → existing document-import adapter would be the
remaining source-copy seam if independently accepted applicant-fact use is needed.
No new knowledge registry or automatic fact promotion is proposed. Until then,
whole-packet review can inspect the cited draft context, but rationale text alone
cannot satisfy typed evidence, required verified facts or final readiness.

`privateHttpOrigins` is an optional operator-only list, empty by default. HTTP endpoints require an exact listed origin; HTTPS remains the ordinary default. The route path stays exactly `/api/org/knowledge`, credentials/query/fragment and redirects are denied. Production admission also requires the native SDK host to enforce that same protected route; this client field alone cannot bypass host SSRF policy.
