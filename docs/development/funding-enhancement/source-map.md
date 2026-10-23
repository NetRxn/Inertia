# Source map and implementation boundaries

Checked 2026-10-23 16:17 UTC through the GitHub connector.

## Pinned repositories

- DFW-Gov-Fund main: `859a9f5a7b88bbbdd6eda3cb9c453fb15184a045`.
- Inertia develop: `1ac44a7a5c9d8e1376e2c358ee2888b16be58905`, tree `ef24b4c7e7554e51b52610c0ad7b5ca62e619d80`.
- Paperclip evaluated release: `v2026.1012.0`, commit `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`; native capabilities recorded in Inertia docs/development/native-grant-workflow.md. Requalify selected deployment version.

## DFW existing paths and observations

Paths relative to government-funding-dfw/.

| Path | Inspected behavior |
|---|---|
| src/dfw_incentives/agents/drafting.py | `_sponsor_requirement_rows` consumes confirmed fields/answered questions; `_organizational_capacity` requires verified claims with certain prefixes, dropping useful attributed evidence |
| src/dfw_incentives/agents/review.py | `ReviewAgent.review_text` has literal partner wording requirement and coarse placeholder-based readiness |
| src/dfw_incentives/codex_agents.py | `CodexAgentService.build_workspace`, `save_proposals`, `review_suggestion`; allowed targets/evidence membership and content bounds; preflight workspace check occurs before later write transaction |
| src/dfw_incentives/budget_validation.py | Existing numeric validation to retain and strengthen, not replace with prose review |
| src/dfw_incentives/models.py | ApplicantProfile/Evidence/FieldValue; ApplicantDocument/Version/Fact; AgentRun; CodexSuggestion; ApplicationPacket/Artifact already exist |
| src/dfw_incentives/applicant_documents.py | Document registration, admission, governance and fact resolution; reuse source/provenance mechanisms |
| src/dfw_incentives/coverage.py, source_operations.py | Source coverage/operations reports; add resumable research evidence without a new scheduler |
| src/dfw_incentives/mcp_server.py | FastMCP plus local database settings; neutral core, but exposing same privileged database config to members is not a scoped deployment |
| src/dfw_incentives/packet_handoff.py | Existing readiness/role/signoff/submission-record domain operations |
| .agents/skills/dfw-funding-orchestrator/ | Existing skill with commands, evidence, drafting/review and schedule references |
| plugins/dfw-funding-dfw/.codex-plugin/plugin.json, .mcp.json | Existing host packaging; license and MCP key inconsistency identified by portability audit |
| scripts/install_plugin.py, tests/test_portable_distribution.py | Existing packaging/install test seams |
| alembic/versions/0001…0012 | Existing migration chain; current last named revision is 0012_codex_agent_suggestions.py; inspect live head before adding revisions |
| tests/test_grounded_drafting.py, test_codex_agents.py, test_draft_review.py, test_phase2_agents.py | Existing regression suites to preserve |

## Inertia existing paths

`src/roundtable/ingestion.ts` explicitly emits unverified extractive notes/decisions and null owners. Do not upgrade these to authority through a new adapter without a separate trusted record. `src/roundtable/website.ts` owns caller-side publication/readback contracts. `src/grants/contracts.ts`, `engine.ts`, `governance.ts` bind exact domain packet/artifact/review hashes and vote evidence. `src/paperclip/adapter.ts`, `src/worker.ts`, `src/manifest.ts` are the native integration seams. `src/store/postgres.ts` and migrations own plugin integration metadata, not a new funding database.

Detailed current contracts: docs/development/native-grant-workflow.md; docs/development/dao-data-consolidation.md; docs/integrations/dao-website-member-publication-proposal.md and v1.1 clarifications. Existing SDK/native fixtures should remain regression tests.

## Public evidence for current enrichment

- https://fwtx.city/programs/ — named programs and participation formats.
- https://hack.fwtx.city/ — current program, delivery structure and organizer-reported historical attendance.
- https://fwtx.city/blog/reflections-on-my-first-hackathon/ — attributed May participant experience; publication predates July, historical crawler capture unproven.
- https://github.com/FWTX-DAO/fwtx-wiki-engine — observable software artifact; source inspection does not establish deployment/adoption.
- https://constitution.fwtx.city/ — public mission/design context; older governance wording must not be assumed effective current authority.

## Portable references

- https://agentskills.io/specification — skill content format.
- https://agent-plugins.org/specification — portable plugin packaging; host-specific support must be tested.
- https://code.claude.com/docs/en/plugins — Claude plugin wrapper.
- https://docs.paperclip.ing/reference/skills/ — managed company skills and per-agent selection.
- https://docs.paperclip.ing/connectors/custom-mcp-servers/ — governed tool integration, qualification against deployed configuration required.

## Ownership and blockers

This package changes no product source or live service. CI/dependency preparation is a separate change set. Historical beta source/output bytes remain on the inspected laptop and are not copied here. Current public fixtures and implementation do not depend on recovering those bytes. Publish synchronized artifacts after review. Live website rollout remains the user's integration task; credentials, actual human-role mapping, local-runtime choice and deployment admission remain explicit external inputs.

## Design review

Independent builder review identified six contract gaps: candidate/review binding, knowledge admission, cross-system role revocation, durable bidirectional links, intake revision ordering, and source-relative paths. All six were addressed in plan/spec/testing. Parent review additionally required reproducible scoring and verified TypeScript imports; these are now explicit. Source/Notes and sha256 imports were checked in `src/roundtable/ingestion.ts` and `src/roundtable/codec.ts`. This was document review, not implementation qualification.

## Execution update

DFW CI/dependency PR35 merged into main at `ac483c309d1df84dec8a8106ec5f13860e080fc0` after exact-head GitHub run `39987898544` passed. The inspected funding behavior above is pinned to the pre-CI source revision. Public benchmark implementation is in progress; enhanced drafting, native review and intake remain planned. Inertia features target develop; DFW features target main.
