# Native initial packet binding

The existing six public drafting tools can use DFW's private `native_cycle_stdio.py` composition entrypoint. The original saved-first binding needs no tool schema or preapproval allowlist change. The optional serial checkpoint adapter below is default-off and requires matching reviewed domain code. Neither path changes a deployment merely by being present in source.

The private adapter reuses existing domain records, persists acquisition receipts and exact match/initial-packet selection in existing DFW storage, then resolves that match inside the public drafting service. The serial domain composition evaluates admitted source acquisition cadence independently of reusable packets; offline assessment is not proof of source freshness. Native producer/reviewer authentication, existing objective ownership, public-only projection and independent candidate review remain unchanged.

The administrator's existing `publicDrafting.matchId` becomes a stable preparation binding key for this entrypoint, matching the private configuration's `match_id`; models still call `funding_drafting_workspace({})` without selecting a tenant, source, profile or match. The private configuration also fixes project, producer/reviewer issue-agent-principal mappings, existing applicant/profile, exact public source IDs, explicit curated keys, freshness and optional acquisition. Those mappings must exactly match the existing host bindings. Consult the private DFW `docs/native-initial-packet.md` contract for fields and recovery.

Minimum runtime integration, owned by the runtime lane:

1. Deploy reviewed DFW source through the established development process. Keep the existing single-company database and native task/agent/run/checkout admission.
2. Prepare the private administrator configuration with exact existing producer/reviewer mappings and approved public registry. Pin its bytes, entrypoint and deployed package using the existing bounded process mechanism. Use a stable selection key in both server configurations. Keep acquisition disabled until its existing admission is confirmed.
3. Point the existing public drafting process at the private composition entrypoint and have the producer call the existing workspace tool. Read the persisted preparation receipt before claiming an actual scan. Then use the existing save, independent review and checkpoint workflow.

New-origin SourceCandidate/quarantine/funding facts remain preliminary. This binding cannot promote them or supply missing opportunity-specific enrichment, eligibility or a complete sponsor field inventory. Such work remains blocked with an explicit private receipt; it never produces a selected draft-ready match by inference. A timed-out interrupted preparation remains uncertain and requires receipt reconciliation before acquisition replay.

## Synthetic qualification

### Optional serial case checkpoint

An administrator may set `publicDrafting.nativeCaseProgression: true` only with
the matching pinned private domain checkpoint protocol. Omitted or false retains
the fixed-match workspace checkpoint behavior. The six public tools and their
argument schemas, role/task bindings and preapproval policy remain unchanged.

The private checkpoint operation returns an authoritative `dfw-native-case-handoff-v1`
receipt containing selection/case identity, semantic/workspace/packet hashes,
authenticated checkpoint run and disposition. It explicitly records
`human_acceptance: not_accepted` and `submission: not_submitted`. The adapter does
not reconstruct a current packet during replay: domain history can outlive the
original match and current evidence. The domain owns selection, stale-write denial
and handoff idempotency; native documents are only immutable receipt mirrors.

Each selection/packet/checkpoint-run tuple has a separate native snapshot; replay
reuses it and conflicting document content fails closed. Pending independent
review blocks the producer, remaining agent work leaves it in progress, and
owner/human handoff moves it to review. These statuses do not accept an application
or record submission. No automatic next-run wake is added: a fresh authenticated
run and domain selection are distinct from replaying the current run. Deployment
and unattended continuation require their own qualification.

**Trigger/readback gate:** this adapter adds no scheduler, event subscription or
capability grant. Native orchestration summaries are not lifecycle-only: they
include raw run errors and company-wide budget metadata. A future continuation
needs an independently reviewed, narrowly scoped terminal-run/correlation readback
and ambiguous-wake recovery contract; the existing six-tool schemas stay unchanged.

Run `npx vitest run test/drafting/serial-checkpoint.test.ts` for synthetic adapter
replay, identity, history and lifecycle tests. This fixture is not provider
execution or durable native next-run scheduling proof.

### Original cross-domain fixture

Set `NATIVE_CYCLE_DFW_HOME` to the private checkout's `government-funding-dfw` directory and `NATIVE_CYCLE_PYTHON` to its prepared Python executable. Set `PYTHONPATH` to that checkout's `src` for the local source-only qualification, then run:

```sh
npx vitest run test/drafting/native-cycle.test.ts
```

The test creates disposable synthetic SQLite data, uses the real pinned cold DFW subprocess behind the existing native host fixture, rejects match/role spoofing, and checks public workspace/checkpoint output with all six tools unchanged. It is skipped without explicit private checkout paths. Private DFW tests separately exercise the actual proposal, pending native review and independent completion process. This is source-level qualification; it does not claim a live native deployment, real scan, model research quality or human acceptance.
