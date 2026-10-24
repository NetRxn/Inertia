# Needed from team

Inertia integration checklist · Updated 2026-10-24 · Baseline INERTIA-2026-10-24-r17

Start with P0 for the connected demo; P1 enables ongoing operation. John owns website rollout, a teammate owns Y2, and Inertia engineering deploys Paperclip and connects the existing Buzz instance. Other owner labels below are roles to assign.

First handoffs: website API/test target (NTF01), Drive examples/access (NTF03), deployment/runtime configuration (NTF04–06), and the actual Buzz/Vocdoni/Y2 contracts (NTF07–10).

Reply with: **NTF ID · responsible person · protected reference · ready/missing · next action.** Use secure references for credentials, private records and member identities; keep them out of this artifact and public Git.

All handoffs initially remain **needed**. Update an entry to **received**, **qualified** or **superseded**, with dated evidence; input receipt and live qualification are separate milestones.

## John and the website implementer

### NTF01 P0 Member only publication API

- [ ] Send the test origin, deployed route/schema version and secure reference to the scoped machine principal. Include one sanitized first-publication request/readback and one correction/conflict example. Confirm service-write scope and continued active membership of its responsible member, active-member reads, immutable operation lookup, audience and content/hash/version fields; identify deviations from the [publication proposal](https://github.com/NetRxn/Inertia/blob/develop/docs/integrations/dao-website-member-publication-proposal.md) and [v1.1 clarifications](https://github.com/NetRxn/Inertia/blob/develop/docs/integrations/dao-website-publication-v1.1-clarifications.md).

**Unlocks:** Automatic transcript/notes publication with verified retries and corrections. Caller is contract-tested; server rollout and live publication admission are next.

### NTF02 P0 Objective feed and knowledge reads

- [ ] Send the approved machine route or export for innovation-bounty submissions and permitted DAO/member/project/meeting records. Include one sanitized submission and its update/withdrawal, stable IDs, revision/order, visibility and access scope. Identify where current membership and adopted decisions can be read. Engineering can qualify existing exports against the [intake contract](https://github.com/NetRxn/Inertia/blob/develop/docs/development/objective-intake.md).

**Unlocks:** General native backlog intake and authoritative DAO fact reuse. Intake and knowledge cores are merged.

## Drive administrator and meeting owner

### NTF03 P0 Real Gemini sources

- [ ] Share protected references to approved folders, the read principal and actual transcript-plus-notes and corrected-source examples. Include a summary-only example if produced. Supply existing DAO meeting identifiers/date and separate Gemini-notes references. Engineering derives Meet-to-Drive mappings and FILE_GENERATED readiness from the API; provide an explicit mapping only where the API lacks it. Confirm permitted member-portal publication and retention/withdrawal rules for originals, derived records and private operation state. See [source contract](https://github.com/NetRxn/Inertia/blob/develop/docs/development/roundtable-ingestion.md).

**Unlocks:** Real source ingestion, fidelity checks and versioned publication. Preparation and website caller are tested.

## Platform and database operator with domain owners

### NTF04 P0 Deployment and database target

- [ ] Confirm the Paperclip target, canonical HTTPS domain and DNS/TLS operator. Confirm the existing DAO PostgreSQL provider/version, including whether it is 18.2, schema/role support and PostGIS availability. Supply protected source/target references and access for engineering’s read-only inventory, the backup/restore owner and an isolated restore target. Confirm Drizzle website/meeting ownership, Alembic funding ownership and independent Paperclip persistence. See [storage contract](https://github.com/NetRxn/Inertia/blob/develop/docs/development/dao-data-consolidation.md).

**Unlocks:** Deployment and migration/restore qualification on the selected target. Disposable PG/PostGIS and native-service checks have passed.

### NTF05 P0 Runtime and tool access

- [ ] Provide approved existing model/runtime and browser/search/domain-tool access with scoped connection references. Engineering verifies the tool inventory and creates/configures the research agent. Identify the intended DAO company/admin and existing CEO if present. Confirm pilot spend limits and native hiring-approval policy. Engineering prepares the deployment and [native intake setup](https://github.com/NetRxn/Inertia/blob/develop/docs/implementation/live-handoff-checklist.md#native-ceo-intake).

**Unlocks:** Actual research, drafting and independent review through native tasks. Runtime/model quality is qualified after access is configured.

### NTF06 P0 Durable review retention

- [ ] Have the storage lifecycle owner approve who retains accepted native receipts until terminal DFW acknowledgement or qualified durable transfer, where archived evidence stays readable, audit retention and eventual deletion. Identify the operator and secure service scopes for tenant-scoped acceptance read/list and DFW access. Use the [host activation contract](https://github.com/NetRxn/Inertia/blob/develop/host-composition/paperclip-durable-funding-review/ACTIVATION-CONTRACT.md); engineering implements its hooks, sweeps, fencing and cancellation reconciliation.

**Unlocks:** Production durable-review composition. Native capture and DFW acceptance are qualified; the production lifecycle/transport remain to connect.

## Existing Buzz instance operator

### NTF07 P0 Relay and audience

- [ ] Send the existing canonical HTTPS/relay endpoints, API/version and bridge identity reference. Select one pilot thread and identify its actual readers, pairing administrator and human/agent enrollment/revocation route. Supply one protected company/issue/thread mapping and verified pairing. If outbound comments are wanted, approve the audience and start cutoff under the [live pilot checklist](https://github.com/NetRxn/Inertia/blob/develop/docs/implementation/live-handoff-checklist.md).

**Unlocks:** Real signed replies, confirmation cards and receipts. Bridge and default-off comment mirroring are tested.

## Governance and funding review owners

### NTF08 P0 Vocdoni example

- [ ] Share one completed proposal with network/chain, proposal identity, final-result evidence and authorized action. Include applicable Aragon/settlement evidence and operative threshold/signing-authority rules. Confirm the exact packet ID/version/hash and action a new vote must bind. Engineering derives the verifier from this example and the [packet contract](https://github.com/NetRxn/Inertia/blob/develop/docs/implementation/grant-packet-binding.md).

**Unlocks:** Effective final authority for a frozen packet. Vocdoni is selected; the actual workflow example remains needed.

### NTF09 P0 Reviewer roles and walkthrough

- [ ] Supply protected human role/applicant/source-scope mappings and the provisioning/revocation owner. Select an authorized rehearsal packet with readable evidence/artifact bytes and a participant for correction/regeneration and cancel-before-apply checks. Use the route-specific role matrix in the [review acceptance contract](https://github.com/NetRxn/Inertia/blob/develop/testing.md#native-grant-review-acceptance-default-disabled).

**Unlocks:** Real human-only review and DFW-confirmed cancellation. Durable acceptance is qualified; live roles and the walkthrough remain needed.

## Y2 teammate

### NTF10 P0 Interest and update contract

- [ ] Send API/changefeed documentation or a test route, authorized account reference, visibility rules and rate limits. Include one sanitized interest registration/response and update event: stable subscription/event IDs, source URL, revision/order, relevance, replay/cursor behavior and unsubscribe/revocation. Identify unsupported operations against the [Y2 handoff](https://github.com/NetRxn/Inertia/blob/develop/docs/implementation/live-handoff-checklist.md#adapter-acceptance-checklist).

**Unlocks:** A Y2 watch linked to native work with deduplicated updates. Contract and adapter qualification remain needed.

## Member pilot participant and enrollment administrator

### NTF11 P0 Second member rehearsal

- [ ] Identify a willing participant, their chosen supported agent/runtime and protected membership reference. Agree one permitted company/project/task, data classes and enrollment/revocation authority. Arrange successful contribution, denied unauthorized access, interrupted-run recovery and revocation checks using the [member runner handoff](https://github.com/NetRxn/Inertia/blob/develop/docs/implementation/live-handoff-checklist.md#adapter-acceptance-checklist). Repository-admin access and DAO enrollment are separate.

**Unlocks:** The required second-member demonstration. Engineering owns runtime, sandbox/workspace and artifact qualification.

## DAO knowledge and finance source owners

### NTF12 P0 Partner and organization sources

- [ ] Share authoritative partner/contact/program/project collections and meeting-source pointers, protected access references, source owners and existing canonical IDs. Identify relationship owners, permitted scopes/audiences and who admits candidate facts or adopted decisions. Confirm correction/deletion/revocation signals. Engineering builds the bounded inventory, extracts, reconciles and backfills under the [knowledge contract](https://github.com/NetRxn/Inertia/blob/develop/docs/development/funding-enhancement/knowledge-contract.md).

**Unlocks:** Indexed partner reuse and durable research writeback. PG/Helix core is qualified; actual inventory and admission are next.

### NTF13 P1 Read only financial source

- [ ] Choose the read-only QuickBooks export/API route and finance owner. Provide a sanitized representative Profit & Loss report with period, basis, currency, totals and source revision/hash; confirm permitted scope and refresh policy. Identify different report/currency needs against the [financial contract](https://github.com/NetRxn/DFW-Gov-Fund/blob/main/government-funding-dfw/docs/financial-snapshot-contract.md).

**Unlocks:** Supported financial facts. Sanitized USD P&L normalization exists; actual provider format needs qualification. This becomes P0 if the selected demo packet needs those facts.

## Discovery mandate and rehearsal coordinator

### NTF14 P0 Pilot and P1 recurring operation

- [ ] Confirm prioritized objectives/geography/applicant scope and the brief/urgent-alert audiences. Supply an existing DFW service/runtime identity and access reference if deployed; otherwise engineering deploys within the approved NTF04 target. Confirm engineering’s proposed source-admission policy (official identity validation and safe fetch; ambiguous authority goes to review), plus a distinct urgent human-delivery destination/recipient policy. Before the pilot, confirm engineering’s proposed query/page/time/cost limits and test destination. After the measured rehearsal, confirm its proposed cadence, urgency thresholds and recheck/alert targets. Identify the operational owner and whether automatic alerts are authorized. Engineering verifies actual human alert delivery and routes unverified source authority through candidate admission. Also confirm rehearsal coordinator, required participants/delegates, availability and agreed demonstration window. See [discovery activation](https://github.com/NetRxn/Inertia/blob/develop/docs/development/funding-enhancement/discovery-loop.md) and [demo acceptance](https://github.com/NetRxn/Inertia/blob/develop/docs/implementation/live-handoff-checklist.md#demo-acceptance).

**Unlocks:** Search → official validation → durable knowledge → brief/alert → next-run reuse, then approved recurrence. The daily schedule is currently disabled.

## Engineering ownership and later work

Engineering owns adapters, source inspection, native recovery, opportunity research, migration/restore checks, Helix indexing/fencing, model-quality checks and the host HTTP/UI qualification blocker. Bring the team a specific access or policy decision when required. Broader Form 990 enrichment and optional semantic/vector search are P2 stretch; the operational partner graph remains part of the demo.

## Keeping this current

Keep NTF01–NTF14 stable. Update the same entry when an input arrives, ownership/access/schema/audience/retention changes, or qualification passes. Record the date and protected evidence reference. Reopen affected entries after material changes.

Synchronize with the [specification](https://github.com/NetRxn/Inertia/blob/develop/spec.md), [tests](https://github.com/NetRxn/Inertia/blob/develop/testing.md), [decisions](https://github.com/NetRxn/Inertia/blob/develop/decisions.md) and [plan](https://github.com/NetRxn/Inertia/blob/develop/plan.md). Preserve the same scope/status in the [deck](https://github.com/NetRxn/Inertia/blob/develop/Inertia-Architecture.pptx) and [HTML overview](https://github.com/NetRxn/Inertia/blob/develop/docs/architecture/Inertia-System-Overview.html); checklist-only changes can preserve the unchanged deck.

Source baseline: [Inertia 338fb528](https://github.com/NetRxn/Inertia/tree/338fb528263a3c105f9ff677daa170ff0593f1eb), [DFW 331416c0](https://github.com/NetRxn/DFW-Gov-Fund/tree/331416c015c83d20ea2d6834e5b4dd53aaeea320).
