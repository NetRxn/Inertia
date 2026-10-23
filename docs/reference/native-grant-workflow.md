# Native grant workflow: source map

Reviewed 2026-10-23. Design evidence, not deployed integration.

- Paperclip **v2026.1012.0**: `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`.
- DFW-Gov-Fund: `859a9f5a7b88bbbdd6eda3cb9c453fb15184a045`.
- Inertia packet core: develop `778996e94ce3b79480b5e06a5bb1b6fbe4eb4a60`; unchanged by this revision.

## Reuse, do not duplicate

| Work | Native surface | Retained domain behavior |
|---|---|---|
| Scout and draft | Assigned central/member agents; shared skill/CLI/MCP; one native trigger owner | Acquisition, matching, eligibility and draft generation |
| Evidence gaps | Issue documents, questions and assigned subtasks | Applicant validation and evidence provenance; an answer is not automatically verified |
| Draft proposals | Documents/attachments and per-item verdict cards | Workspace hash, allowed targets/evidence IDs; validated proposal storage |
| Human review | `request_item_verdicts`; explicit `human_only`, designated addressee | Planned trusted adapter calls `review_suggestion`; accept/reject map to domain outcomes; defer does not mutate |
| Corrections | Edit document → regenerate proposal → new review | Preserve corrected-value validation; custom structured editor only if walkthrough proves need |
| Packet signoff | Separate human-only cards for configured roles; current document target | Planned adapter maps approve/reject to approved/changes_requested; checks actor/role, packet version and artifact hashes; retains native decision ID in audit |
| DAO vote | Native task/document links proposal and result | Separate Vocdoni/effective-authority verifier; immutable packet/review/artifact binding |
| External handoff | Addressed human task and receipt artifact | Domain readiness gate; `record_manual_submission` records an outside submission, never performs it |

Funding persistence owns evidence, applicant facts, proposals, immutable packets and review audit. Paperclip owns tasks and authenticated interactions. The funding web UI remains optional specialist/admin fallback, not a second task or approval ledger.

## What the source proves

Paperclip supports per-item approve/reject/defer, actor/timestamp results, addressed-user enforcement and current issue-document revision targets. Item decisions are identified by interaction ID + item ID; partial results can leave the card pending. Use each item’s actor/verdict, not the final card resolver. Set `resolverPolicy: human_only` explicitly; defaults may permit agents. A document revision does not prove external artifact bytes are current.

The plugin SDK exposes `ctx.issues.createInteraction`, documents and attachments. `ctx.approvals` supports read/decide, **not create**. Use native `request_board_approval` only for a genuine organization-level operational decision, not grant-role signoff or DAO ratification.

Funding MCP exposes draft/workspace/proposal operations but **not acceptance/signoff**. Existing web signoff routes are admin-guarded and record `actor="operator"`; reviewer-name fields do not establish authenticated role authority. The new trusted server adapter and member-scoped transport still need implementation and live acceptance.

## Role and state rules

- Direct application: program, fiscal, legal_compliance, partner, authorized_representative.
- Partner contribution: program, fiscal, legal_compliance, partner.
- Next-cycle readiness: program, fiscal. Monitor-only: none.
- Only partner may use `not_applicable`, via an explicit role-specific confirmation/action, never defer/reject. Other required roles must approve.
- These are funding-domain routes. The shipped Inertia freeze/vote core only supports direct-application manual submission with five role checks.

Retain domain states: `evidence_resolution`, `ready_for_internal_review`, `internal_review`, `approved_for_manual_submission`, `approved_for_partner_delivery`, `next_cycle_readiness_complete`, `monitor_only`, `submitted_externally`. Display them on native work; do not create another orchestration state machine.

## Storage compatibility

Funding defaults to SQLite but includes a PostgreSQL/psycopg path, PostGIS geometry and Alembic migrations. Its current unqualified schema/SQL is not yet a qualified isolated funding schema. The [consolidation contract](../development/dao-data-consolidation.md) pins that evidence and assigns Drizzle/Alembic ownership without changing runtime.

## Pinned evidence

- Funding [portable skill](https://github.com/NetRxn/DFW-Gov-Fund/blob/859a9f5a7b88bbbdd6eda3cb9c453fb15184a045/government-funding-dfw/.agents/skills/dfw-funding-orchestrator/SKILL.md), [MCP tools](https://github.com/NetRxn/DFW-Gov-Fund/blob/859a9f5a7b88bbbdd6eda3cb9c453fb15184a045/government-funding-dfw/src/dfw_incentives/mcp_server.py#L181-L242), [proposal review](https://github.com/NetRxn/DFW-Gov-Fund/blob/859a9f5a7b88bbbdd6eda3cb9c453fb15184a045/government-funding-dfw/src/dfw_incentives/codex_agents.py#L461-L547).
- Funding [roles/states](https://github.com/NetRxn/DFW-Gov-Fund/blob/859a9f5a7b88bbbdd6eda3cb9c453fb15184a045/government-funding-dfw/src/dfw_incentives/packet_handoff.py#L197-L300), [admin signoff/submission routes](https://github.com/NetRxn/DFW-Gov-Fund/blob/859a9f5a7b88bbbdd6eda3cb9c453fb15184a045/government-funding-dfw/src/dfw_incentives/api.py#L2430-L2555).
- Paperclip [SDK](https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/packages/plugins/sdk/src/types.ts#L1410-L1653), [verdict schema](https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/packages/shared/src/types/issue.ts#L1435-L1536), [human/addressee checks](https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/server/src/services/issue-thread-interaction-resolution.ts#L151-L215), [revision checks](https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/server/src/services/issue-thread-interactions.ts#L1800-L1850).
- Inertia [contracts](https://github.com/NetRxn/Inertia/blob/778996e94ce3b79480b5e06a5bb1b6fbe4eb4a60/src/grants/contracts.ts), [packet freeze](https://github.com/NetRxn/Inertia/blob/778996e94ce3b79480b5e06a5bb1b6fbe4eb4a60/src/grants/engine.ts), [governance evaluation](https://github.com/NetRxn/Inertia/blob/778996e94ce3b79480b5e06a5bb1b6fbe4eb4a60/src/grants/governance.ts).
