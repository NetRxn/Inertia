# Restrict an existing native agent tool grant

The qualified additive overlay provides a board-only administrative operation:
`POST /api/agents/:id/tool-use-restrictions`. It is not an agent or MCP tool.
It requires current native `users:manage_permissions` authority, an identified
board actor, an active company, an existing eligible agent and its existing
active company membership. Agent-authenticated callers, including CEOs, are
rejected. The existing human member-permissions endpoint remains unchanged.

The strict request has exactly two fields:

```json
{
  "toolNames": ["netrxn.inertia:funding_drafting_workspace"],
  "expectedGrantFingerprint": "<64 lowercase hexadecimal characters>"
}
```

Names must be exact, fully namespaced, unique and nonempty. Wildcards and bare
tool names are rejected. Read the current agent's `tools:use` row from
`access.grants` in the existing board-authorized `GET /api/agents/:id` detail
response. The company member list is a human-only surface.
Compute SHA-256 over UTF-8 `JSON.stringify` of this object, in this field order:

```js
{
  version: 1,
  companyId: grant.companyId,
  agentId: grant.principalId,
  grantId: grant.id,
  scope: grant.scope,
  updatedAt: new Date(grant.updatedAt).toISOString()
}
```

The operation locks and rechecks current company, agent, membership and grant
state, and rechecks native board authority inside the transaction. It updates
only the existing `tools:use` row's scope and update timestamp. The original row
ID, creation time, original grant attribution, other grants, membership, agent
settings and task state remain intact. A native activity record with the real
board identity, before/after scopes and both fingerprints commits atomically.
No membership or missing grant is created or reactivated.

An unrestricted `null` or empty-object scope may be narrowed. Existing exact-only
`allow` tool scopes and `toolNames` scopes may only retain or remove their current
names. Other historical scope shapes, application/connection grants, wildcards,
or scopes with additional selectors fail closed: rewriting them could discard a
restriction. This operation cannot widen a finite grant.

The response supplies the resulting exact names and `grantFingerprint`. A stale
fingerprint returns 409, including a retry using the original pre-change
fingerprint. Repeating an already canonical restriction with its **current**
fingerprint returns `replayed: true` without another write or audit. After a lost
response, read back the current grant and audit before deciding what to retry.

## Catalog and revocation

For the approved drafting workflow, use exactly these existing tools:

| Role | Exact names after `netrxn.inertia:` |
| --- | --- |
| Producer | `funding_drafting_workspace`, `save_funding_proposals`, `save_funding_gap_progress`, `funding_drafting_checkpoint` |
| Reviewer | `funding_review_context`, `review_funding_candidate` |

Native grants, profiles and policies are independent authorization sources.
A restrictive tool profile or its excludes cannot subtract an unrestricted
explicit grant or an earlier matching allow policy. Check for other authorizing
policies/profiles when reconciling an exact role catalog. This endpoint restricts
the one grant; it does not edit those other authority sources.

The full public manifest declares 21 tools, including features held disabled.
Disabled worker registration does not itself restrict native manifest discovery.
Verify the native plugin inventory equals four producer or two reviewer tools.
HTTP MCP additionally exposes exactly the four stock Paperclip resource/prompt
facade tools; do not silently filter away any other extra name. Existing assigned
gateways recheck fresh native authority, so a restrictive grant applies to later
calls through previously issued gateways and to direct agent plugin calls.

## Qualification and installation boundary

Apply `scripts/apply-agent-tool-use-restrictions.mjs` only after the existing
qualified overlay stack, including native reconciliation. The installer pins
the two changed files and requires unchanged human-member route, authorization,
queue, SDK, command-disable and prior-overlay files. It accepts a wholly original
or wholly patched pair, refuses drift/partial/symlinked targets before mutation,
and verifies the resulting hashes. It starts no service and changes no grant.

The HTTP tests use synthetic identities and real pinned native routes, policy
checks, SQL and audit code in disposable PGlite. The complete-manifest regression
separately tests exact catalog/direct/MCP admission and old-gateway revocation.
These are source qualification results, not a claim of deployed authentication,
PostgreSQL concurrency, live configuration, domain writes or model execution.
