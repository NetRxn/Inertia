# Restrictive Codex command-tool option

Approved scope: parent execution instruction2026-10-25 following managed-codex-assessment.md. Source and disposable offline testing only; no publication, deployment, personal connection use or inference.

## Intent and approach

Expose optional strictly boolean `disableCommandExecution` in the exact pinned Codex adapter. True requires explicit `engine:"cli"` and `dangerouslyBypassApprovalsAndSandbox:false`, rejects the legacy bypass alias unless false and rejects nonempty or malformed raw extraArgs/args. The shared trusted CLI builder emits only `features.shell_tool=false` and `features.shell_snapshot=false`. Fresh/resume and native hello must share it. Invalid or unsupported configurations fail before any CLI or ACP process starts. Absent/false retains existing behavior.

Alternatives considered: allowing selected raw -c overrides would complicate the authentication guard; dedicated CLI aliases after its rejection would bypass the held boundary. Chosen typed adapter setting keeps that guard byte-for-byte unchanged. Do not alter provider routing, managed auth homes/recipients, native MCP delivery, Docker/security settings, sandbox/network rules, or existing version defaults. Keep explicit bypass=false; do not rely on the installed contradictory default prose.

## Delivery and evidence

Add an exact version/build/hash-pinned additive adapter patch and idempotent fail-closed installer to the existing host composition. Do not edit the deployed adapter. Runtime entry and environment validation must reject unsupported engine/type/arguments before side effects. Existing trusted MCP configuration uses managed files independently of raw user CLI arguments and must survive.

Prove structural behavior with actual shared builder and environment-probe fixtures, unchanged auth rejection and existing runtimeMCP tests. Separately use the actual pinned Codex binary with empty isolated HOME, no personal auth, Docker network=none and a deterministic loopback response fixture to capture advertised tool schema. Require a positive baseline command-tool control and an enabled read-only MCP fixture, then absence of command tools under the typed option with MCP retained. This is actual CLI schema evidence, not real-model inference or live authentication. If no safe fixture succeeds, report that limit rather than claim enforcement.

Independent security review follows all tests. Owner approval remains necessary for exact image installation and per-agent configuration; no source push/PR in this task. Preserve contributor changes and both unpublished central branches.
