# Independent transport boundary review

Reviewed 2026-10-24. Scope: the default-disabled source composition, its tests, README and implementation plan; the qualified native capture/authentication implementation; and the existing DFW durable review service. No deployment, credentials, grants, Git publication or production operation was performed by this reviewer.

## Assessment

No unresolved important finding remains in the reviewed source after the fixes below. Suitable for source-only integration review, **not production activation**. The lifecycle, least-privilege credentials, host HTTP resource limits, real PostgreSQL domain composition and authenticated end-user walkthrough remain explicit activation gates in README.md and NEEDED-FROM-TEAM.md.

The boundary preserves the existing authorities: native capture supplies the human acceptance, current transport credentials permit delivery/readback, and the DFW domain transaction owns application, cancellation and terminal idempotency. The transport accepts IDs rather than caller commands or reviewer identities. Terminal lifecycle acknowledgement requires matching scope, acceptance ID, exact receipt digest and authoritative applied/cancelled outcome.

## Findings resolved during review

1. **Important: a nonterminal first receipt starved every later receipt.** The original reconciler threw on a DFW 409 before checkpointing. Independently reproduced with two scoped receipts: three invocations remained at a null cursor and never attempted the valid second receipt. Fixed by treating the cursor as scan progress only, retaining unresolved work as pending without acknowledgement, and retrying it on later full sweeps. Regression: `one stale receipt does not starve later receipts and is retried on the next full sweep`.

2. **Important: legal aggregate response size caused permanent pagination failure.** Independently reproduced a default 100-receipt page with legal 4,000-character multibyte reasons: HTTP 502 at limit 100, HTTP 200 with 623,286 bytes at limit 50. Fixed with byte-bounded source pages and a continuation at the last consumed row. An individually oversized scoped record is explicitly deferred, never acknowledged, while later independent records remain reachable. Deferred IDs are bounded, unique and cursor-validated. Regression tests cover both aggregate paging and oversized individual records.

3. **Important: an existing DFW router could silently use a replacement source mapping.** Independently reproduced creating router A, replacing its service reader with source B at another origin, then obtaining HTTP 200/applied through A while the response still named source A. Fixed by snapshotting reader identity, scope/origin and database/engine identity, checking them before and after resolution, and refusing changed wiring even for cached offline terminal reads. Credential rotation remains inside the originally configured secret resolver. Twenty focused online/offline mapping regressions passed independently.

4. **Integration risk: page-count bounds did not fit the native job runtime.** The installed scheduler has a five-minute job RPC timeout and the SDK permits 30 seconds per HTTP request. The original default could make hundreds of sequential requests before a page checkpoint. Fixed with a six-request invocation budget, uncertain-outcome readback reservation, and sorted per-record checkpoints for both normal and deferred IDs. All page provenance is validated before effects. The remaining lifecycle, DNS, secret and state latency must still be qualified by the owning host; the code does not claim arbitrary callbacks are time-bounded.

## Independently executed checks

- Native transport tests under the qualified hardened disposable PostgreSQL launcher: **8 passed**. These use the actual `actorMiddleware`, board-key service and native capture; byte-page tests substitute only the capture-list output for boundary-size cases.
- Final reconciler tests: **14 passed**, including restart, partial failure, exact uncertain-result readback, deferred records and six-request budget.
- Focused DFW authority/race/readback suite: **29 passed**, covering authentication, tampering, cached/offline authority, cancellation ordering/concurrency and unsafe native responses.
- Final DFW live/cached mapping-change regressions: **20 passed**. The first attempt omitted the newly required explicit `DFW_SOURCE_ROOT` and stopped at collection; rerunning with the qualified source root passed.
- Direct adversarial reproductions for findings 1–3 were executed before their fixes; no source file was changed by the reviewer.

Additional recorded evidence was inspected, not independently rerun in full: final native **44 passed** (36 existing + 8 transport); three real native-PostgreSQL-to-FastAPI/durable-SQLite HTTP scenarios; current Inertia serial **516 passed**; current DFW **1,104 passed, 5 skipped, 1 failed** because the repository manifest lists an absent presentation artifact. Do not describe the overall DFW suite as green or the SQLite HTTP rehearsal as production PostgreSQL qualification.

## Remaining activation boundaries

- The SDK HTTP host buffers up to 200 MiB before RPC; the adapter's 1 MiB parser limit is not a pre-buffer memory guarantee. Private-address denial must not be bypassed.
- Scope hashes provide binding, not authentication or signatures. TLS, current verified principals and immutable source/destination mappings remain required.
- Generic board/admin credentials are not thereby least-privilege credentials. Host credential grants and access-log redaction require qualification.
- Lifecycle callbacks are trusted approved capabilities, not a new retention/deletion policy. Tests acknowledge synthetic terminal records only; they do not approve or perform archival/deletion.
- The wrapper deliberately relies on existing DFW private service seams. Requalify those seams, native capture and the PostgreSQL legacy-writer fence on upgrades.
- No live human UI walkthrough, deployment, real tenant transfer, submission or recurring schedule has been qualified by this review.

## Reviewed source fingerprints

SHA-256 at review completion:

- `native/acceptance-routes.mjs`: `da42f4bc52059974678cd4d620041958a468b10e64a360a64e3f282aa6a5fb99`
- `native/reconcile.mjs`: `a14d92d25cc13d12ea09db72ca7b31fc9c109c2142a6ea731f595b5c0efdd302`
- `dfw/review_transport.py`: `1cbc928dc1596c19080b22d3f97c0e5be64d3e9f289b3402c3ab64d5f528e568`

## Packaging addendum

Verified the split-package DFW module at `payload/dfw/government-funding-dfw/src/dfw_incentives/review_transport.py` against the reviewed module. The complete diff moves only the `DurableNativeFundingReviewService` import below third-party imports and adds the separating blank line, matching project Ruff import grouping. No function, validation, route, constant or other implementation changed. The source assessment above therefore also applies to this normalized installed-package copy, SHA-256 `376857c28d483e6f1fa8c4f254b0b089ceb8328a29f986995ee721076117ec85`. This addendum verifies the packaging diff, not a new test run or production activation.
