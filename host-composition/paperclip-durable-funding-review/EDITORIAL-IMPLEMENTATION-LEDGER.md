# Native editorial integration ledger

Base: exact deployed native fed4b8d45a255855bcfdba99105f7f24ff571de8.
Worktree: /tmp/inertia-native-draft-editorial-review-20261029.
Compiled full candidate: /tmp/inertia-native-editorial-fixture-20261029/candidate.
Plugin exact-live four-file publication overlay: /tmp/inertia-editorial-plugin-runtime-20261029 (source bc3880a, separate owner).
No production writes, schema migrations, DFW changes, credential/config/grant changes.

- Reviewed implementation plan and one adversarial review are in shared critical-path/plans/charlie-editorial-review.md and charlie-editorial-plan-review.md.
- Pure identity/outcome/read-coverage/UTF8 pages tests: RED→GREEN, 4 passing.
- Real SDK registered host consumer / PostgreSQL native authority / strict provider input + actual driver declarations / native result/finalizer/outbox: four scenarios passing before the final hold-release extension (currently running). Both outcomes, same-body revision churn, material drift denial, revoked named grant, cold reviewer-run receipt recovery, unread-result denial, open structural sibling, currently running producer, genuine human and explicit dependency holds.
- Domain render result at SDK publication boundary is synthetic known bytes. Actual domain renderer was independently installed-image proven in prior a2c release; do not claim a new joined domain/SDK test yet.
- Candidate runtime changes are not yet packaged into the additive installer/overlay. Candidate is authoritative WIP for compiled authority, heartbeat, committer, executor, reconciler and session fingerprint; native source helper + catalog are in transport/native. Do not overwrite candidate by rerunning wire.py (it was the initial transform, later edits followed).
- Ruling: reuse the existing status-committer outbox, not a custom queue. A receipt-validated editorial child fallback emits a precise completed-child event despite unrelated open siblings. Normal parent holds are re-read before delivery; held intents remain in the same queued outbox and rotate behind older ready work using updatedAt, retaining original requestedAt. Existing dispatcher retries after hold resolution. No new scheduler/store/retry cap.
- Ruling: readable UTF8 pages preserve codepoint boundaries and raw UTF8 hash, rather than requiring the model to decode base64. Read ranges are audited in existing activityLog; a fresh verdict requires complete coverage of its original immutable subject.
- Ruling: existing plugin snapshot helper writes immutable numbered documents. Native resolves the current body hash but uses the earliest immutable revision with those exact bytes, preserving same-body revision continuity. Material current body drift denies new review application.

Remaining: typed-history quota compatibility; explicit source baseline RED; race/writer exclusion and additional scope negatives; actual Beta own-feedback readback/corrected revision proof; existing full-bootstrap regressions; additive pins/composer installer; final independent review and frozen source. Do not package or deploy P1 while parent prioritizes the teammate/member-app P0 deployment.

Qualification update:
- Ordinary existing own/ancestor reader extended to exact draft-review admission only. Actual SDK/PG tests prove current parent/root readable and hidden parent/sibling denial; exact immutable body still requires paged read coverage before a new verdict. Source-context inspection is not source validation, applicant-fact approval or packet authority.
- Typed-history quota compatibility, baseline old-native RED, actual PG writer exclusion (parent/config/publication), cold receipt recovery, genuine hold release and original responsibility are covered in the four main scenarios.
- Latest main source SDK/PG/journal/provider declarations: 4/4 PASS (final-exact-green.log). Pure + installer/composer: 19/19 PASS (final-installer-green.log). Composition: 47 guarded files / 42 explicit supersessions. Existing actual full-startServer source regression: 1/1 PASS (final-fullboot-green.log).
- A combined parallel test-file invocation failed from both legacy fixture files creating the SAME /tmp/case-native-sql directory; final bootstrap was rerun alone in a fresh container, no product change. Do not report the combined attempt as product failure or passing bootstrap.
- Actual installed-image variant uses EDITORIAL_INSTALLED_IMAGE=1; asserts all ten sealed native path hashes in /opt/host, skips candidate overlays, and loads /opt/inertia-reviewed. Not yet run against a new P1 image; no deployed acceptance claimed.
- v21 fingerprint includes the actual editorial tool definitions and create_task schema, plus existing document definitions.

Remaining release gates: final independent review/freeze; installed-image proof after the P0 v0.1.1 baseline is preserved; actual independent Charlie findings and version-linked Beta correction. No P1 live rollout while operator owns P0 profile deployment.

Frozen source candidate: all owning tests above green; independent whole-branch review requested and pending. This is source qualification only, not deployment or live critique acceptance.

Final review correction:
- Independent reviewer found the LIMIT501/>500 read-audit completion cap could strand a fully read draft after legitimate rereads. Actual native PostgreSQL RED reproduced with 510 duplicate partial rereads after complete reading.
- Replaced the total-event cap with SQL DISTINCT ranges filtered by the same company/child/run/agent/system actor/action and exact version/document/revision/body hash/byte length. The existing safe-integer, bounded-range, no-gap coverage predicate remains mandatory. Foreign actor/run/hash or a genuine gap cannot authorize a result; no ledger/store/framework changed.
- Actual SDK/nativePG/journal/callback regression 4/4 PASS (reread-green.log), pure/installer/composer19/19 PASS (reread-installer-green.log). Only native-draft-review runtime changed; patch/pins/composer digest updated, 47/42 retained. Full-startup1/1 prior proof remains applicable to unchanged bootstrap path; updated helper is dynamically imported by the 4/4 regression.
