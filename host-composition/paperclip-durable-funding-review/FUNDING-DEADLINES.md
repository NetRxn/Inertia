# Scoped funding execution deadlines

The pinned host has independent defaults: 10 seconds at the gateway and 30
seconds for plugin RPC. The private funding bridge can need 120 seconds. A
gateway timeout rejects the caller without proving that private work stopped.

This opt-in overlay preserves ordinary defaults and all existing authorization.
It admits a longer resource budget only for a freshly authorized native MCP
assignment containing exactly the producer's four tools or reviewer's two tools,
with no ordinary connection/catalog entries. Mixed, partial, duplicate, stale,
unknown and revoked assignments cannot receive that budget. REST calls retain
their existing caller timeout behavior.

| Boundary | Bound from the same gateway-entry start |
| --- | --- |
| Private operation, including preflight and pin checks | 120 seconds |
| Plugin RPC, allowing bounded callback/child cleanup | 160 seconds |
| Native MCP gateway | 170 seconds |
| Generated Codex MCP client configuration | 180 seconds |

Gateway authorization time consumes the same absolute operation deadline. The
server injects exact invocation/tool/run/issue/project/role metadata outside model
arguments. The registry and worker validate that binding; callbacks and retries
do not restart the clock. The existing managed-auth and shell/sandbox guards
remain unchanged. The Codex server-level timeout is emitted only for the exact
role-only assigned server; it is neither a blanket server approval nor a grant.

On expiry, the bridge aborts further authorization, terminates its owned private
process group and waits for its direct child to close. The durable owner remains
held until an outstanding callback promise settles. Native writes and subsequent
wakes are fenced by the same per-call deadline. SDK callback timeout does not
prove that an already executing host effect rolled back. Such outcomes remain
explicitly unconfirmed and require receipt readback.

## Install and verify

Use a clean pinned host composition with the existing reviewed overlays applied
first. Run `npm run apply-funding-deadline` inside the isolated host package root.
The exact file/build/guard hashes are pinned; drift, partial application, unknown
new files and changed authorization/SDK guards fail closed. The installer is
idempotent on its final tree. Older overlay installers are not a repair path for
a newer tree: rebuild from the matching source sequence instead of relaxing pins.
Do not patch a running host in place.

`npm run test:funding-deadline` runs native gateway/registry/installer tests and
the optional actual Codex fixture (`CODEX_COMMAND_CLI` supplies the pinned binary).
Tests use synthetic identities and grants; the CLI fixture uses local deterministic
responses without provider authentication or model inference. A real SDK request
lasting 31 seconds verifies that both old outer limits are overcome.

The root suite covers trusted metadata, pinning/preflight expiry, private child
and descendant cleanup, native late writes and ownership retention. Optional
`test/drafting/deadline-cold.test.ts`, configured like the existing private cold
qualification, verifies a real committed preparation survives response expiry
and a genuinely new admitted run reuses the same selection and packet.

## Recover before retry

1. Establish executor termination or an explicit native hold. Read the exact
   invocation, native run and domain selection/preparation receipts.
2. Check packet/match lineage, output hashes, pending candidate/review receipts
   and in-flight domain work. Preserve original records and unresolved outcomes.
3. For a successful v2 selection, use the owning service's normal fresh-run
   `selected()`/`prepare()` validation and pin reuse. Do not rerun the old actor,
   manufacture a new preparation, override freshness, or replay a submission.
4. Failed/running/ambiguous claims retain their existing operator-reconciliation
   gate. A timeout is never evidence of no write, and this overlay adds no retry
   queue, credential, acceptance or external-submission authority.
