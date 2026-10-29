# Beta lifecycle / independent review / exhaustion

Owner: funding_handoff_audit. Status: RED → focused source correction proposed; native durable-exhaustion enforcement remains ⚠ until proved. No live writes.

## Evidence and diagnosis

Actual NSF case 37771: a727 saved useful work then BLOCKED/current_track/no self-wake; f6b revalidated unchanged partial work then needs_review; Charlie6a97 rejected completion; dcc added two sources and revised a real checkpoint but again needs_review; Charlie782 rejected completion and native promotion started Beta49ed. See `/tmp/inertia-final-hour-composition-20261029/nsf-exhaustion-lifecycle-assessment.md` and its three report JSONs. This does not label all subsequent work unproductive.

Host `src/case-work/host.ts` appends native_review_guidance to EVERY non-source producer operation, instructing needs_review/reject-until-complete even on reads and incomplete saves. Native needs_review is a completion review (Approve completion/Continue work), and rejection deliberately returns the case to TODO. Native current_track BLOCKED already holds the case without self-wake. The erroneous contract is at the phase boundary; legitimate independent review and correction must remain automatic.

## Chosen minimal correction — review before code

1. Replace unconditional completion-review instruction with truthful operation-independent lifecycle guidance: save/readback useful partial work; do available public research/drafting; source_review uses its existing exact proposal child; item/gap/whole-packet review uses its actual typed workspace contracts; ordinary needs_review is requested only for a real persisted typed candidate/gap/packet review request using its exact current contract, or a completion-ready packet/current completion contract. Native labels this transport completion review even when domainReview selects an incremental kind; preserve that supported path. Never manufacture receipts, eligibility or private facts.
2. Guidance must explicitly preserve exhausted partial work in native BLOCKED/current_track with actual owner and precise revisit condition, no continuation/attention request for the same exhausted work; Co can work other cases. An independent rejection is consumed once: perform actionable corrections, then hold if no actionable input remains. Real new evidence/corrections remain allowed without a retry/time cap.
3. Do not infer completion readiness from an arbitrary `business_complete` boolean on a read response. Guidance is a contract correction, not a new authority decision. Keep original native/domain completion guards, source-propose child handoff and reviewer independence unchanged.
4. Persist frontier/revisit facts using existing checkpoint `note` + `unresolved` and native blocker fields; no new ledger/scheduler/API. The unstructured representation means mechanical novelty enforcement is still ⚠ and must not be claimed solved by wording alone.

## Source scope

Isolated host followup: `src/case-work/host.ts` + owning focused lifecycle test(s). Coordinate implement_host (org read adapter) to avoid same-file collision. No native status/permission/identity changes. No protected config or live instructions updates in this lane.

## Acceptance gates

- [ ] RED: actual host result currently tells needs_review on context/workspace/partial save/checkpoint; regression fails old source.
- [ ] GREEN: useful incomplete work returns explicit save/continue-or-hold guidance and no unconditional completion-review attention request.
- [ ] GREEN: existing immutable source_propose → exact native source child handoff unchanged; no rejection/acceptance invented.
- [ ] GREEN: completion-ready packet guidance still permits actual native completion review and automatic legitimate Charlie correction; all completion guards unchanged.
- [ ] GREEN: exhaustion guidance requires exact unresolved requirement, attempted source frontier/evidence revision and revisit condition; no fake HITL for ordinary public research.
- [ ] PROOF: actual native current_track BLOCKED creates no enqueue effect; accepted/rejected independent completion interaction follows normal existing route; duplicate terminal interaction is not resolved twice.
- [ ] PROOF: same Beta role supports four distinct case runs under per-issue exclusivity; one held case does not prevent unrelated ready cases. No thirteen-agent fanout requirement.
- [ ] ⚠ durable semantic novelty enforcement: new idempotency keys currently can recontinue an agent-owned blocked task; there is no server-enforced source/draft revision gate. Research whether existing native revisit descriptor/trigger contract can represent this before claiming exhaustive churn prevention. Minimum negative: unchanged rejected checkpoint does not request repeated identical review; matching new source/owner reply resumes exactly once; unrelated events do not; human/approval/submission holds remain protected.

## Operator and live acceptance

Parent reviews source plan/diff and author/independent tests, then sole operator packages/applies normal release if authorized. Observe actual partial-work → actionable correction OR durable case hold while other cases continue. A source test or instruction change alone is not business acceptance.

## Source milestone (2026-10-29)

Lifecycle correction frozen `e6d3346d394c55afca88a3cfc7f9beeea7cc3de4` in `/tmp/inertia-case-lifecycle-guidance-20261029`, base044b. Two owning tests fail old source;36 host/source/retry tests +typecheck pass corrected source. Independent author reviewed exact host-only production delta and repeated16 host tests GREEN. Parent approved exact scope. No runtime acceptance yet; semantic novelty remains ⚠.

Critical parallel fanout admission defect discovered during this task: operator childIssueLimit0 was incorrectly serialized into the runner provider policy and strict native input rejected before provider start. Focus temporarily switched to a separate two-native-file server-only policy projection fix; does not change case lifecycle guards or broaden review permissions. Its source/PG test details are in `/tmp/inertia-coordinator-server-capacity-20261029/host-composition/paperclip-durable-funding-review/NATIVE_COORDINATOR_SERVER_CAPACITY.md`.
