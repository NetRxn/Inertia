# Demo documentation and artifact sweep

October 29, 2026. Scope: entry points, architecture, artifacts, source release contracts, installation and presenter claims. Documentation-only; no runtime/DB changes. This is a bounded inventory for tomorrow's demo, not certification that every historical report is synchronized.

| Surface | Finding and treatment |
| --- | --- |
| Current mission / progress | Mission retains full portfolio/general Coordinator/P0-P1-P2 scope; progress is the current runtime authority. Historical healthy baselines cannot override the incident. |
| Mission README | Added prominent demo/current-status pointer; corrected local-Docker target to VPS. Older paragraphs remain historical. |
| Architecture index | Replaced opening switcher with a dated proof map and six capability cards. Saved former switcher as architecture-targets.html. Existing diagram generator now writes only that historical target page, so regeneration cannot silently replace the current index. |
| Architecture SVG/PNG/deck/PDF | Preserved. Existing docs explicitly warn these have no shared generation source and are not synchronized runtime evidence. Product PDF is historical, not rendered agent output. |
| Source release | DFW81 test failure, Inertia135 parent conflict,136 passing package check,137 stacked parent and all open/unmerged recorded in readiness. No source integration or readiness is inferred from mergeability. |
| Artifact/output | Eight-field brief / one content revision identified; three successful renders do not mean three applications. Native brief/checkpoint exists; native DOCX attachment/work-product and complete packet not established. |
| Runbooks / install | Local release-staging README says not installed/runtime-verified and local-trusted. It is not the VPS authentication/runbook. Historical operator scripts are exact incident tools, not a safe demo command sequence. |
| Skill references | Pinned VERSION fileInventory route worked in two bounded reads; FILE snapshot route correctly denied because required snapshot identity was absent. Preserve guard; do not claim funding skill content is missing or loosen grants. Role instructions do not create tool scope. |
| P1/P2 interfaces | Corpus reader handoff is specific and app-owned; existing ingest token is writer-only, app DB identity is not dedicated read-only. Real Buzz bridge pairing and notes readback/hash lookup/import are separate open gates. |

## Source and reproducible install contract

The nested local `Inertia/` checkout is an initial-commit checkout, not the delivery source. Inspected delivery source is under `/tmp/inertia-delivery-20261028/inertia`; exact frozen host/native/domain refs and receipts are linked in `OPERATOR-SNAPSHOT.md`. Use those authorities before assembling any candidate.

Source `package.json` requires Node >=24.11 and pinned plugin SDK2026.1012.0. `npm ci`, test/typecheck/build, `test:package` and `npm pack` are plugin/package checks; fixture demo commands have synthetic external I/O. They do not install all native overlays or the domain wheel or configure target identities.

The source host-composition `README.md`, `UPGRADE.md`, `scripts/bootstrap.mjs`, `scripts/verify-composed-native-pins.mjs` and additive `apply-*.mjs` scripts define pinned upstream/native composition and drift guards. A bare bootstrap does not imply every newer overlay is applied. Final composed manifest, source pins, exact qualified payload and target boot/configuration must agree. Documentation work has not rerun a build, installer or live recovery.

## Missing historical snapshot links

The outer mission review snapshot README references files absent from that snapshot (the source repository may contain them): `docs/SPRINT-COORDINATION.md`, `docs/operations.md`, `docs/bridge-state-contract.md`, `docs/reference/Inertia-beta-product-overview.pdf`, `docs/development/member-contribution-boundary.md`. The outer mission tree is a review snapshot, not a complete distributable repository. Preserve the original artifacts at their owning source; do not fill gaps with newly invented documents or present these broken links on stage. The new readiness/walkthrough/proof-map navigation uses existing targets.

## Verification and remaining limit

The new HTML parsed with six proof cards; new local links were checked for existing targets; JSON snapshot records the progress-file SHA256 and evidence cutoff. Browser policy rejected the local HTML preview. A materially safer offline export now provides three standalone SVGs and a three-page PDF, rendered with ReportLab/Poppler and visually inspected as PNGs. Cards, wrapping, margins and readable text passed inspection. No browser/server workaround was used. HTML responsive rendering remains unverified. Reproduce exports with scripts/render-demo.py using ReportLab.

Before presenting, refresh availability from the sole live operator and update both the readiness snapshot, OPERATOR-SNAPSHOT and visual HTML/JSON. The outer-workspace generator is `work/demo-docs-20261029/build_proof_map.py`; the versioned HTML and JSON here are a curated snapshot, not a live monitor. Do not regenerate it to imply newer runtime evidence without actually changing its evidence cutoff and claims.
