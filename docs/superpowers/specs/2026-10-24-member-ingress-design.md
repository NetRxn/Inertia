# Bounded member HTTP ingress design

Baseline: Inertia develop `89f88e8463e70426d3dd7fff85c5e88d7bebfeb6`, exact tree `c757816c6167e9fd82706a184742a85591511eef`. Node 24.11+, public Paperclip 2026.1012.0 / `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`.

## Intent and scope

Expose only PR37's curated input and immutable untrusted-candidate staging through a strict, default-disabled HTTP adapter. Do not add task acquisition, scheduling, credentials, provider control, review dispatch, completion, manifest capabilities or activation. No shared production host is modified.

## Approaches and ruling

1. Treat native signed run JWT or current provider generation as attempt authority. Rejected: a JWT names a run, not a non-reusable execution incarnation; reuse/reconstruction can preserve that identity. Assigning its caller the current epoch silently upgrades stale authority.
2. Add a new credential issuer and lifecycle store. Rejected: this would be a second execution authority platform and lacks the owning native execution hook.
3. Add a small source-only opt-in hook at native heartbeat JWT construction and pre-dispatch ownership assertion, backed by a concrete native PostgreSQL fencing record and existing signed JWT jti. Chosen after direct source inspection; default unmarked paths remain unchanged; only explicitly marked member-attempt JWTs receive the additional native guard. This bounded engineering design was approved on 2026-10-24.

## Boundaries

`src/contributions/ingress.ts` owns exact POST `/export` and `/submit`, no queries/trailing aliases, application/json UTF-8 only, no content encoding, duplicate sensitive-header rejection, a 1 MiB pre-parse byte ceiling and a 10-second whole-body deadline. This accommodates JSON escape expansion of PR37's 128 KiB inert artifact ceiling. It rejects previously parsed bodies and must mount before a host's global JSON parser. Disabled/missing dependencies return before reading the body or calling any authority/source/native/journal dependency.

Authentication is an explicit trusted transport seam returning authenticated actor, denied or unavailable. It never reads member/agent/epoch authority from JSON. This seam is not a production authenticator. The owning-host adapter invokes the actual pinned actorMiddleware, accepts only signed agent_jwt with current responsible-user membership, rejects ambient board/session/local/agent-key identities, and separately verifies the native signed jti against the current persisted attempt and native process/controller ownership. Marked tokens are also fenced on ordinary native routes and restricted to exact POST member export/submit and their exact native issue checkout; unconfigured hosts deny them. A pre-parser guard prevents rejected marked requests from reaching global JSON parsing. Marked checkout holds the current fencing record inside the same native transaction as existing issueService(tx).checkout, disallows closed-workspace reopen/stale adoption, rolls back failure, and returns only a bounded receipt. Begin locks the fencing row before native rows to avoid inverse lock ordering. It never upgrades a run token to the latest epoch. Missing opt-in hook or absent jti is denied.

Existing boundary authorization, artifact validation, exact binding, native run/checkout checks, immutable journal/reconciliation and candidate-only semantics are unchanged. Sequential reauthorization is retained; this slice does not provide linearizable revocation of input release. Authentication errors are generic and no credential/request/native payload is logged.

## Native hook and remaining limits

The owning execution orchestrator must issue a fresh, non-reusable incarnation at the actual execute/reconstruct/handover boundary, authenticate a protected channel to that incarnation, and retire/fence it atomically before supersession/restart can admit another. Signed run identity alone cannot authenticate the incarnation. Resume/execute must carry trusted native run and incarnation identity independent of caller-controlled environment labels. Current provider ownership remains the provider's responsibility. A scoped read/authorize hook must reconcile uncertain issuance and never resurrect an earlier incarnation on X→Y→X. This slice implements the narrow legacy native-JWT adapter hook and current-process fencing; native-runtime runner credentials are excluded. Full native app mount retains hostname/cloud-identity/warm-standby gates but remains a separate full-host qualification. Existing process boot UUID and renewable controller lease are reused, not replaced. Provider generation is never an epoch. One bridge_runtime row per company/issue is a fencing record, not a task ledger. Begin checks current native execution ownership, issue and membership before replacing the epoch; issuance/pre-dispatch may precede native checkout, but ingress readCurrent and PR37 always require exact in-progress checkout. Lost responses reconcile the same random epoch without retrying the write. Pre-dispatch assertCurrent fences supersession/cancellation. Conditional finish cannot retire a successor. Host restart fails old epochs by exact process boot identity even before a new begin. This qualifies one owning host process; arbitrary replica routing fails closed and is not qualified.

## Qualification and limits

Unit HTTP tests exercise raw/streaming bytes, disabled zero access, forged fields, exact routes, request deadline/abort and synthetic authenticated candidate flows. A disposable real PostgreSQL/native-services HTTP fixture uses actual native middleware and signed synthetic run JWTs for denial; the actual opt-in native attempt authority exercises two native members, replay/conflict/lost-response, revocation and stale epochs without claiming provider execution. Candidate tasks remain in_progress; the cancelled-before-checkout task remains todo, never completed. Aggregate tests/typecheck/build/package and independent parent review gate publication. Native review/display/atomic completion and live NTF11 remain separate.

## Source-review correction round 1

The marked-only pre-parser route runs native hostname, cloud identity and standby gates before native authentication; unmarked host ordering is unchanged. Marked credentials cannot take the ordinary public-ingress early-return branches. This is a source control-flow correction; independent security qualification remains open.

Checkout takes an exclusive fencing-record lock and native issue then run update locks before invoking the existing native service, avoiding concurrent shared-to-exclusive upgrades. Ordinary current-authority reads use native issue-then-run order too. Focused ordinary PG regressions cover two valid checkouts and a current read against native clearing. Actual stock createApp registration is inspected without public-route HTTP probes; full HTTP/security activation gates remain.
