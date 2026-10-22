# Inertia decision log

Revision: INERTIA-2026-10-22-r4  
Updated: 2026-10-22 (UTC)  
Status: Planning baseline. No implementation, deployment, scan, or application test execution is represented as complete.

## Synchronized artifact set

- [spec.md](spec.md): requirements, boundaries, contracts, and sources.
- [testing.md](testing.md): acceptance and security tests defined before implementation.
- [decisions.md](decisions.md): confirmed decisions, proposals, and unresolved choices.
- [plan.md](plan.md): proposed sequence, dependencies, and evidence gates.
- [Inertia-Architecture.pptx](Inertia-Architecture.pptx): editable seven-slide architecture view.

All five artifacts carry the same revision. Future user updates must reconcile all five, including explicit no-change checks. Preserve stable filenames and IDs, record superseded choices, and do not silently convert proposals into confirmed decisions. No newly generated PDF is part of this active set. The original [product overview](docs/reference/Inertia-beta-product-overview.pdf) is preserved unchanged as historical source material; its older sequencing does not override these current artifacts.

## Change summary

- Confirmed public project home: [NetRxn/Inertia](https://github.com/NetRxn/Inertia). Owner authorized publication of these artifacts and the original overview. Use focused branches, reviewable commits and pull requests; implementation and deployment remain separate.

- Confirmed Google Meet recording and Gemini processing, with outputs in the organization’s Google Drive folder. Folder IDs, exact output types, readiness signals, access, and retention remain TBD.
- Confirmed PlanetScale PostgreSQL for the DAO website. Preserve existing storage and de-prioritize Helix.
- Added the required member-agent contribution objective with client-side sandboxed execution, worktrees, and server-mediated result acceptance.
- Retained the grant packet submission vote and Y2 watch loop. Integration with the existing 990 workbench is a stretch TODO.
- Added a requirement-to-test map, security gates, decision statuses, and a proposed one-week implementation sequence.

## Decision register

Confirmed decisions describe user intent or existing evidence, not completion. Proposed choices need validation/selection. TBD items require an accountable owner before implementation. All owners are unassigned unless explicitly described as teammate-owned. Dates below are recommended decision targets.

| ID | Status | Decision or open choice | Reason / consequence | Links |
|---|---|---|---|---|
| D01 | Confirmed scope/deadline; proposed buffer | Three required objectives: automatic meetings, grant packet submission vote, secure member-agent contribution. HackFW general lane and October 30 deadline are confirmed. October 29 is the proposed rehearsal/demo buffer. | Supersedes v2 two-objective summary. Keep baseline narrow enough for one week. | R-M01–04, R-G01–04, R-C01–05; P1–P6 |
| D02 | Confirmed platform; TBD contract | Google Meet video recording, Gemini processing, organization Google Drive storage. | Source platform/landing location are no longer unknown. Exact folder IDs, input/output types, readiness, source ownership, retention and access still require confirmation. | R-M01–04; T-M01–05; P1 |
| D03 | Confirmed behavior; proposed policy mechanism | Fully automatic normal meeting publication with no per-meeting approval. | Proposed versioned preapproved policy fixes eligible source, audience, output types and publisher destination. Exceptions stop unsafe work without making every meeting manual. | R-M01, R-M04; T-M01, T-M05; P1, P3 |
| D04 | Confirmed | DAO website uses PlanetScale PostgreSQL. Preserve existing Drizzle and document integrations where fit. | No required DB migration. Grant engine storage remains separate. Exact deployed DAO API and private-document route TBD. | R-D01; T-O02; P1 |
| D05 | Confirmed priority | De-prioritize Helix. Integration with the existing 990 workbench is a stretch TODO. TexasNova remains context. | Do not create a new graph platform or make labs a new core workstream. Lab access/API/backend unverified. | R-X01; T-X01; after P6 |
| D06 | Confirmed baseline | Reuse DFW-Gov-Fund 3.4.0 through a narrow adapter. | Rules/matching/template drafts/immutable packets exist. Current source verification and applicant facts remain necessary. No existing embedded full LLM or blockchain bridge established. | R-G01–02; T-G01–02; P4 |
| D07 | Confirmed intent; TBD adapter | Blockchain vote decides WHETHER to submit an exact immutable packet. Vocdoni named in prior context, exact adapter/finality unresolved. | No mandatory top-three selection vote. Changes do not inherit approval. Vote does not override eligibility, role signoffs or separately needed submission authority. | R-G03–04; T-G03–04; P1, P4 |
| D08 | Candidate / TBD | Paperclip-style management may provide orchestration too. Choose one durable ledger/runtime owner after fit check. | No separate mandatory scheduler. Buzz remains member chat/site agent, not ledger. Deployment access and adapter contract remain TBD. | R-O01; T-O01; P1, P2 |
| D09 | Confirmed requirement; proposed mechanism | Members connect their own client agents and contribute spare capacity. Server owns authorization/validation/publication. | Per-job participation is bounded and never broad production access. Choose auth pairing/scopes, local sandbox and supported task type before implementation. | R-C01–05; T-C01–04, T-S01–06; P1, P2, P5 |
| D10 | Proposed security baseline | Week-one clients receive approved public/synthetic bundles only. Restricted meeting work remains trusted. | Member owners can retain downloaded content or send it to their providers. Sandbox cannot guarantee remote deletion or owner compliance. This is a proposed policy, not a user-issued ban on future confidential work. | R-C02–03; T-S02, T-S05; P1 |
| D11 | Proposed mechanism | Disposable non-root container/VM or suitable OS sandbox, worktree only inside isolation, default-denied network, bounded resources. | Never mount main checkout/common Git directory, host credentials, Docker socket, or privileged host paths. Exact runtime and tested configuration TBD. | R-C02; T-S04–05; P1, P5 |
| D12 | Proposed correctness baseline | Atomic claim, increasing lease epoch, current authorization at every operation, immutable idempotent receipt, unique acceptance, outbox/reconciliation. | Supports at-most-once acceptance under repeated delivery. Does not guarantee exactly-once external writes. Revocation fences server operations, not offline client execution. | R-C04–05, R-O01; T-C02–04, T-S03; P2 |
| D13 | Planned; access TBD | Keep teammate-owned Y2 watch loop in flow. | Register interests, route source-backed alerts to related work, dedupe and retire closed watches. Confirm actual API/MCP/webhook and team access. | R-Y01; T-Y01; P1, P4 |
| D14 | Available candidate; TBD | Cloudflare may host selected infrastructure if service/runtime fit warrants it. | Availability alone does not establish plan, deployed services, queue semantics, storage controls, or permission to create resources. | R-O01, R-C02; T-O01, T-S04; P1 |
| D15 | Confirmed | Maintain spec.md, testing.md, decisions.md, plan.md and Inertia-Architecture.pptx together. Deck only. | Same revision/date, exact filenames, IDs, scope and sources. Previous PDF is historical, excluded from active set. | R-A01; T-A01; all phases |
| D16 | TBD | Choose inference endpoint/provider per trusted and client lane. | Buzz local OpenAI-compatible inference is unconfirmed. Member runtime/model may differ. Data policy must cover provider egress. No provider credentials distributed by control plane. | R-C02–03; T-S02, T-S05; P1, P5 |
| D17 | Confirmed | NetRxn/Inertia is the public project home. Owner authorized publishing the original overview and synchronized artifacts. | Focused branches, coherent commits and draft PRs. Keep private runtime data/secrets out; preserve original source unchanged and identify superseded assumptions. No merge, build or deployment authorization implied. | R-A01; T-A01; P0 |

## Unblocking questions, in implementation order

1. D02–D04: Which organization Drive folder and output types are authoritative, what proves readiness, what audience may see output, how long are originals retained, and which deployed website endpoint enforces that audience? Target: October 22–23. Owner: meeting/site maintainers, to assign.
2. D08–D12: Which existing runtime can own the ledger and claims? Who approves the proposed public/synthetic client policy, auth pairing, narrow job type, sandbox, and artifact storage? Target: October 22–23. Owner: platform/security maintainer, to assign.
3. D06–D07: Which current opportunity and applicant route have enough evidence for demonstration, which signoffs apply, and which governance API/chain/finality policy supports exact packet hashes? Target: October 23. Owner: grant/governance maintainers, to assign.
4. D13–D16: What Y2 contract is actually accessible, and which inference/hosting options fit the selected runtime and data policy? Target: October 23–24. Owner: Y2 teammate plus platform owner, to confirm.

## Superseded assumptions and evidence limits

- v2’s “two demo workstreams” is superseded by three required objectives.
- “Recording/transcript landing unknown” is superseded by confirmed organization Drive storage. Precise delivery semantics remain open.
- Helix has no baseline prerequisite role. Integration with an existing 990 service is distinct from building a Helix projection.
- July grant matches are historical, not fresh October openings. Missing DAO legal/tax/partner information is unknown, not proof those facts do not exist elsewhere.
- Public repositories are evidence of code, not proof of current deployments or lab identity. Do not conflate the separate Astro website repository, FalkorDB wiki engine, or libSQL scraper with the supplied labs.
- No proposal in this log authorizes implementation, service creation, monitoring, publication, vote casting, or grant submission by the assistant.

Sources and revisions: spec.md §8. Test gates: testing.md. Proposed delivery sequence: plan.md. Future changes append or supersede a decision while retaining its stable ID and explanation.
