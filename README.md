# Inertia

DAO-helper for Fort Worth DAO. Planning baseline **INERTIA-2026-10-22-r4** (22 October 2026).

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

## Status and contribution discipline

This repository currently contains documentation, not an implemented or deployed service. Application and security tests are planned, not run. Actual funder submission is outside demo acceptance.

Use focused branches and reviewable pull requests. Keep the four Markdown artifacts and deck synchronized when requirements change. Record decisions and define relevant tests before implementation. Do not commit credentials, private meeting material, local databases or generated runtime results. The original overview remains unchanged; update current planning artifacts instead.

Existing DAO platform and grant-engine repositories remain separate systems. This repository does not grant access to their data or infrastructure.
