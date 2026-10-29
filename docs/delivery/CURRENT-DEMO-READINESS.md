# Inertia demo readiness — October 30 morning

Snapshot: **2026-10-29 16:01:56 CDT maintenance restoration proof**, updated at 16:06 CDT. This is a documentation snapshot, not a fresh health probe. Read [progress](OPERATOR-SNAPSHOT.md) first if it is newer. [Visual proof map](architecture/index.html) · [Walkthrough and claim matrix](DEMO-WALKTHROUGH.md).

**Current demonstration status: UI/API restored in maintenance mode.** The operator verified HTTP200, plugin READY, owner access and Viewer read200/write403 at 16:01:56 CDT. The scheduler is disabled, company paused and no executors/queued runs/pending wakes are present. Data/backups remain intact. Retained artifacts may be viewed with authorized access; a live autonomous walkthrough still requires normal scheduler postboot and execution proof.

Printable, visually checked exports: [intended architecture](architecture/big-picture.svg), [current proof map](architecture/current-proof-map.svg), [walkthrough](architecture/demo-walkthrough.svg), [three-page PDF](architecture/demo-guide.pdf). The architecture is the approved direction; maintenance mode is temporary recovery.

## What can be shown truthfully

- **Organization knowledge:** John confirmed that the member app `/work` answers from the existing corpus, including website, meeting/Buzz, shares and funding material. Funding agents do not yet have a scoped machine reader for that corpus. The [specific app-owner interface handoff](https://github.com/NetRxn/Inertia/issues/40#issuecomment-6507891692) reuses existing search; app work remains partner-owned.
- **Discovery handoff:** Alpha materialized 13 source/case bindings, completed its handoff, and the Coordinator read the queue. All 13 attempted child creations hit the native 25-child capacity limit. This proves handoff, not portfolio fanout or completion.
- **Independent critique and correction:** Charlie rejected immutable source proposals; native continuation automatically returned the same case to Beta for correction. Rejection is a useful demonstrated quality control, not accepted source or packet evidence.
- **Bounded large-source reading:** an isolated 1.2 MB source and 182 journal pages passed qualification. The deployed d887 run subsequently read 36 pages successfully. Test scale and actual live observation are separate proofs.
- **Rendered work exists:** one content revision was rendered through three successful calls into Markdown (9,900 bytes) and DOCX (40,453 bytes), eight typed fields and roughly 1,179 words. Native document `5e4fbb20…` retains the unreviewed brief/checkpoint. This is a conditional pursuit/checklist/organization-positioning brief; it is not an application narrative, project plan, budget or submission-ready packet. Native attachment/work-product publication and whole-packet approval remain unproven.

## What remains unavailable or unproved

| Area | Current boundary | Next useful proof |
| --- | --- | --- |
| Availability | UI/API restored with scheduler disabled; normal funding execution remains offline | Fixed normal scheduler postboot, then actual authorized work |
| Portfolio execution | 13 child attempts blocked by capacity; reviewed repair is source-qualified | Deploy qualified repair, explicitly configure Coordinator capacity, observe actual case creation/replay |
| Complete funding work | Brief exists; full portfolio and accepted application packets absent | Useful application material for each actionable opportunity, substantive review/correction, precise human decisions |
| P1 Buzz | Member corpus works; Paperclip bridge remains controlled-only | Scoped corpus reader; separately prove real admitted bridge identity/pairing and an agreed canary |
| P2 Gemini notes | Replay fix source-qualified; no actual production import/intake proof | App-owned authenticated readback/hash lookup, then exact one import and one native intake |
| Human onboarding | Signup enabled behind existing Access restriction; actual join unconfirmed | Human completes own account/invite and verifies intended access |

## Source and runtime are different releases

Last successful production execution used image **d887**, config **71d9**, registry **cff8**, compose **bc8**, boot **46a**, signup-disable flag **false**. The capacity image **d415** failed startup; rolling back to d887 also failed on the same historical reconciliation row. This is not evidence that the capacity parser caused the failure. Temporary maintenance boot **509** restored UI/API on d887, app **2dfe58**, with scheduler disabled; it does not establish normal execution readiness. Coordinator capacity `0` has **not** been applied in this snapshot.

Source checked October 29 around 15:58 CDT: [DFW81](https://github.com/NetRxn/DFW-Gov-Fund/pull/81) `f475` is draft/open and mergeable; [Inertia135](https://github.com/NetRxn/Inertia/pull/135) `d206` is draft/open with a parent conflict; [136](https://github.com/NetRxn/Inertia/pull/136) `044b` is open and mergeable; [137](https://github.com/NetRxn/Inertia/pull/137) `19d` is open and mergeable against the stacked PR135 branch. All were unmerged at inspection. Exact-head checks: [PR136 root-package passed](https://github.com/NetRxn/Inertia/actions/runs/40944061450/job/123694646585); [DFW81 test failed](https://github.com/NetRxn/DFW-Gov-Fund/actions/runs/40944009494/job/123694469764), underlying cause not established by its annotations. No checks were returned for PR135/137. Mergeability is not a CI or deployment pass. The nested local `Inertia/` checkout is stale and is not the delivery source.

Startup reconciliation fix **2d4900d**, parent capacity **19d**, passed isolated full-server RED→GREEN with actual plugin READY, scheduler true and HTTP200. Independent checks reported 14/14 plus 42 guards/22 transitions. Exact stale-row settlement preserved the newer completed review and ledger; unreviewed completion remained denied. An integrated archive is being built. This is source/isolated proof, not a live release.

## Reproduce or recover without inventing a release

Use the exact component/source pins and qualification receipts linked by [progress](OPERATOR-SNAPSHOT.md), not the newest branch name or a historical fixture command. Plugin packaging (`npm run test:package`, `npm pack`) validates an installable package; it does not install the native overlay, domain wheel, protected references or target boot configuration. The [native composition contract](../../host-composition/paperclip-durable-funding-review/README.md), [composition source](../../host-composition/paperclip-durable-funding-review/README.md), and [source/install inventory](DEMO-DOCS-SWEEP.md) explain their respective boundaries. Only the root's designated operator changes runtime. Do not run historical repair scripts as a demo recipe.

Historical diagrams, deck, original product PDF, receipts and reports remain preserved. They describe intended architecture or dated tests. The live state comes from a timestamped operator observation; this document cannot promote itself to current health.
