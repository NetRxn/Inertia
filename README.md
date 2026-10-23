# Inertia

Inertia connects DAO conversations, meeting records, grant packets and member agents. Paperclip owns operational tasks and approvals; Buzz presents the same work. DAO governance authority requires separate packet-bound evidence.

## Run the fixtures

Use Node.js 24.11.0 or newer. From a source checkout:

```sh
npm ci
npm test
npm run typecheck
npm run demo
npm run demo:roundtable
```

- **Connected bridge:** a signed Buzz reply becomes a native Paperclip comment and a signed receipt with matching IDs. The fixture demonstrates restart/replay without duplicate native writes. Native confirmation cards, recoverable receipt delivery and scoped health are implemented.
- **Roundtable ingestion:** deterministic transcript/notes preparation and an idempotent publication contract, exercised with a local fixture publisher.
- `npm run demo:transport` isolates signed HTTP delivery and retry behavior.

External I/O is synthetic. Live admission is pending for Drive, website publication, grant/vote adapters and member execution. See [implementation status](spec.md#implementation-status).

## Build an installable plugin

```sh
npm run test:package
npm pack
```

`npm pack` builds automatically and produces a local `.tgz` containing runtime modules, SQL migrations and operating instructions. The package is private. `test:package` starts from a clean temporary source tree, packs it, installs production dependencies in a fresh consumer, imports the installed worker and validates its manifest against the pinned native schema. It also checks that development sources, test files and private files are excluded.

Install the resulting package through an admitted Paperclip plugin workflow targeting **2026.1012.0**. The package declares its manifest and worker in `paperclipPlugin`; the host resolves `migrations/` relative to the installed package. No post-install build or developer dependencies are required.

[Connection setup, configuration and recovery](docs/operations.md) · [Native authority and state contract](docs/bridge-state-contract.md)

## Product direction and artifacts

The required demo spans automatic Roundtable publication, grant-packet preparation with a vote on the exact version, and secure contributions from members' agents. Existing DAO and grant-engine repositories remain authoritative for their domains. Grant scouting/drafting and human review are native-first Paperclip workflows, using a shared scoped harness for central/member agents. The funding UI is optional; the trusted human-decision adapter is planned, not shipped. See the [native grant contract](docs/development/native-grant-workflow.md).

The source repository keeps the synchronized [specification](spec.md), [testing plan](testing.md), [decisions](decisions.md), [implementation plan](plan.md) and [editable architecture deck](Inertia-Architecture.pptx) and [visual system overview](docs/architecture/Inertia-System-Overview.html). Editable [Mermaid diagram sources](docs/architecture/diagrams) accompany the HTML. The [original product overview](docs/reference/Inertia-beta-product-overview.pdf) is retained as historical source material.

Merge reviewed feature branches into `develop`. Keep current artifacts synchronized and the original PDF unchanged. Exclude credentials, private meeting material, local databases and runtime captures. Live deployment and funder submission require separate authorization.

### One-command connected rehearsal

Run `npm run demo:workflow` to follow one synthetic Roundtable-to-grant initiative through the existing cores, native confirmation bridge, and exact packet binding. The command prints a readable walkthrough and saves `runs/workflow-receipt.json`. See [live handoff contracts](docs/implementation/live-handoff-checklist.md) for adapter inputs, outputs, and the remaining connections.
