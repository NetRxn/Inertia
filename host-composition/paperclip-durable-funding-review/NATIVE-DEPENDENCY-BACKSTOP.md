# Native dependency wake backstop current-decision guard

Source-only candidate for Paperclip `2026.1012.0`, upstream
`bba6a45f0d364cfd962ac59b3bdf2426a8222adb`. This does not authorize deployment,
intake release, task edits, provider runs or publication.

The pinned native arbiter deliberately leaves `current_track_blocker_waiting`
and `task_wide_blocker_bound` tasks blocked under their explicit unblock owner.
The periodic/finalize dependency backstop previously treated any completed
historical `blocks` edge as eligibility for another `issue_blockers_resolved`
wake. Because the wake key includes the new blocked-transition timestamp,
repeated native blocked decisions can create new keys for the same old dependency.

The shared candidate query now excludes only an authoritative current applied
native decision with either explicit nondependency wait reason. Authority requires
`issues.lastStatusDecisionId`, exact company and issue, `toStatus=blocked`, and
numeric `decisionJson.projectedStatusVersion = issues.statusVersion`.
The committer writes projected status version in decision JSON; decision version
is a separate sequence and is deliberately not used for this check. JSON numeric
comparison avoids unsafe casts and does not treat a string version as authority.
Both full/cursor scans and blocker-targeted finalize reconciliation use this query.

Native `durable_dependency_blocker_bound`, legacy tasks with no decision, stale or
unlinked decisions, proposed decisions and unrelated reasons retain the existing
readiness, deduplication, active-path, interaction and pause-hold gates. This guard
does not modify the arbiter, committer, dependency wake keys or persisted records.
It does not add a timer, retry budget or alternate controller. The query establishes
authority at candidate selection. Both candidate projections carry `statusVersion`;
delivery passes the existing native `issueStateGuard` with blocked status, exact
assignee and that version. The heartbeat enqueue transaction checks this snapshot
under its existing issue lock and records a skipped receipt when it has changed.
No new locking or delivery controller is introduced.

## Packaging and isolated qualification

- `patches/native-dependency-backstop-source.patch` is the reviewable TypeScript
  change against the pinned upstream source.
- `patches/paperclip-2026.1012.0-native-dependency-backstop.patch` applies the same
  query change to the exact installed compiled recovery service.
- `patches/native-dependency-backstop-pins.json` pins both patch hashes, base and
  candidate module hashes, native package/build identity and exact reviewed composed
  arbiter/committer bytes. The committer guard is the existing native domain-review
  composition (`f85fc7b0…`), not the stock upstream module (`b4098812…`). The installer rejects drift and symlink paths before writes,
  uses a zero-fuzz dry run, and verifies the result. Reapplication is idempotent.
- Apply only in an explicitly authorized isolated composition with
  `node scripts/apply-native-dependency-backstop.mjs`. Normal bootstrap and Docker
  launch composition are not changed by this source-only candidate.
- Run `tests/native-dependency-backstop.test.mjs` with `QUALIFY_DISPOSABLE=1` and
  `QUALIFICATION_NATIVE_ROOT` set to the disposable pinned package directory.
  It starts native embedded PostgreSQL with real migrations and invokes the actual
  `recoveryService`. Only enqueue delivery is replaced with a recording stub;
  no heartbeat or provider is invoked. It accepts no external database URL.
- Run `tests/native-dependency-backstop-installer.test.mjs` against those packages
  for idempotence and refusal-before-write checks. It constructs temporary copies
  and can reconstruct the exact baseline from a candidate installation.

The regression also intercepts delivery after real recovery candidate selection,
commits a new synthetic status version, then calls the actual heartbeat service.
It requires a native `issue_state_guard_mismatch` skipped receipt and zero runs.
An enqueue-argument assertion alone is not treated as proof of race rejection.
The existing upstream `heartbeat-stale-queue-invalidation.test.ts` verifies the
status/assignee branch of the same native guard.

Regression cases cover both explicit wait reasons in scan and targeted mode,
repeated blocked timestamps, genuine dependency ownership, legacy/no current
pointer, stale/future/null/string status versions, proposed/wrong-status decisions,
and unresolved dependencies. SQL foreign keys enforce company/issue ownership of
synthetic current decision records. Fixture success establishes this narrow native
backstop behavior, not provider completion, deployment or whole-case autonomy.

Primary-source refresh on 2026-10-28:
https://docs.paperclip.ing/reference/api/issues/#automatic-side-effects and
https://docs.paperclip.ing/guides/projects-workflow/routines/ . Website docs can
postdate the pinned build; source anchors are `recovery/service.ts`:
`reconcileResolvedDependencyWakeBackstop`, `native-runtime/status-arbiter.ts`
explicit blocker branches, and `status-decision-committer.ts` decision JSON and
issue status-version commit. Existing native event/review behavior remains the
selected lifecycle; the defect is the recovery path overruling its current wait.

Qualification baseline: actual native embedded PostgreSQL ran all 14 regression
cases before the repair: 10 passed, and all four explicit-wait scan/targeted cases
failed on the intended unexpected delivery (`healed=1`). This is the reproducible
failure, not a structural source assertion. Candidate execution is recorded
separately after qualification.

The exact composed committer was compared with stock during this repair. Its only
changes are the existing `nativeDomainReviewComposition` import and
`assertCompletion` hook. Numeric projected status version, issue current-decision
pointer/status-version projection and applied/proposed commit semantics are
unchanged. The backstop overlay preserves that completion-authority check.

Initial candidate qualification on the same disposable pinned composition completed
**23/23 tests passing, 0 skipped**: 14 actual-recovery-service PostgreSQL cases
and 9 isolated installer integrity cases. The original four unexpected-delivery
failures pass with only the recovery-service candidate applied. Positive cases
also persist completed synthetic delivery receipts and verify the native
same-ready-state dedup skips a second delivery. No live Docker/container, provider,
task/configuration, intake or publication change is part of this source repair.

The enqueue-race follow-up retained that initial qualification history. Against
the initial candidate, its expanded 15-case service suite produced 5 passes and
10 expected missing-guard assertion failures. With the selected status-version
guard forwarded to native enqueue, final qualification completed **24/24 passing,
0 skipped**: 15 actual-service PostgreSQL cases and the same 9 installer cases.
The added post-selection race case passed through the actual heartbeat enqueue
transaction, persisted `issue_state_guard_mismatch`, and created zero heartbeat
runs. This qualifies stale-version rejection at the existing native delivery
boundary; it does not claim provider execution or whole-case autonomy.
