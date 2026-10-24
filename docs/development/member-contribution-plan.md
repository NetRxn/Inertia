# Member contribution candidate boundary

## Scope and baseline

Verified source: develop da902be0b7e0dcce935c8d4bc4cc0f6e9ede30c0, tree 669f28ede5d5d9878fb8dd8f6c9e77265a249bf4. R-C01–04 and T-C01–03/T-S02–05/S10 motivate this incremental boundary. NTF11 still requires a real participant, explicit enrollment and qualified runtime. R-C05 follow-up creation is not included.

Reuse native eager assignment, checkout, runs and human review. Do not introduce a scheduler, sandbox manager, credential grant or completion writer. The public pinned SDK's company-wide reads are not member authorization. Its assertCheckoutOwner may adopt stale runs; checking it before update is not an atomic acceptance fence. Therefore this slice only stages immutable untrusted candidates for native review, never authoritative completion.

## Implementation sequence

1. Add adversarial tests for disabled zero export; two isolated member/agent bindings; wrong/revoked/expired enrollment; changed native task/run/checkout and lifecycle; guessed IDs; strict artifact schema, size/hash/type/path rejection; identical retry, conflict and lost response.
2. Add contracts, artifact validator and service. Resolve enrollment and curated input only from a server-owned source, use authenticated principal from trusted transport, recheck snapshots before staging. Freeze/copy authority snapshots across awaits. No raw issue data, credentials or URLs in exports. Transport authentication and atomic export/revocation coordination remain activation requirements.
3. Add concrete pinned PluginContext native read adapter. Read only exact preauthorized issue/agent/run and do not call checkout, assertCheckoutOwner or update. Add PostgreSQL immutable journal through native plugin database APIs using existing bridge_runtime receipts (no migration or new table). A journal receipt means candidate stored, not acceptance.
4. Exercise actual pinned native services with synthetic members and hostile outputs in the existing disposable harness. Native checkout competition and stale adoption are tested separately from candidate validation. No private runner implementation copied into this repository.
5. Run focused tests, aggregate tests, typecheck and build, then independent review. Record hashes and exact limitations. No shared worker/config/manifest edits or activation.

## Acceptance gate not provided by pinned SDK

A future completion adapter must own a native transaction (or qualified equivalent) atomically checking current membership, enrollment expiry/revision, company/project/task revision, run and checkout, plugin lifecycle generation, artifact policy and immutable operation identity while recording one completion. Journal staging is not a substitute. An uncertain completion must reconcile its immutable operation, not retry a generic issue update. Live runner isolation, permissions, and native final review remain separately qualified before activation.
