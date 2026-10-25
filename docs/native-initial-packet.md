# Native initial packet binding

The existing six public drafting tools can use DFW's private `native_cycle_stdio.py` composition entrypoint. No Inertia runtime code, manifest, capability, tool schema or preapproval allowlist change is required. This source change does not alter any current deployment or configuration.

The private adapter queries saved domain records first, runs the existing bounded portable cycle only on a miss, persists acquisition receipts and exact match/initial-packet selection in existing DFW domain storage, then resolves that match inside the existing public drafting service. Native producer/reviewer authentication, existing objective ownership, public-only projection, candidate review and native checkpoint/wakeup behavior remain unchanged.

The administrator's existing `publicDrafting.matchId` becomes a stable preparation binding key for this entrypoint, matching the private configuration's `match_id`; models still call `funding_drafting_workspace({})` without selecting a tenant, source, profile or match. The private configuration also fixes project, producer/reviewer issue-agent-principal mappings, existing applicant/profile, exact public source IDs, explicit curated keys, freshness and optional acquisition. Those mappings must exactly match the existing host bindings. Consult the private DFW `docs/native-initial-packet.md` contract for fields and recovery.

Minimum runtime integration, owned by the runtime lane:

1. Deploy reviewed DFW source through the established development process. Keep the existing single-company database and native task/agent/run/checkout admission.
2. Prepare the private administrator configuration with exact existing producer/reviewer mappings and approved public registry. Pin its bytes, entrypoint and deployed package using the existing bounded process mechanism. Use a stable selection key in both server configurations. Keep acquisition disabled until its existing admission is confirmed.
3. Point the existing public drafting process at the private composition entrypoint and have the producer call the existing workspace tool. Read the persisted preparation receipt before claiming an actual scan. Then use the existing save, independent review and checkpoint workflow.

New-origin SourceCandidate/quarantine/funding facts remain preliminary. This binding cannot promote them or supply missing opportunity-specific enrichment, eligibility or a complete sponsor field inventory. Such work remains blocked with an explicit private receipt; it never produces a selected draft-ready match by inference. A timed-out interrupted preparation remains uncertain and requires receipt reconciliation before acquisition replay.

## Synthetic qualification

Set `NATIVE_CYCLE_DFW_HOME` to the private checkout's `government-funding-dfw` directory and `NATIVE_CYCLE_PYTHON` to its prepared Python executable. Set `PYTHONPATH` to that checkout's `src` for the local source-only qualification, then run:

```sh
npx vitest run test/drafting/native-cycle.test.ts
```

The test creates disposable synthetic SQLite data, uses the real pinned cold DFW subprocess behind the existing native host fixture, rejects match/role spoofing, and checks public workspace/checkpoint output with all six tools unchanged. It is skipped without explicit private checkout paths. Private DFW tests separately exercise the actual proposal, pending native review and independent completion process. This is source-level qualification; it does not claim a live native deployment, real scan, model research quality or human acceptance.
