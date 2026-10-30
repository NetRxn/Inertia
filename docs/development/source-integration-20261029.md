# Repository source integration — October 29, 2026

## Teammate quick navigation

| What you need | Exact branch and link |
| --- | --- |
| Current member app | [`claude/member-app-feed-redesign-cf004e`, `apps/member`](https://github.com/NetRxn/Inertia/tree/claude/member-app-feed-redesign-cf004e/apps/member), peer-owned PR #141 |
| Integrated plugin/native source | [`develop`](https://github.com/NetRxn/Inertia/tree/develop): `src/` and `host-composition/paperclip-durable-funding-review/` |
| Funding domain | [DFW-Gov-Fund `main`, `government-funding-dfw`](https://github.com/NetRxn/DFW-Gov-Fund/tree/main/government-funding-dfw) |

Use these direct links or select the exact branch in GitHub's branch dropdown above the file list. Local read-only navigation is `git fetch origin`, then `git log --oneline -5 origin/develop`; it does not switch or reset the peer checkout. The member app is still on its peer-owned stack.

The submission integration target is `develop`. Native/plugin source and demo documentation are integrated through [PR144](https://github.com/NetRxn/Inertia/pull/144) and [PR139](https://github.com/NetRxn/Inertia/pull/139). The source integration landed at `181ecc7ef83b6a622b5ba976fba3c3abc4c39a7e`; its tree exactly matches tested candidate `e18c9ce7f786f22c86cc062cf8bc82db09675905`.

## Evidence

- Node 24.22.2 full aggregate: 1,139 passed, 5 explicit optional skips, exit 0. Cross-repository capture qualification supplied its explicit reviewed DFW fixture; five other optional private fixtures were skipped.
- [Final candidate CI](https://github.com/NetRxn/Inertia/actions/runs/40977418494) and [actual develop push CI](https://github.com/NetRxn/Inertia/actions/runs/40977895355) passed. Automatic CI checks locked install/typecheck/build; full tests were run locally.
- Production package: 190 files, 8 migrations, production dependencies only, private files excluded. Focused extraction 30/30; native unit 33/33; composed/org 11/11; independent composed-pin repeat 8/8.
- Six native conflicts reconciled without replacing develop's newer bridge/notes/deployment sources. Final composer lists 16 overlays and 33 explicit supersessions.
- Exact native `fed4b8d`, plugin `68386de`, paging `d2066aa`, capacity `19d194a`, reconciliation `2d4900d`, AI binding `cd26255`, deferred wake `044b95d`, extraction `9a30c5e` and docs `f2bc070` are ancestors of integrated develop.

## PR and branch disposition

87/135/136 were automatically marked merged; stacked 137/138/140/143 were closed with replacement #144 references only after exact-head ancestry verification. Their work and history remain preserved.

37 completed native/funding/CI branches were pruned only after verifying the exact remote tip matched a merged owner PR and was contained in develop. No active-owner, peer, open-PR-dependent, unknown or unmerged branch was deleted. Remote heads reduced 130 → 95, including two source/integration recovery branches. This count is a dated checkpoint, not a live counter.

| Remaining PRs | Ownership or gate |
| --- | --- |
|70/74/75/86/105/116/118/120/125/141/142|Member-app/peer lane preserved; no unilateral merge, closure, retarget or active-checkout changes|
|51|Member-ingress full-HTTP/security qualification remains open|
|81|Buzz scaffold installed-host/architecture qualification remains open|
|85|Native receipt-bound actual PostgreSQL qualification remains open|

Member/app and unknown branch ownership remains under peer coordination. Those histories are retained until ownership and preservation are verified. Patch equivalence alone is never deletion authority.

## Reproducible public tests

The public test command no longer executes personal filesystem paths. Six cross-repository test files use explicit `INERTIA_DFW_SOURCE_ROOT` and `INERTIA_DFW_PYTHON` inputs; unconfigured tests skip visibly, while partial or invalid configuration fails. All original assertions remain in place. Two intake test fixtures canonicalize temporary directories so macOS aliases do not cause false failures against the unchanged production path guard.

On Node 24.22.2, the public aggregate with all private fixture variables unset passed **1,132 tests, 12 skipped**, exit 0. The six configured files passed **11 tests** against the reviewed DFW source. Typecheck and whitespace checks passed. These changes affect documentation/test harnesses only.

## DFW dependency

[DFW82](https://github.com/NetRxn/DFW-Gov-Fund/pull/82) at `dfe686aa702410995111c116defb0b16b91299f6` preserves the #79 → #80 → #81 source stack and prevents fallback regeneration after losing a concurrent claim to a newly parked case. Independent review and 2,274 local tests passed, 6 skipped; full Ruff/mypy (172 files)/compileall/manifest checks passed. [Exact pinned Python 3.14.6 CI](https://github.com/NetRxn/DFW-Gov-Fund/actions/runs/40977149722) passed all checks, including 2,274 tests/6 skips, build and migration smoke. PR #82 merged to main `5847675b6f7148a06a74b27a02af6cbce87ad1b9`, whose tree equals tested `dfe686a`.

Source integration does not establish runtime deployment, completed funding applications, real Buzz delivery, notes ingestion or human acceptance. The current mission remains a general Coordinator with P0 funding/P1 Buzz/P2 notes; full funding acceptance is the whole actionable portfolio.

## Frozen paired follow-up

The next reviewed pair is Inertia #146 at `78bd5fc038bab58cfab347663c6cfca2197d95de` and DFW #83 at `b85182e5f2a808d9ba1ffc10c469218de22ad2c7`. The domain adds bounded correction reasons and preserves a genuinely unknown deadline under independent review without erasing known deadlines. Integration candidates merge these heads onto current canonical branches, retaining DFW main's `dfe686a` lost-claim fix. Exact combined validation and merge outcomes are recorded separately.

The operator-reported VPS c5 deployment is separate from Git integration. This source report does not establish develop/runtime parity.
