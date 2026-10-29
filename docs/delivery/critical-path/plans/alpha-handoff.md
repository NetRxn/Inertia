# Alpha handoff — acceptance and retained proof

Owner: release_assembly. Clean plan; mechanism GREEN, not full discovery or fan-out acceptance.

## Evidence

Actual receipt `/tmp/inertia-alpha-handoff-verification-20261029/latest.json`: Alpha bbc5187b completed14:54:11 Central; Coordinator c4bb automatically consumed13 bindings and saved funding-case-queue88a75c69 revision22. All13 creation attempts then failed task_capacity. Old notification-cycle error is historical and repaired by host044b.

## Maintain

- [x] Preserve 13 source identities, case bindings and source evidence.
- [x] Prove Coordinator reads the handoff, not merely Alpha reports completion.
- [ ] Continue from saved queue without rescanning or duplicating candidates.
- [ ] Separate changed-source refresh from retained case-preparation state; do not hard-expire useful work.

Never relabel this green as task fan-out or complete source coverage. Later source changes need their own receipt/currentness checks.
