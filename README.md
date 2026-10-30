# Inertia

**October30 demo:** [persistent critical-path chart](docs/delivery/critical-path/index.html) · [dated readiness](docs/delivery/CURRENT-DEMO-READINESS.md), [visual proof map](docs/delivery/architecture/index.html), and [walkthrough](docs/delivery/DEMO-WALKTHROUGH.md). Current status, plans, warnings and time credits are maintained in the persistent chart; dated snapshots below remain historical. Historical claims below do not override it.

Inertia connects DAO conversations, meeting records, application packets and agent contributions. Paperclip owns native work; Buzz presents the same records. The Wednesday October 28 target uses existing authorized PostgreSQL domain tools and the existing authorized Buzz agent. Helix and Y2 are deferred, not demo prerequisites.

## Join the sprint

Use the [sprint index](https://github.com/NetRxn/Inertia/issues/40) for current priorities, claims, dependencies and ready work. The [contributor quickstart](docs/SPRINT-COORDINATION.md) covers claiming a bounded slice, verification and PR handoff without adding another project-management platform.

## Run the fixtures

Use Node.js 24.11.0 or newer. From a source checkout:

```sh
npm ci
npm test
npm run typecheck
npm run demo
npm run demo:roundtable
```

`npm test` visibly skips cross-repository DFW qualification when its fixture paths are unset. To run those tests with every assertion enabled, provide a reviewed DFW checkout and its Python runtime:

```sh
INERTIA_DFW_SOURCE_ROOT=/absolute/path/to/government-funding-dfw \
INERTIA_DFW_PYTHON=/absolute/path/to/python npm test
```

Both paths are required for opt-in qualification; incomplete or invalid configured paths fail the test run.

- **Connected bridge:** a signed Buzz reply becomes a native Paperclip comment and a signed receipt with matching IDs. The fixture demonstrates restart/replay without duplicate native writes. Native confirmation cards, recoverable receipt delivery and scoped health are implemented.
- **Roundtable ingestion:** merged Meet/Drive source adapter, durable publication recovery and reference-only native follow-up. Actual native PostgreSQL/WAL qualification passed with synthetic external I/O; the job remains default-disabled. Notes-only website output is still partial.
- `npm run demo:transport` isolates signed HTTP delivery and retry behavior.

External I/O is synthetic. Actual Drive/website, SQL/application and v2 member-action paths still require live admission; broader untrusted member execution remains separate. See [implementation status](spec.md#implementation-status).

## Build an installable plugin

```sh
npm run test:package
npm pack
```

`npm pack` builds automatically and produces a local `.tgz` containing runtime modules, SQL migrations and operating instructions. The package is private. `test:package` starts from a clean temporary source tree, packs it, installs production dependencies in a fresh consumer, imports the installed worker and validates its manifest against the pinned native schema. It also checks that development sources, test files and private files are excluded.

Install the resulting package through an admitted Paperclip plugin workflow targeting **2026.1012.0**. The package declares its manifest and worker in `paperclipPlugin`; the host resolves `migrations/` relative to the installed package. No post-install build or developer dependencies are required.

[Connection setup, configuration and recovery](docs/operations.md) · [Native authority and state contract](docs/bridge-state-contract.md)

## Product direction and artifacts

The Wednesday goal is authorized Roundtable publication plus substantial system-generated research/preparation and a near-complete current application draft, including an agent contribution/independent quality critique, exact-version member confirmation and SQL query-first reuse/writeback/next-run retrieval. Reference packets are not generated-output evidence. Existing DAO and funding repositories remain authoritative for their domains. See the [ranked remaining tasks](plan.md#recommended-remaining-work). Two-provider funding and general member/bounty scenarios test existing requirements with configurable roles and native coordination, not a new framework.

Funding and meeting records target one existing DAO PostgreSQL database with isolated schemas/roles; Paperclip keeps its independent database.

Use existing authorized PostgreSQL/domain knowledge tools, preserving source, audience, current application access and useful durable writeback. Actual SQL/application wiring still requires qualification. Helix/Y2 are explicitly deferred; future adapters remain reversible and retain their source/access/replay/removal guarantees.

The chosen v2 policy allows any authenticated, currently verified DAO member with current application action access to contribute and approve the exact version. No named application owner or default five-specialist human gates. Agents prepare/critique, never approve as humans. Actual sponsor signatures and DAO/Vocdoni governance apply only when genuinely required. Mark submitted/equivalent authenticated Buzz intent records a selected immutable packet/date, reporter and evidence level; receipt evidence is optional and may follow later. It never submits externally or invents missing earlier approvals. **V2 packet core is merged; native/Buzz and live authority integration remain pending; preserve v1 historical records and semantics.** See the [native grant contract](docs/development/native-grant-workflow.md).

The source repository keeps the synchronized [specification](spec.md), [testing plan](testing.md), [decisions](decisions.md), [implementation plan](plan.md) and [editable architecture deck](Inertia-Architecture.pptx) and [visual system overview](docs/architecture/Inertia-System-Overview.html). Editable [Mermaid diagram sources](docs/architecture/diagrams) accompany the HTML. The [original product overview](docs/reference/Inertia-beta-product-overview.pdf) is retained as historical source material.

Merge reviewed feature branches into `develop`. Keep current artifacts synchronized and the original PDF unchanged. Exclude credentials, private meeting material, local databases and runtime captures. Live deployment and funder submission require separate authorization.

### One-command connected rehearsal

Run `npm run demo:workflow` to follow one synthetic Roundtable-to-grant initiative through the existing cores, native confirmation bridge, and exact packet binding. The command prints a readable walkthrough and saves `runs/workflow-receipt.json`. See [live handoff contracts](docs/implementation/live-handoff-checklist.md) for adapter inputs, outputs, and the remaining connections.

[PR58](https://github.com/NetRxn/Inertia/pull/58) adds merged native exact-action capture to packet-v2. [Draft PR62](https://github.com/NetRxn/Inertia/pull/62) Packet UI/attestation is reviewed source, not merged/live; browser, mutual #48 recovery agreement and real authority/runtime/domain/Buzz remain pending. SQL-tool qualification is unchanged. [PR59](https://github.com/NetRxn/Inertia/pull/59) is discussion-only. Follow [#40](https://github.com/NetRxn/Inertia/issues/40) for contributor-owned PR60/61 and current claims.

Funding enhancement: [specification](docs/development/funding-enhancement/spec.md), [execution plan](docs/development/funding-enhancement/plan.md), [acceptance](docs/development/funding-enhancement/testing.md) and [source map](docs/development/funding-enhancement/source-map.md). Existing preparation, evidence, intake, meeting and legacy review cores retain their recorded qualification. [PR53](https://github.com/NetRxn/Inertia/pull/53) source-qualified default-disabled host assembly, early SDK byte/deadline bounds, manual-only invocation and native state-delete reset. [PR52](https://github.com/NetRxn/Inertia/pull/52) is controlled cross-service evidence, not deployment. Bounded receipt-read allocation, actual SQL/source/current-access wiring, remaining deployment/latency/lifecycle/authentication/network compatibility, writer fencing and live walkthrough remain gates. Notes-only website output remains partial; daily scouting stays disabled.

The [member candidate-only boundary](docs/development/member-contribution-boundary.md) is merged. [PR51](https://github.com/NetRxn/Inertia/pull/51) remains draft, unmerged/inactive ingress/per-attempt authority only. Existing authorized Buzz contribution is the achievable Wednesday path; full untrusted member-owned isolation, live enrollment/provider execution and native authoritative completion remain separate unqualified work.

## Team integration handoffs

Use [Needed from team](Needed-from-team.md) once for remaining existing data/connections/deployment/runtime, current membership/application ACL, Buzz identity, actual governance example, protected organizational/financial sources and event/recording logistics. NTF01–15 stays stable; named-owner/five-role setup is superseded and Helix/Y2 are deferred. SQL architecture, retention defaults and conditional real governance are settled. Operational input receipt is not live qualification. No deployment, permission change, deletion or submission occurs in this documentation update.
