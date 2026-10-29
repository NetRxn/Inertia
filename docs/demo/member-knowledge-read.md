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
