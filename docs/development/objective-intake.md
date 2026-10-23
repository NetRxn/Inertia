# Objective intake and opportunity briefs

Local Task 8 implementation. This is a tested caller/domain seam, not a deployed website integration or permission grant. Existing Task 8 design remains authoritative. No worker job, enabled connection, external endpoint, or manifest capability is added by this slice.

## Source owner and inspected public schema

Public `FWTX-DAO/dao-platform` source pinned at `d9654bd9c988f65f7b940fd8acb3d6c05f51c377`, `src/core/database/schema.ts`, was inspected before implementation. The existing `innovation_bounties` table owns ID, submitterId, title, problemStatement, useCase, desiredOutcome, technicalRequirements, constraints, deliverables, status and timestamps. `bounty_proposals` links bounties to existing project IDs; `projects` and `project_updates` already exist. Reuse those identities and do not create competing website objects. Source URL: https://github.com/FWTX-DAO/dao-platform/blob/d9654bd9c988f65f7b940fd8acb3d6c05f51c377/src/core/database/schema.ts

The schema also has contact/address/IP, anonymous and screening fields. None is automatically exported. `isAnonymous` must not be treated as public authorization to reveal a submitter. `updatedAt` alone is not a collision-proof revision token, and neither a status string nor schema presence proves audience policy. There is no verified live machine bounty revision/withdrawal API in this work.

A future trusted source adapter must derive tenant, authorRef and audience from authenticated website policy; expose the current complete objective text without promoting it to instructions; and supply an opaque revision, content hash and prior hash chain. The original canonical website record remains authoritative. Export composition, membership revocation, historical access and real server rollout require the website owner's qualification.

## Contract and durable mapping

`ObjectiveSubmission` includes source system/ID, organization, opaque revision, original attribution/title/text, audience, withdrawal flag and expected previous hash. `objectiveHash` is SHA256 of UTF-8 JSON of the ordered fields in `src/intake/service.ts`, excluding sourceHash itself. It binds metadata and text; it is an export digest, not a hash of text alone. Source IDs distinguish equal-text independent submissions. No lexical or numeric revision comparison occurs.

`ingestObjective` first re-reads the authorized current source, never trusts event authority. Its unique key is SHA256 of `[organizationId, sourceSystem, sourceId]`. Migration 007 stores private mapping/current snapshot plus append-only snapshot history. One scalar-parameter SQL CAS acquires each version. No lease expiry or automatic claim takeover exists.

Each claim first checks exact native origin, then revalidates source currency. One existing matching marker/key/company is reconciled; conflicting origins fail closed. Each claim permits one native mutation. A failed or lost response stays pending. A subsequent exact origin lookup can reconcile one matching issue/marker; unknown, absent-after-dispatch or conflicting results never authorize a duplicate create. If a claim was acquired but the source changes before native I/O, it is aborted/restored while history remains. A crash before dispatch may conservatively require operator reconciliation. Resolving a permanently uncertain claim requires verified native outcome and stopped old worker; this slice deliberately exposes no unsafe automatic reset.

The first delivery may be the current revision after missed older events. Once a mapping exists, corrections require exact expectedPreviousHash matching the applied snapshot. A missed intermediate revision therefore returns conflict until a trusted source supplies/reconciles the chain; no invented revision ordering or silent overwrite occurs. Withdrawals retain source history and cancel the linked native item; stale prior deliveries cannot restore it.

## Native ownership and permissions

`createNativeObjectiveAdapter` uses actual pinned Paperclip SDK issue list/get/create/update methods, plugin origin and a revision marker. It creates one general backlog item assigned to the configured CEO intake agent. Later updates preserve native priority, parent, goal and assignee. Similar objectives can be attached to a shared existing native goal without merging attribution. DFW owns many-to-many opportunity links, not another task queue.

Native issues intentionally contain only a generic title and opaque mapping/revision references. Company visibility is not equivalent to website member permissions, and `surfaceVisibility` is not an ACL. Original text and submitter attribution stay in the permission-checked source/private mapping. A production member workspace needs an authorized source-resolution tool; do not put protected source text into issue descriptions to work around that requirement. Source withdrawal cancels task work but grants no adoption, application submission or external authority.

`projectObjectiveProgress` is a read-through view of native task status/priority/goal, not a queue or copied workflow. It validates source authorization, exact source snapshot, native identity and marker, then rechecks source currency. Narrowed/withdrawn/stale/unknown sources suppress output immediately. It never copies private native comments/results into broader website audiences. A native `done` status means native task completion only, not successful grant submission, human signoff or an adopted motion. Website/Buzz serving adapters must call this scoped view rather than cache public snapshots without revocation checks.

## Opportunity brief and research loop

`OpportunityBrief` matches DFW `opportunity-brief-v1`. A captured synthetic Python-produced JSON fixture is rendered by the TypeScript test, including unknown minimum award values, three distinct effort phases, project alignment, partner checks, artifacts/hashes, exact scoped decisions and information owners. The canonical DFW builder verifies current packet and admitted source access; packet.content_hash binds canonical DFW packet_data and is not the frozen submission/vote snapshot hash. Project alignment and partner-role prose remain cited proposals, not independently verified active project status; the renderer is a pure escaped Markdown formatter, not an authority check or an independent semantic reviewer.

`prepareOpportunityBrief` reuses `runPartnerResearch`: query saved knowledge, research remaining gaps, durably commit useful delta or an explained reuse receipt, then fetch the current authorized brief. It returns the knowledge receipt and pending graph projection state alongside the rendered brief. A failed commit cannot masquerade as completed research. Meeting decisions remain inputs to the existing trusted knowledge/review adapters, never fabricated by a brief or task completion. Refresh the source/packet and rerun this loop after admitted decisions.

The renderer supplies native-document-ready Markdown, but this slice does not automatically publish protected documents to a company-wide issue or website. Actual native document publication needs a qualified audience-aware source adapter and configured issue binding. No broad new manifest permissions are silently enabled.

The synthetic example recommends deferring a small award while comparing higher-value opportunities against application and delivery effort. It is not a live Walmart application or a dollar cutoff. No account setup, facility lookup, application preparation, outreach or external submission occurs. Existing verified evidence remains reusable in its owning domain.

## Qualification and remaining gates

Focused tests cover replay/concurrent create, opaque revisions, hash mutation, stale/CAS chains, uncertain native outcomes, tenant mismatch, attribution separation, withdrawal, pre/post-write source races and audience suppression. PGlite exercises actual mapping SQL and restart/CAS behavior. SDK tests exercise the exact SDK shape against deterministic fixtures, not a running native host. Cross-language fixture rendering is distinct from deployed DFW connectivity.

The combined meeting-answer → admitted scoped knowledge → native follow-up → revised brief rehearsal remains pending; isolated source, research-receipt and renderer tests do not prove that full loop.

Required before live admission: real website export/auth policy, native lookup completeness and origin behavior, real host migration/query compatibility, authorized CEO/organization/company mapping, protected source retrieval, database role isolation and retention, source revocation propagation, audience-safe document serving and native document publication. No deployment or live qualification is claimed.
