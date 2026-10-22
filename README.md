# Inertia

DAO-helper for Fort Worth DAO. Planning baseline **INERTIA-2026-10-22-r5** (22 October 2026).

## Current planning artifacts

- [Specification](spec.md): requirements, architecture, trust boundaries and sources.
- [Testing plan](testing.md): acceptance and security requirements defined before implementation.
- [Decision register](decisions.md): confirmed choices, proposals and unresolved contracts.
- [Implementation plan](plan.md): dependencies, proposed owners and evidence gates.
- [Editable architecture deck](Inertia-Architecture.pptx): seven-slide overview.
- [Original product overview](docs/reference/Inertia-beta-product-overview.pdf): unchanged historical source document by Kyle Christmon, 15 October 2026. Its four-week sequencing and earlier technology priorities are superseded where the current artifacts differ.

## Required demo objectives

1. Automatically clean Roundtable meeting transcripts and notes and upload them to the DAO website within the configured authorized audience.
2. Reuse the grant engine to prepare a reviewed application packet and record a blockchain vote on whether to submit that exact version.
3. Let members contribute their own client-side agent capacity through sandboxed jobs and server-controlled authorization, validation and publication.

## Operating model

Paperclip provides the operational platform, CEO/hiring hierarchy, tasks and decisions. Buzz and the dashboard are two interfaces to the same work. Agents acquire eligible work eagerly and create bounded follow-ups. Existing execution hardening is qualified against the selected Paperclip release. See the capability matrix and bridge contracts in the specification.

## Status and contribution discipline

This repository currently contains documentation, not an implemented or deployed service. Application and security tests are planned, not run. Actual funder submission is outside demo acceptance.

Use focused branches and reviewable pull requests. Keep the four Markdown artifacts and deck synchronized when requirements change. Record decisions and define relevant tests before implementation. Do not commit credentials, private meeting material, local databases or generated runtime results. The original overview remains unchanged; update current planning artifacts instead.

Existing DAO platform and grant-engine repositories remain separate systems. This repository does not grant access to their data or infrastructure.

## Run the transport demo

The first executable slice verifies signed Buzz messages and retries delivery safely. Run `npm ci --ignore-scripts`, then `npm run demo` (Node.js 22+). Tests and exact source contracts are documented in [Buzz transport development](docs/development/buzz-transport.md).

## Connected bridge demo

`npm ci && npm run demo` runs a signed Buzz reply through the real Paperclip adapter and durable SQL bridge, then returns a signed receipt with the same native IDs. External services are local fixtures; no credentials or network calls are used. Restart/replay is included.

[Connection setup and recovery](docs/operations.md) · [Native authority and state contract](docs/bridge-state-contract.md)
