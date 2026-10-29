# Organization search Implementation Plan

> **For agentic workers:** Execute the approved tasks in this session; use superpowers:executing-plans. Source review and live acceptance are separate.

**Goal:** Let an admitted funding research agent query the existing member corpus and retain exact citations in proposed case work.

**Architecture:** Expose the existing searchPassages/getSource store through one app-owned read handler. Add only the funding read adapter and its native admission, then use existing preliminary save/checkpoint; do not copy the database or create another knowledge store.

**Tech Stack:** Existing TypeScript, native Paperclip SDK, PostgreSQL/Drizzle, bounded HTTP and protected secret references; no new platform.

**Spec:** /tmp/inertia-member-knowledge-contract-20261029/source-contract-findings.md

## Global constraints

- Preserve existing data, native authority, provenance, genuine holds and peer active checkouts.
- No credential values, cookies, provider logs or real Buzz posts in source or receipts.
- Test fixtures are synthetic. A known-DAO-style fixture is not a verified production fact.
- Page/response limits bound transport, not the amount of work the agents may perform.
- Source-qualified, deployed, observed and business-accepted are distinct states.

## Approaches and current decision

Use the existing app query behind a small service-read route, as requested in issue40 comment6507891692. Direct member DB credential reuse would hand a writer to agents; member-cookie chat and mutation-capable Pursue are not machine readers. The parent authorized an isolated peer-base patch; do not touch the partner active checkout.

## Clean versus ⚠

- CLEAN: freshly fetched peer head5049059e63d86fb4484e601a7854068d1a638dea; apps/member source unchanged after ecb64a0. Existing active-only English full-text search and OR fallback are reusable.
- CLEAN: existing getSource and contentHash support exact readback. Personal documents/conversations are separate tables and remain excluded.
- ⚠ No verified forward READ token/secret reference or machine ingress exists. Runtime activation remains blocked until operator/app owner supplies protected references; never reuse ingestion or reverse Paperclip reader credentials.
- ⚠ Funding native catalog grant and current actor/project selection still need a separately reviewed native-owner slice. No internal reader for the public Scout.

## Review focus

Wrong/missing credential denies; hidden sources and personal documents stay absent; arbitrary organization/URL/SQL selectors deny; source IDs/hash survive into case rationale; zero hits never means verified absence.

### Task1: Existing-store machine read handler (owner: implement_host, isolated peer base)

Files: create apps/member/src/org/machine-reader.ts and apps/member/src/app/api/org/knowledge/route.ts; minimally extend org/ingest.ts search projection with stored contentHash/status and source identity. Test test/org-machine-reader.test.ts plus a disposable real HTTP/PostgreSQL proof.

Interface: one POST with a discriminated operation: search{query}; read{sourceId}; find_by_hash{contentHash}. Server configuration fixes the organization/audience to active organization-shared sources. Search returns the existing bounded results with sourceId,passageId,kind,title,location,text,contentHash,status. Exact source reads return id,kind,content,contentHash,status or null. No personal tables or write method. Missing MEMBER_APP_KNOWLEDGE_READ_TOKEN disables admission; constant-time bearer comparison uses a distinct read credential.

- [ ] RED: actual store fixture contains a synthetic DAO mission passage plus hidden and personal-document controls. Missing/wrong token401; correct token returns exact active passage/citation/hash, read/hash lookup match; arbitrary selectors400; no mutation.
- [ ] Implement the minimal handler and route over existing store functions, preserving search semantics.
- [ ] GREEN: owning tests and actual HTTP/PostgreSQL prove the same source/citation, hidden-source exclusion and no writes; independent review before publication.
- [ ] Inform peer issue40 of exact isolated paths/contracts; no instruction to manage their branch or deployment.

### Task2: Funding read adapter and case citation (owners: implement_host + native author)

Proposed owned new module src/organization-search/host.ts; do not edit the lifecycle author's src/case-work/host.ts. Resolve only the operator-provided read secret reference; reuse current native company/project/actor admission. Native author owns exact catalog advertisement/current-grant denial and any contract fingerprint change.

- [ ] RED/GREEN: actual SDK→HTTP→member store yields the synthetic DAO passage; revoked scope, foreign company and public Scout deny before HTTP; citation identity remains exact.
- [ ] Save a preliminary_field using current workspace_hash. Member passage IDs are NOT case SourceDocument IDs: use evidence_ids:[] and explicit citation ID/hash in rationale, labeled unverified organization context. No automatic legal-fact/relationship admission.
- [ ] Operator-only: stage protected endpoint/auth references, execute one real existing-corpus query and verify one proposed field/readback. No new rescan or member DB export.

**Acceptance:** a real admitted agent query returns an existing organizational passage and the same citation/hash survives a saved current-case field. UI /work success alone is not this forward wiring proof.
