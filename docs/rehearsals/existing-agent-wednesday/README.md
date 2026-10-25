# Wednesday existing-agent rehearsal plan

Status: **planning and acceptance cases only**, for [#48](https://github.com/NetRxn/Inertia/issues/48). Prepared 2026-10-24 against `develop` `3560f1e`. Revised the same day after the [coordinator review](https://github.com/NetRxn/Inertia/pull/61#issuecomment-6388867070). Revised again on 2026-10-25 to put member re-entry recovery under R-03 and to keep confirmation and attestation off ordinary comments ([agreement](https://github.com/NetRxn/Inertia/pull/61#issuecomment-6392739354)). Target: operational and rehearsed on **Wednesday, October 28, 2026**. Submission deadline: Friday, October 30, 11:00 a.m. CDT.

This plan follows the [maintainer's suggested rehearsal](https://github.com/NetRxn/Inertia/pull/59#issuecomment-6388561995): **one sourced brief → a prepared member ask → the response incorporated into the funding case**. The system agent carries it out, with a bounded contribution from the existing authorized Buzz agent.

It runs nothing and authorizes nothing: no provider execution, enrollment, credentials, permission changes, deployment, live data transfer, votes or external submission. It does not claim [PR51](https://github.com/NetRxn/Inertia/pull/51) or untrusted member-owned runtime isolation. Every live step waits on the admissions listed under [Readiness by step](#readiness-by-step).

## Roles

Roles, not named people. Any verified member with current application-action access can fill the member role.

| Role | Does |
|---|---|
| Rehearsal coordinator | Confirms the case, window, participants and ask deadline (NTF14, NTF15), and runs the cases below |
| System agent | The registered Paperclip run that researches, drafts and incorporates responses (NTF05) |
| Independent critic agent | A separately registered run that critiques the frozen draft v1 (NTF05) |
| Existing Buzz agent | Contributes one bounded section within the application scope (NTF07, NTF11) |
| Member | Answers the prepared ask and, if ready, reviews the exact version (NTF02, NTF09) |
| Buzz operator | Confirms the relay, thread, audience and reply/readback path (NTF07) |

## Phases

The rehearsal is split into resumable phases, so it does not depend on one long meeting. Two hours is a provisional timebox for phases B and C, not a meeting requirement or a completion guarantee. The actual Wednesday window is still to be confirmed with participants.

| Phase | Steps | When | In the receipt boundary |
|---|---|---|---|
| Setup | 1 | Before the case | No; recorded separately if useful |
| A · Background preparation | 2–6 | Before the live session | Yes |
| B · Live member interaction | 7–8 | Short live session | Yes |
| C · Incorporation and readback | 9–10 | After the response | Yes |
| D · Review and attestation | 11–12 | After readback | No; native records only |

Wall-clock time covers phases A–C as one span, from run registration to the verified v2 readback, **including waiting between phases**.

## Flow

| Step | Phase | What happens | Surface | Evidence |
|---|---|---|---|---|
| 1 | Setup | Coordinator confirms the selected case, backup, window, participants, audience and the ask deadline | Protected channel | NTF14 reference |
| 2 | A | The system agent's run is registered on the case's native task. Wall-clock starts | Paperclip | `runs[role=system]` |
| 3 | A | **Sourced brief (M4).** Query saved knowledge through the SQL named tools, research the remaining gaps, write the useful delta back, read it back to confirm it persisted, then render the brief | Native document or comment | `inv:sql-01`, `inv:sql-02`, `inv:research-01`, `inv:sql-write-01`, `inv:sql-read-01`, `art:opportunity-brief` v1 |
| 4 | A | **Draft v1.** The system produces a near-complete application draft | Native document | `inv:draft-01`, `art:application-draft` v1 |
| 5 | A | **Independent critique.** A separately registered critic run, with its own agent identity, reviews only the frozen draft v1 and the admitted sources. It has no access to the drafting run's working state | Native comment | `runs[role=collaborator]` (critic), `inv:critique-01`, `art:critique` v1 |
| 6 | A | **Bounded collaborator contribution.** The existing Buzz agent contributes one scoped section | Buzz thread mirrored to native | `runs[role=collaborator]` (Buzz), `bounded: true`, `art:collaborator-section` v1 |
| 7 | B | **Prepared ask (thin M5).** One canonical ask goes on the existing native case task, with a subtask only where normal assignment needs one. Buzz carries the notification and the authenticated reply against the same ask ID and exact version. See the [example](#prepared-ask-example) | Native task; Buzz notification and reply | Native ask record; `asks.offered` |
| 8 | B | **Member response.** The member explicitly accepts or declines, then answers | Native task or authenticated Buzz reply | Native accept/decline and response events ([evidence](#evidence-for-each-event)) |
| 9 | C | **Incorporation and readback.** The system incorporates the response and the critique into draft v2, then reads v2 back. Wall-clock ends at the verified readback | Native document | `inv:draft-02`, `art:application-draft` v2, native readback, `corrections`, `asks.completed` |
| 10 | C | **Attribution (M6-lite).** The member's and agents' contributions are attributed with evidence inside the existing task | Native task | Native attribution records and the receipt |
| 11 | D | **Exact-version review, if ready.** One verified member reviews and confirms the exact v2 under the v2 policy. **The new case stops at prepared/reviewed.** It is not marked submitted unless it was actually submitted externally | Qualified action surface only, keeping its native receipt. Until the Packet UI/action wiring is qualified, defer this optional step; comments are for review discussion only | Native v2 records (not in the receipt) |
| 12 | D | **Mark submitted demonstration.** Shown only on the already-submitted Park Place record or on an isolated synthetic test record, as a version-bound attestation of that record. The receipt is optional and can come later | Qualified action surface only, keeping its native receipt. Until the Packet UI/action wiring is qualified, defer this optional step; comments are for review discussion only | Native attestation record (not in the receipt) |
| 13 | — | **Receipt.** Assemble the #54 receipt and validate it | Local | `node scripts/demo-evidence/validate-receipt.mjs <receipt>` ([PR60](https://github.com/NetRxn/Inertia/pull/60) at `79a29a3`) |

Votes, sponsor signatures and certifications apply only if the selected case or funder actually requires them (NTF08). Park Place stays a historical human-submitted reference. It is never presented as this run's output, and step 12 attests only its existing submission.

## Prepared ask example

A sanitized example. Angle-bracket values are protected references, filled in only through protected channels.

| Field | Example |
|---|---|
| Ask | `ask:rehearsal-01`, the one canonical ask on the native case task `<NTF14 case task>` |
| Target | `art:application-draft` **v1**, section `sec:community-impact` (the lead community story) |
| Why you | Verified member with current application-action access for this case (NTF02) |
| Evidence attached | `art:opportunity-brief` v1; the critique finding on `sec:community-impact` from `art:critique` v1; the admitted sources `src:ntf12-org-evidence` and `src:ntf14-case-scope`; two candidate stories `<candidate A>` and `<candidate B>` |
| Requested answer | Choose candidate A or B as the lead story, or name one alternative in one sentence. Optionally flag one factual correction in that section. Nothing else in the draft is in scope |
| Expected effort | About 10 minutes |
| Deadline | `<coordinator-confirmed deadline>` from step 1. Not inferred from the window |
| Reply choices | **Accept and answer**, or **Decline**. The coordinator can **withdraw** the ask. No reply by the deadline is recorded as no response |
| Definition of done | The chosen story is in `art:application-draft` v2, the v2 readback shows it, and the ask is closed as completed on the native task |

The ask is bound to v1 and to `ask:rehearsal-01`. A reply for any other version or ask ID is rejected, not retargeted.

## Evidence for each event

Agent runs and human events are recorded separately. Agent work appears in the receipt as runs, tool invocations and artifacts. Human events stay in native records under protected references, and the receipt only counts them in `measurements.asks`. Each outcome needs its own evidence. **Delivery alone establishes only that the ask was offered.**

| Event | Kind | Evidence | Establishes | Does not establish |
|---|---|---|---|---|
| SQL query and writeback | Agent (system run) | `inv:sql-01`/`02` and `inv:sql-write-01` digests | Saved knowledge was read and the useful delta was written | That the write persisted |
| SQL readback | Agent (system run) | `inv:sql-read-01` result digest matches the written delta | The delta persisted and can be reused | — |
| Independent critique | Agent (critic run) | Separate run and agent reference, `art:critique` v1 digest, input limited to draft v1 and admitted sources | A critique from outside the drafting run | Member review |
| Ask delivered | System and relay | Native ask record; Buzz delivery readback with a stable event ID | `offered` | Acceptance or response |
| Member accepts | Human | Native accept event by the authenticated member, bound to `ask:rehearsal-01` and v1 | `accepted` | A response or completion |
| Member declines | Human | Native decline event by the authenticated member | `declined` | — |
| Member responds | Human | Native comment or authenticated Buzz reply against the ask ID and version; content digest only | A response was received (response time) | Incorporation |
| No reply by the deadline | — | Deadline passed with no accept, decline or reply; coordinator note | `noResponse` | A decline |
| Coordinator withdraws | Human | Native terminal withdrawal with a reason | `withdrawn` | Erasing an earlier completed contribution |
| Incorporation | Agent (system run) | `inv:draft-02`, `art:application-draft` v2 digest, a native readback containing the chosen story, and the ask closed as completed | `completed` | Member approval of v2 |

## Acceptance cases

| ID | Case | Setup | Expected | Evidence |
|---|---|---|---|---|
| R-01 | Success | Steps 1–13 on admitted bindings | Actual run, tool, admitted-source and artifact evidence that matches native readbacks; separate member events for accept, response and completed incorporation; and a useful incorporated output (v2 contains the chosen story). The validator reports `valid` and `qualificationEligible: true`, which means the receipt is structurally ready for review, not that it is qualified | Native readbacks, native member events and the receipt |
| R-02 | Interruption and recovery | Stop the system run after the step 3 writeback, before the brief is published, then resume | The resumed run reads back the saved delta and reuses it with no duplicate native mutation. An uncertain native outcome is reconciled by readback before any retry | Native history, the readback and a single brief version |
| R-03 | Buzz delivery unknown | The relay is unreachable while the step 6 section or the step 7–8 reply is delivered | `BuzzDeliveryUnknown` keeps the stable event ID, and the retry resends the same signed event rather than re-signing. One reply causes one native mutation. A member who is unsure their reply landed re-enters it under the same pending request ID: existing locking allows one accepted body per authenticated actor, issue and key, readback shows the original receipt if the earlier request won, a failed readback leaves the request unresolved, and pending state never moves between user partitions | Relay readback and native history showing exactly one accepted body; readback of the original receipt when the earlier request won |
| R-04 | Denial | An agent, a public-only viewer or a non-member tries to answer the ask or confirm the version | Denied, with the native denial authoritative. Nothing is incorporated or confirmed | Native denial records |
| R-05 | Revocation | The member's access is revoked after the ask is sent and before the response arrives | The coordinator records a native terminal withdrawal with a reason. A late reply is rejected as unauthorized and not incorporated. The receipt counts the ask as `withdrawn`, not `declined` or `noResponse`. Original events are kept, and an earlier completed contribution is never erased | Native withdrawal and rejection records; receipt `asks.withdrawn` |
| R-06 | No response | The member doesn't answer by the confirmed deadline | Recorded as `noResponse`, never as `declined`, and excluded from response time. The coordinator may send one alternate ask | Receipt `asks.noResponse` |
| R-07 | Stale version | A member confirmed v1, then v2 is created, and a new confirmation arrives for v1 | The earlier v1 approval stays in history. The new confirmation follows the current v2 policy: it never authorizes v2 and never silently retargets to v2. v2 needs its own confirmation | Native v2 records |
| R-08 | Reference substitution | A manual reference packet is labelled as system output | The validator rejects it (`CLASS_MISMATCH`). Provenance check: the artifact's `contentSha256` is compared with the reference packet's digest, and `producedBy` must resolve to the registered run and invocations in native records | Validator report; digest comparison; native run readback |
| R-09 | Collaborator overclaim | The Buzz agent's section is presented as the complete outcome | The validator rejects it (`SCOPE_OVERCLAIM`). Provenance check: the outcome digest must equal the native v2 readback, produced by the registered system run, and the Buzz section's digest must match only the mirrored section | Validator report; digest comparison; native run readback |
| R-10 | Unknown usage or cost | Provider usage or billing isn't exported | Recorded as unknown with a reason and no total, never $0. This does not block any step | Receipt `measurements` |
| R-11 | Member decline | The member explicitly declines the ask | A native decline event by the authenticated member. Recorded as `declined`, and nothing is incorporated. The coordinator may send one alternate ask | Native decline record; receipt `asks.declined` |
| R-12 | Truthful submission history | Steps 11–12 | The new case ends at prepared/reviewed and is not marked submitted. Mark submitted appears only on the Park Place record or an isolated synthetic test record, bound to that record's exact version | Native history of both records |

R-02, R-03, R-04 and R-07 reuse behavior that source tests already cover. The rehearsal checks that this behavior holds on the actual bindings.

R-08 and R-09 can be checked now against derivations of the synthetic receipt. Against PR60 at `79a29a3`, setting `artifacts[0].origin` to `manual-reference` gives `CLASS_MISMATCH`, and pointing `outcome` at `art:collaborator-section` v1 gives `SCOPE_OVERCLAIM`. Their provenance checks need actual native readbacks. R-10 can also be checked now.

## Receipt mapping

[`expected-receipt.json`](expected-receipt.json) is a synthetic target showing the shape a successful R-01 receipt should have. It is labelled `synthetic-fixture` and validates against PR60 at `79a29a3`: valid, not eligible, with warnings only for synthetic evidence and unknown usage and cost. PR60 is still provisional while its re-review is pending. Revalidate against the final reviewed head before relying on this result. Every reference is a placeholder for a protected binding, and all times and values are illustrative.

| Plan step | Receipt field |
|---|---|
| 2, 5, 6 | `runs[]`: one `system`, plus `collaborator` runs for the critic and the Buzz agent |
| 3–6, 9 | `toolInvocations[]` (digests only) and `admittedSources[]` |
| 3–6, 9 | `artifacts[]` and `contributions[]`. Each contribution lists every invocation that produced its artifacts |
| 9 | `outcome` = `art:application-draft` v2, produced by the system run |
| 7–9 | `measurements.asks` (including `withdrawn`) and `measurements.corrections` |
| 2–9 | `measurements.wallClock`, `measurements.activeHumanTime`, `usage` and `cost` |
| 1, 11, 12 | Not in the receipt. Setup, review and Mark submitted live in protected or native records. A valid receipt is not an approval |

### Measurement boundaries

- **Wall-clock** runs from run registration (step 2) to the verified v2 readback (step 9), including waiting between phases A–C. It excludes setup and phase D.
- **Active human time** uses the same boundary. It includes the member's ask session (timed) and coordinator and operator interventions inside the case (self-reported, and labelled as such). Phase D review time is not included; record it separately if useful.
- **Usage and cost** stay explicit unknowns until the NTF05 usage and billing export is bound.
- The sample's times and values are illustrative. They are not targets or measurements.

## Readiness by step

As of 2026-10-24, no protected reference below is recorded as received in public issues. Actual values travel only through protected channels. A missing reference blocks only the steps that need it. Admission of the actual runtime, source and access is still required for every operation that uses it.

| Step | Needs | Reference | Responsible role | Next action |
|---|---|---|---|---|
| 1 | NTF14: case, backup, participants, window, audience, ask deadline | Missing | Rehearsal coordinator | Confirm the case and the Wednesday window with participants ([#49](https://github.com/NetRxn/Inertia/issues/49)) |
| 2 | NTF05: existing runtime, agent references and pilot budget | Missing | Platform integration owner | Admit the runtime and register the system and critic agents ([#45](https://github.com/NetRxn/Inertia/issues/45)) |
| 3 | NTF04: deployment and authorized SQL domain-tool binding. NTF12: SQL routes, canonical IDs and source scopes | Missing | Platform integration owner; knowledge/discovery owner | Bind the SQL named tools, including writeback and readback, to the admitted sources ([#45](https://github.com/NetRxn/Inertia/issues/45), [#49](https://github.com/NetRxn/Inertia/issues/49)) |
| 3, 4 | NTF13: financial source, **only if** the case needs financial facts | Not needed unless the case uses financial facts | Finance source owner | Decide whether the selected case needs it ([#49](https://github.com/NetRxn/Inertia/issues/49)) |
| 5 | NTF05: critic agent identity and its restricted context | Missing | Platform integration owner | Register the critic as a separate run with input limited to draft v1 and admitted sources ([#45](https://github.com/NetRxn/Inertia/issues/45)) |
| 6 | NTF07: Buzz agent identity, relay, pilot thread, audience. NTF11: confirmation that the section fits the packet | Missing | Existing Buzz operator; pilot coordinator | Confirm the relay and thread; confirm the section scope (#48) |
| 7, 8 | NTF02: membership and application-action ACL source. NTF09: one available verified member. NTF07: authenticated reply path | Missing | Membership/application-access operator; Buzz operator | Map membership and access ([#46](https://github.com/NetRxn/Inertia/issues/46)). **Pending wiring:** Buzz v2 routing; until it is qualified, use the existing native task and comment path |
| 9 | NTF06: storage and archive binding for retained reviewed records | Missing | Platform integration owner | Bind retention for draft v2 and its readback ([#45](https://github.com/NetRxn/Inertia/issues/45)) |
| 11 | NTF02, NTF09. NTF08: governance, **only if** the case requires a vote or signature | Missing; NTF08 not needed unless required | Membership/application-access operator; governance operator only if applicable | **Pending wiring:** the native Packet tab and action wiring (Task 2 in [#40](https://github.com/NetRxn/Inertia/issues/40)). Until it is qualified, use comments for review discussion only; perform the optional confirmation only through a qualified action surface and keep its native receipt, otherwise defer it |
| 12 | Park Place record reference, or an isolated synthetic test record | Missing | Rehearsal coordinator | Choose the record. **Pending wiring:** Mark submitted through the Packet tab (Task 2 in [#40](https://github.com/NetRxn/Inertia/issues/40)). Until it is qualified, defer the attestation; comments are for review discussion only |
| 13 | NTF05: usage and billing export | Missing; recorded as unknown, does not block | Platform integration owner | Bind the export if available; otherwise keep explicit unknowns (R-10) |
| Recording | NTF15: recording logistics and permission to show sanitized material | Missing; needed only to record or show the rehearsal | Rehearsal coordinator | Confirm before any recording |

One engineering seam is also open: the owning host or runtime must compute the argument, result and run-ID digests, so raw values never reach the repository.

## Answers recorded

From the [coordinator review](https://github.com/NetRxn/Inertia/pull/61#issuecomment-6388867070):

1. **Delivery.** One canonical ask on the existing native case task, with a subtask only where normal assignment needs one. Buzz carries the notification and the authenticated reply against the same ask ID and exact version. Use the existing task and comment path until the Packet UI and action wiring is qualified (steps 7–8).
2. **Revocation.** Record a native terminal withdrawal with a reason, and reject unauthorized late replies. The receipt's `withdrawn` state is in PR60 at `79a29a3`, separate from decline and no response (R-05).
3. **Window.** Split the rehearsal into resumable phases. Two hours is a provisional timebox, total elapsed time includes waiting, and the actual Wednesday window is confirmed with participants ([Phases](#phases)).
