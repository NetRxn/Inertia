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

Interface: one POST with a discriminated operation: search{query}; read{sourceId}; find_by_hash{contentHash}. Server configuration fixes the organization/audience to active organization-shared sources. Search returns the existing bounded results with sourceId,passageId,kind,title,location,text,contentHash,status. Exact source reads return id/kind/title/contentHash/status plus bounded Unicode pages; reconstruct all pages and verify the complete hash. Hash lookup returns identity only, never a fabricated full-content receipt. No personal tables or write method. Missing MEMBER_APP_KNOWLEDGE_READ_TOKEN disables admission; constant-time bearer comparison uses a distinct read credential.

- [x] RED: actual store fixture contains a synthetic DAO mission passage plus hidden and personal-document controls. Missing/wrong token401; correct token returns exact active passage/citation/hash, read/hash lookup match; arbitrary selectors400; no mutation.
- [x] Implement the minimal handler and route over existing store functions, preserving search semantics.
- [x] GREEN: owning17tests plus app typecheck, actual HTTP/PostgreSQL source/hash/read/hidden/auth proof, and3funding-client citation tests passed. Independent source review and native SDK/catalog admission remain pending.
- [x] Inform peer issue40 of exact isolated paths/contracts; no instruction to manage their branch or deployment.

### Task2: Funding read adapter and case citation (owners: implement_host + native author)

Proposed owned new module src/organization-search/host.ts; do not edit the lifecycle author's src/case-work/host.ts. Resolve only the operator-provided read secret reference; reuse current native company/project/actor admission. Native author owns exact catalog advertisement/current-grant denial and any contract fingerprint change.

- [ ] RED/GREEN: actual SDK→HTTP→member store yields the synthetic DAO passage; revoked scope, foreign company and public Scout deny before HTTP; citation identity remains exact.
- [ ] Save a preliminary_field using current workspace_hash. Member passage IDs are NOT case SourceDocument IDs: use evidence_ids:[] and explicit citation ID/hash in rationale, labeled unverified organization context. No automatic legal-fact/relationship admission.
- [ ] Operator-only: stage protected endpoint/auth references, execute one real existing-corpus query and verify one proposed field/readback. No new rescan or member DB export.

**Acceptance:** a real admitted agent query returns an existing organizational passage and the same citation/hash survives a saved current-case field. UI /work success alone is not this forward wiring proof.

## Focused adversarial review — 2026-10-29

**ORG-1: ⚠ source reader exists; actual native admission/composition remains unproved.** Original integration Task2 and prior adversarial domain finding7 require organization context before case drafting with scoped actor and exact provenance. Current isolated `/tmp/inertia-member-knowledge-reader-20261029` is based on peer5049059e63d86fb4484e601a7854068d1a638dea; app read route and `src/organization-search/client.ts` now exist. Client rechecks injected authorize before/after HTTP, validates citations/hash, and creates an explicitly unverified preliminary field with evidence_ids empty. Its3-test log and typecheck are source evidence, not native wiring. Do not report reader source absent after this patch.

Native primitive: existing plugin tools/current actor authorization and delegation; [current delegation docs](https://docs.paperclip.ing/guides/org/delegation/) refreshed today and [pinned plugin host](https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/server/src/services/plugin-host-services.ts), matching inspected local native checkout. Native tasks do not automatically expose member assistant tools.

Root cause/minimum: client `authorize:()=>Promise<boolean>` leaves concrete admission to composition. implement_host + native owner must wire current company/project/assignment/grant checks and actual funding catalog to this client, preserve public Scout denial and separate read token. No second knowledge store/controller. Operator-owned endpoint/token references remain separate readiness.

Exact acceptance: actual native SDK/current actor→HTTP→existing store yields one real passage; current workspace save/readback retains identical sourceId/passageId/location/hash and uncertainty. Foreign company, revoked assignment/grant and public Scout deny before HTTP; hidden/personal sources remain absent. Rationale citation may inform proposed prose but is not a foreign SourceDocument ID or accepted eligibility/finance fact. Preserve earlier implementation sections.

## Source milestone (not deployment acceptance)

Isolated peer-base5049059 checkout `/tmp/inertia-member-knowledge-reader-20261029`; peer informed in issue40 comment6509619953. Existing `org/ingest.ts` and DB schema are unchanged. New read handler reuses search/getSource and adds exact active hash lookup. HTTP/PG proof `/tmp/inertia-member-reader-http-pg-proof-20261029/green.log`; owning `/tmp/inertia-member-knowledge-reader-green.log`; client `/tmp/inertia-member-reader-client-green.log`. No production corpus read, token creation or native tool registration occurred. Real research-agent→corpus→saved-case proof remains ⚠ until those concrete bindings are installed.
