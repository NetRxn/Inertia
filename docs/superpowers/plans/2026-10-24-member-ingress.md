# Bounded member ingress implementation plan

> For agentic workers: Use superpowers:executing-plans for inline implementation; an independent whole-branch review remains required.

Goal: Strict default-disabled HTTP access to candidate-only semantics, with honest fail-closed native attempt authentication.
Architecture: Reuse PR37 boundary and journal. Keep the raw HTTP ingress in the runtime library and actual native authentication in source-only host composition. The source-only opt-in native heartbeat/JWT hook and concrete PG fencing provide native attempt authentication without inventing a credential platform.
Tech stack: Node 24.11+, TypeScript ESM, native node:http, Vitest, existing pinned Paperclip/PostgreSQL harness.
Spec: `docs/superpowers/specs/2026-10-24-member-ingress-design.md`.

## Global constraints

- Baseline 89f88e8463e70426d3dd7fff85c5e88d7bebfeb6; default-disabled, no production activation or GitHub writes.
- No new scheduler, credential issuer, provider implementation, completion mutation or manifest capability.
- Preserve exact conservative task revision and untrusted candidate/replay semantics.
- No private provider implementation copied into Inertia.

## Review focus

- A global host parser must not consume an unbounded body before this adapter.
- A valid old run token must never gain a newly-current attempt epoch.
- Truncated/slow/oversized streams must release resources without boundary calls.
- Disabled and unavailable configurations must have zero authority/source/storage effects.
- Native auth and fixture attempt authentication must not be conflated in evidence.

## Task 1: strict runtime ingress

Files: create `src/contributions/ingress.ts`, `test/contributions/ingress.test.ts`.
Interfaces: `createContributionIngress(options)` returns an async Node request handler; options contain enabled(), boundary exportInput/submit and trusted authenticate(request,response), returning authenticated actor / denied / unavailable.
- [x] Write raw HTTP tests for default-disabled zero calls, exact POST routes, JSON/header/schema/body limits, truncation/deadline, synthetic actor-independent export/submit, retries/conflicts and generic failure results.
- [x] Run focused tests and record expected missing-export failure.
- [x] Implement minimal bounded reader and handler, reusing the existing boundary.
- [x] Run focused tests plus full npm test/typecheck/build and record outcomes.

## Task 2: native attempt authority, opt-in source hook and qualification

Files: create `host-composition/paperclip-durable-funding-review/member/native-auth.mjs`, `member/attempt-authority.mjs`, `member/bootstrap.mjs`, `member/patches/native-attempt.patch`, `member/patches/pins.json`, `member/README.md`, `member/source-inspection.json`, `scripts/cloud-rehearsal/check-member-ingress.mjs`, `scripts/cloud-rehearsal/check-member-hook.mjs`; modify only `scripts/cloud-rehearsal/qualify-runtime.mjs` to run the additive check and `run.mjs` to copy its source-only inputs.
Interfaces: `createNativeMemberAuthenticator({db,authority})` invokes actual pinned native actorMiddleware, denies unsupported identity, requires signed native jti equal to the current PG fencing record/process owner. Concrete begin/assertCurrent/finish hooks integrate with actual heartbeat construction only when opted in.
- [x] Write native HTTP qualification assertions that initially fail because the new adapter is missing.
- [x] Run the disposable harness and record the expected new assertion failure.
- [x] Implement concrete PG authority and opt-in native heartbeat/JWT source patch; exercise actual signed native auth, current process/controller fencing, concurrent supersession, lost begin reconciliation and no-jti/default-path regression.
- [x] Run real PG/native-services HTTP qualification, aggregate tests/typecheck/build/package; preserve sanitized receipts and source hashes.
- [x] Produce complete patch and concise independent-review package with exact passing, failed and unrun commands, rulings and remaining runtime/activation limits. Do not publish.

## Source-review correction round 1

- [x] Preserve the round-0 patch/manifest/report.
- [x] Reproduce the ordinary concurrent-checkout lock-upgrade regression.
- [x] Serialize marked checkouts with an exclusive fence and align native issue-then-run locks.
- [x] Place marked pre-parser native auth after existing host gates without changing the unmarked path.
- [x] Exclude marked handling from inherited public-authentication early returns.
- [x] Reformat existing ingress/authority routines without adding features.
- [x] Run ordinary PG concurrency and actual stock-app registration checks plus affected aggregate/package/bootstrap gates.
- [ ] Independent security qualification remains open. No flagged probes are retried; no merge/activation is authorized by the functional lane.
