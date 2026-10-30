# Independent Charlie review — mechanism versus acceptance

Owner: release_assembly. Clean mechanism plan; current source-review/correction handoff GREEN.

## Evidence

INE-62 and INE-63 contain actual independent reviews. Large exact source context was reconstructed via lossless pages, hash checked, and rejected with substantive requirements findings. Native automatic handoff returned the same case to Beta. These are source reviews, not accepted application packets.

## Acceptance path

- [x] Read exact immutable proposal with actor-bound source pages; no silent truncation.
- [x] Persist real verdict and receipt; correct source identity unchanged.
- [x] Automatically return actionable rejection to same producer.
- [ ] Persist actual typed candidate/gap/packet review request when one exists; preserve incremental review before complete packet.
- [ ] Do not request native completion review merely for a preliminary read/checkpoint/render. Exhaustion handling is in beta-lifecycle.md.
- [ ] Obtain whole-packet review against final content before final readiness green.

Review independence, genuine private-record/authority holds and submission boundary remain unchanged.
