# Collaborative packet review v2: source-only pilot boundary

This additive, default-unwired contract supports one deliberate human member approval of an exact packet and truthful recording of a past external submission. It is not a reviewer-administration UI, permission database, deployed route, governance verifier or submission agent.

## Separate meanings

- Preparation readiness comes from current source, eligibility, evidence, requirement and artifact checks. Independent agent review remains useful preparation, not a human approval.
- Member approval requires an authenticated human, currently verified DAO membership and current access to the application review action. No named owner or five specialist-role handoffs are the default.
- Formal sponsor signatures/certifications and applicable DAO/Vocdoni decisions remain explicit additional requirements from a trusted, versioned policy. A member approval does not satisfy them automatically.
- Submission recording is a member attestation about a selected immutable packet, not permission to submit and not independent provider verification. It may truthfully be recorded without earlier native approvals. No provider action is performed.

## Trusted boundary and history

`MemberReviewPolicy` is explicit host configuration, not agent/form JSON. Its hash binds identity/version, company, applicant, application, source scope, authoritative opportunity identity and applicable requirement references. Missing configuration or a missing current membership/application-action adapter fails closed.

The application-access adapter must recover original authenticated native/Buzz identity and verify current membership and the specific action. Public/read-only visibility, a Buzz pairing, transcript text or a caller-supplied actor/role/authority boolean is insufficient. Preserve native denials. A native Viewer label alone is neither an application review grant nor a replacement for an authoritative action decision; qualify the actual native action together with the application's ACL.

The v2 acceptance/intent/review/export schemas are separate from v1 role signoffs. Legacy receipts, grants, frozen records and cancellation semantics are not migrated, promoted or reinterpreted. One member action never fans out into five role-approval records. Actor, source identity, exact packet/version/content hash and policy hash remain in immutable audit history.

## Contract modules

- `member-contracts.ts`: policy, exact intent, accepted-source and current application-access port types.
- `member-review.ts`: strict bounded snapshots, UTF-8 text limits, exact string discriminants, timestamps and canonical policy/intent hashes. The shared timestamp domain is calendar years 0001–9999, explicit timezone and at most six fractional digits; freeze non-future/source-age comparisons preserve microseconds. These validators do not confer authority; only a qualified trusted adapter can establish access.
- `member-engine.ts`: additive `freezeMemberReviewedPacket`. It shares existing artifact byte/inventory checks, retains the current source/readiness gates and emits a distinct v2 snapshot with `submissionAuthority: false`. Additional formal requirements remain separate. The v1 freeze/vote path is unchanged.

A trusted export must read actual packet/preparation/review together. Source verification timestamps are preserved, not refreshed while exporting. `fixtures/member-review-v2-contract.json` is synthetic cross-language contract evidence, not a real policy or approval.

## Submission intent and evidence

The planned single native Mark submitted action or equivalent authenticated Buzz intent selects an exact packet and proposed date. Default selection is the latest exact member-reviewed packet; another preserved packet/date may be explicitly selected to report what actually happened. A newer draft must not silently retarget that selection. Changed selected bytes/version require readback/correction.

Receipt reference/image/email evidence is optional and can be appended later. Unchecked attachments remain unverified evidence. Reporter and any declared actual submitter are distinct. Date corrections and evidence append records rather than overwriting the original report, selected packet or review history. Reported submission must not be backfilled with fictitious earlier approval. A policy upgrade does not hide that factual submission or permit a duplicate report: its original policy hash, reporter, selected packet and review-at-reporting remain intact. Current-authorized later evidence/corrections can append across policy versions; review eligibility itself stays policy-specific.

Identical source/action replay returns the original result; conflicting content conflicts. Explicit cancellation before application blocks the effect; after application it reports already applied and does not undo history. Missing or disconnected immutable-source records require reconciliation for both apply and cancellation, even when a durable outcome exists; trusted local readback remains the authority on that outcome. Do not infer rejection or retry blindly.

Reviewed/final/submitted records and accepted-action audit are meaningful retained records. The 90-day draft default is planning metadata only. No deletion activation or cleanup job is included.

## Remaining qualification

This first slice is source/fixtures, not end-to-end completion. Native/Buzz v2 capture/transport, current membership/application ACL adapter, deployment authentication, actual policy references, qualified writer/retention composition and a real human walkthrough remain separate gates. No new worker capability, role grant, live membership, recurring task, vote, deployment, external communication or submission is created.
