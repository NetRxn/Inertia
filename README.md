# Inertia

Fort Worth DAO's helper for connecting conversations, decisions and member-owned agent capacity. Paperclip owns tasks and governance; Buzz provides a second interface to the same work.

## Try the working slices

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

These demos use fixture external services. They need no credentials and send nothing to a live relay or website. Live Google Drive intake, the authorized DAO publisher, grant/vote integration and member execution-provider admission remain separate integration steps.

## Build an installable plugin

```sh
npm run test:package
npm pack
```

`npm pack` builds automatically and produces a local `.tgz` containing runtime modules, SQL migrations and operating instructions. The package remains private; this workflow does not publish it to npm. `test:package` starts from a clean temporary source tree, packs it, installs production dependencies in a fresh consumer, imports the installed worker and validates its manifest against the pinned native schema. It also checks that development sources, test files and private files are excluded.

Install the resulting package through an admitted Paperclip plugin workflow targeting **2026.1012.0**. The package declares its manifest and worker in `paperclipPlugin`; the host resolves `migrations/` relative to the installed package. No post-install build or developer dependencies are required.

[Connection setup, configuration and recovery](docs/operations.md) · [Native authority and state contract](docs/bridge-state-contract.md)

## Product direction and artifacts

The required demo spans automatic Roundtable publication, grant-packet preparation with a vote on the exact version, and secure contributions from members' agents. Existing DAO and grant-engine repositories remain authoritative for their domains.

The source repository keeps the synchronized [specification](spec.md), [testing plan](testing.md), [decisions](decisions.md), [implementation plan](plan.md) and [editable architecture deck](Inertia-Architecture.pptx). The [original product overview](docs/reference/Inertia-beta-product-overview.pdf) is retained as historical source material.

Work on focused feature branches and merge reviewed changes into `develop`. Keep artifacts synchronized as requirements change. Never commit credentials, private meeting material, local databases or runtime captures. Actual funder submission and live deployment require their separately authorized integrations.
