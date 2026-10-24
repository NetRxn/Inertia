# Wednesday existing-agent rehearsal plan

Status: **planning and acceptance cases only**, for [#48](https://github.com/NetRxn/Inertia/issues/48). Prepared 2026-10-24 against `develop` `3560f1e`. Target: operational and rehearsed on **Wednesday, October 28, 2026**. Submission deadline: Friday, October 30, 11:00 a.m. CDT.

This plan follows the [maintainer's suggested rehearsal](https://github.com/NetRxn/Inertia/pull/59#issuecomment-6388561995): **one sourced brief → a prepared member ask → the response incorporated into the funding case**, carried out by the system agent with a bounded contribution from the existing authorized Buzz agent.

It runs nothing and authorizes nothing: no provider execution, enrollment, credentials, permission changes, deployment, live data transfer, votes or external submission. It does not claim [PR51](https://github.com/NetRxn/Inertia/pull/51) or untrusted member-owned runtime isolation. Every live step waits on the bindings listed under [Unresolved bindings](#unresolved-bindings).

## Roles

Roles, not named people. Any verified member with current application-action access can fill the member role.

| Role | Does |
|---|---|
| Rehearsal coordinator | Confirms the case, window and participants (NTF14, NTF15), and runs the cases below |
| System agent | The registered Paperclip run that researches, drafts and incorporates responses (NTF05) |
| Existing Buzz agent | Contributes one bounded section within the application scope (NTF07, NTF11) |
| Member | Answers the prepared ask and, if ready, confirms the exact version (NTF02, NTF09) |
| Buzz operator | Confirms the relay, thread, audience and reply/readback path (NTF07) |

## Flow

| Step | What happens | Surface | Evidence |
|---|---|---|---|
| 1 | Coordinator confirms the selected case, backup, window and audience | Protected channel | NTF14 reference |
| 2 | The system agent's run is registered for the case's native task | Paperclip | `runs[role=system]` |
| 3 | **Sourced brief (M4).** Query saved knowledge through the SQL named tools first, research remaining gaps, write back the useful delta, then render the brief | Native document or comment | Tool invocations, admitted sources, `art:opportunity-brief` v1 |
| 4 | **Draft.** The system produces a near-complete application draft plus an independent agent critique | Native document | `art:application-draft` v1 |
| 5 | **Bounded collaborator contribution.** The existing Buzz agent contributes one scoped section | Buzz thread mirrored to native | `runs[role=collaborator]`, `bounded: true`, `art:collaborator-section` v1 |
| 6 | **Prepared ask (thin M5).** One specific ask with context and a definition of done goes to a member | Native task or comment, with a Buzz reply path | `asks.offered` |
| 7 | **Incorporation.** The member's response is incorporated into a new draft version | Native document | `art:application-draft` v2, `corrections`, `asks.accepted` and `asks.completed` |
| 8 | **Attribution (M6-lite).** The member's and agents' contributions are attributed with evidence inside the existing task | Native task | Contribution records and the receipt |
| 9 | **Exact-version confirmation, if ready.** One verified member confirms the exact packet version (v2 policy). Mark submitted is shown as a version-bound attestation only, never a submission | Native or authenticated Buzz action | Native v2 records (not part of the receipt) |
| 10 | **Receipt.** Assemble and validate the #54 receipt | Local | `node scripts/demo-evidence/validate-receipt.mjs <receipt>` ([PR60](https://github.com/NetRxn/Inertia/pull/60)) |

Votes, sponsor signatures and certifications apply only if the selected case or funder actually requires them (NTF08). Park Place stays a historical human-submitted reference and is never presented as this run's output.

## Acceptance cases

| ID | Case | Setup | Expected | Evidence |
|---|---|---|---|---|
| R-01 | Success | Steps 1–10 with all bindings admitted | Brief, drafts v1 and v2, a bounded Buzz section, one ask accepted and incorporated, and a valid receipt with `qualificationEligible: true` for review | Native readbacks and the receipt |
| R-02 | Interruption and recovery | Stop the system run after the step 3 writeback, before the brief is published, then resume | The resumed run reuses the saved knowledge with no duplicate native mutation, and an uncertain native outcome is reconciled by readback before any retry | Native history and a single brief version |
| R-03 | Buzz delivery unknown | The relay is unreachable while the step 5 or step 6 reply is delivered | `BuzzDeliveryUnknown` keeps the stable event ID, and the retry resends the same signed event rather than re-signing. One reply causes one native mutation | Relay readback and native history |
| R-04 | Denial | An agent, a public-only viewer or a non-member tries to answer the ask or confirm the version | Denied, with the native denial authoritative and nothing incorporated or confirmed | Native denial records |
| R-05 | Revocation | The member's access is revoked after the ask is sent and before the response arrives | The response is not incorporated and confirmation is denied. The ask is closed and recorded honestly, not as a member decline | Native records; the receipt ask state (see open question 2) |
| R-06 | No response | The member doesn't answer within the window | Recorded as `noResponse`, never as `declined`, and excluded from response time. The coordinator may send one alternate ask | Receipt `asks.noResponse` |
| R-07 | Stale version | A member confirms v1 after v2 exists | The confirmation binds v1 only and never silently retargets to v2; v2 needs its own confirmation | Native v2 records |
| R-08 | Reference substitution | A manual reference packet is labelled as system output | The receipt validator rejects it (`CLASS_MISMATCH`) | Validator report |
| R-09 | Collaborator overclaim | The Buzz agent's section is presented as the complete outcome | The receipt validator rejects it (`SCOPE_OVERCLAIM`) | Validator report |
| R-10 | Unknown usage or cost | Provider usage or billing isn't exported | Recorded as unknown with a reason and no total; never $0 | Receipt `measurements` |

R-02, R-03, R-04 and R-07 reuse behavior that source tests already cover. The rehearsal checks that this behavior holds on the actual bindings. R-08 to R-10 can run now against synthetic receipts.

## Receipt mapping

[`expected-receipt.json`](expected-receipt.json) is a synthetic target showing the shape a successful R-01 receipt should have. It is labelled `synthetic-fixture` and validates against PR60 at `92904061` (valid, not eligible). Every reference in it is a placeholder for a protected binding.

| Plan step | Receipt field |
|---|---|
| 2, 5 | `runs[]` (one `system`, one `collaborator`) |
| 3–5, 7 | `toolInvocations[]` (digests only) and `admittedSources[]` |
| 3–5, 7 | `artifacts[]` and `contributions[]` |
| 7 | `outcome` = `art:application-draft` v2, produced by the system run |
| 6–7 | `measurements.asks`, `measurements.corrections` |
| 2–9 | `measurements.wallClock`, `measurements.activeHumanTime`, `usage`, `cost` |
| 9 | Not in the receipt. Member confirmation and Mark submitted live in native v2 records; a valid receipt is not an approval |

## Unresolved bindings

None of these is recorded as received in public issues as of 2026-10-24. Actual values travel only through protected channels.

| NTF | Binding needed | For steps | Lane |
|---|---|---|---|
| NTF14 | Selected case and backup, participants, window, permitted audience | 1 | [#49](https://github.com/NetRxn/Inertia/issues/49) |
| NTF05 | Existing runtime and tool references, pilot budget, usage/billing export | 2–4, 7, measurements | [#45](https://github.com/NetRxn/Inertia/issues/45) |
| NTF04 | Deployment and authorized SQL domain-tool binding | 3 | [#45](https://github.com/NetRxn/Inertia/issues/45) |
| NTF12 | SQL knowledge routes, canonical IDs and source scopes for the case | 3 | [#49](https://github.com/NetRxn/Inertia/issues/49) |
| NTF07 | Existing Buzz agent identity, relay, pilot thread, audience and reply/readback path | 5, 6 | [#45](https://github.com/NetRxn/Inertia/issues/45) |
| NTF11 | Confirmation that the Buzz contribution fits inside the application packet | 5 | #48 |
| NTF02 | Authoritative current membership and application-action ACL source | 6, 7, 9 | [#46](https://github.com/NetRxn/Inertia/issues/46) |
| NTF09 | One available verified member for the walkthrough | 6–9 | [#46](https://github.com/NetRxn/Inertia/issues/46) |
| NTF06 | Storage and archive binding for retained reviewed records | 7, 9 | [#45](https://github.com/NetRxn/Inertia/issues/45) |
| NTF13 | Financial source, **only if** the case needs financial facts | 3, 4 | [#49](https://github.com/NetRxn/Inertia/issues/49) |
| NTF08 | Governance example, **only if** the case requires a vote or signature | 9 | — |
| NTF15 | Recording logistics and permission to show sanitized material | All | — |

Two engineering seams are also open:
- The owning host or runtime must compute the argument, result and run-ID digests, so raw values never reach the repository.
- Native/Buzz v2 action wiring is pending. It sits outside this claim; the native Packet-tab Task 2 claim is in [#40](https://github.com/NetRxn/Inertia/issues/40).

## Open questions

1. Is the step 6 ask delivered as a native task assigned to the member, as a comment on the case task, or as a Buzz message? This plan assumes a native task with a Buzz reply path.
2. How should a revoked or withdrawn ask (R-05) be recorded in the receipt? The receipt format has no `withdrawn` state yet. Adding one to PR60 is a small follow-up if wanted.
3. Is a two-hour wall-clock window realistic for the selected case, or should the rehearsal be split across sessions with separate boundaries?
