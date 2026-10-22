# Inertia delivery plan

Revision: INERTIA-2026-10-22-r5
Updated: 2026-10-22 (UTC)
Stage: Design refinement; compatibility qualification and detailed design review precede implementation.

## Approach

Configure and extend Paperclip's actual operating model, connect Buzz as a second interface and qualify existing execution hardening before building missing components. This pass refines the design. The next compatibility-informed design review precedes implementation.

## Work packages and exit gates

### P1 / G1: Qualify compatibility

Pin Paperclip SDK and serving-build behavior, Buzz transport/runtime and execution integration. Map required interactions, identity, chat, checkout, routines, runner lifecycle, tool policy and documents to supported interfaces. Resolve U01–U02, including reuse permissions. Record demonstrated gaps and exact test evidence. Environment-dependent qualification continues when that environment is available.

Exit: supported versions/routes, reusable interfaces, blockers and qualification tests.

### P2 / G2: Review concrete connected-loop design

Choose native Buzz provider or bounded plugin bridge. Specify event/identity mappings, common IDs, idempotency, current authorization, audience and recovery. Set one execution owner, CEO/hiring policy, budgets and follow-up limits. Decide member topology after execution qualification. Resolve U03 and U08–U10; assign owners and review exact API contracts and failure behavior with the user.

Exit: reviewed design and selected deployment topology. This is the next design checkpoint, not blanket implementation approval.

### P3: Automatic meetings

Resolve U04–U05. Establish real source fixtures, native event/routine producer, domain transformation and trusted publisher. Automatically publish transcript and separate notes within the configured envelope. Extract source-linked actions and actionable exceptions. Prove T-M01–05, source injection defenses and audience preservation.

Exit: real source-to-website trace, verified links and correction/retry demonstration.

### P4: Grants, packet vote and Y2

Resolve U06–U07 and U11. Reuse scanner ingestion/rules/matching/drafts and review/signoff. Refresh shortlist, verify applicant route, freeze packet and validate the blockchain result against its exact hash. Add Y2 interest/update mapping. Optional shortlist vote follows the required final-packet path.

Exit: current cited candidate, reviewed packet, bound vote receipt and Y2 trace. Actual funder submission remains a separately controlled action.

### P5: Member contribution and shared interfaces

Use native agent/hiring and qualified runner lifecycle. Connect a second member, expose eligible work and demonstrate eager acquisition with follow-up creation. Test execution/server boundaries. Create and resolve work from Buzz and dashboard, preserving IDs. Run T-B01–12 and T-C01–04.

Exit: contribution, denied unauthorized action, contention/reconnect recovery and shared decision trace.

### P6 / G3–G4: Rehearse and publish

Run acceptance and adversarial suites, investigate failures and rehearse the three outcomes. Assemble receipts, source references and demo script. Refresh all five artifacts together. Review public diff and preserve original PDF.

Exit: reproducible evidence and remaining issues with owners. Merge, deployment and credential expansion require their applicable approvals.

## Dependencies and proposed schedule

P1 → P2; then P3 and P4 can run in parallel once domain contracts exist. P5 depends on qualified identity/execution. Bridge fixtures can be prepared during P1. P6 depends on required P3–P5 evidence.

| Window | Focus | Exit evidence |
|---|---|---|
| Oct 22–23 | P1/P2 qualification and design | Supported routes, reviewed contracts and owners |
| Oct 23–25 | P3 and bridge foundation | Automatic publication, identity/dedup/echo tests |
| Oct 25–27 | P4/P5 | Packet vote, Y2, second member and shared UI state |
| Oct 28–29 | P6 fault tests/rehearsal | Three-flow evidence and synchronized artifacts |
| Oct 30 | Submission | User-approved submission materials |

Adjust dates against U12 owner availability and actual qualification. Preserve the three outcomes by reusing native capabilities. Helix/990 enrichment remains outside the required critical path.

## Git and artifact discipline

Continue the existing docs branch and draft PR. Fetch/inspect before editing, preserve concurrent changes, commit one coherent public-safe diff and read back remote bytes. Private audits remain outside Git. Never force push or merge during artifact maintenance. Use stable Library IDs and guarded versions; maintain the deck rather than generating a new PDF.

## Artifact coordination

The synchronized set is [spec.md](spec.md), [testing.md](testing.md), [decisions.md](decisions.md), [plan.md](plan.md), and [Inertia-Architecture.pptx](Inertia-Architecture.pptx). Update the common revision whenever new user decisions change the design. Keep stable filenames and Library identities. The original [product overview](docs/reference/Inertia-beta-product-overview.pdf) remains byte-identical historical material. Current decisions supersede its older sequencing. External configuration questions are centralized in decisions.md.
