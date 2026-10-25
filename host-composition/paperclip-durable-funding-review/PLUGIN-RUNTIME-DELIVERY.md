# Plugin-only runtime delivery repair

This is a narrow, removable host-composition overlay for the exact Paperclip
2026.1012.0 build bba6a45f0d364cfd962ac59b3bdf2426a8222adb. It is not a core fork,
new transport, dummy ordinary connection, credential workaround, or version policy.

## Why the overlay exists

The pinned `buildPaperclipRuntimeMcpServers` returns no server when ordinary
connections are absent. Its native snapshot likewise has no plugin tools. Actual
plugin gateway dispatch already works, but a plugin-only Codex agent never gets
that gateway in its runtime configuration. The separate
`createManagedMcpRunConfig` only selects installed ordinary-connection gateways.

On 2026-10-25, npm's official latest `@paperclipai/server` was 2026.1023.0. Its
published `dist/services/heartbeat/run-preparation.js` still has both gates, so
upgrading is not an evidenced repair. Recheck upstream before the next upgrade.
Sources: https://github.com/paperclipai/paperclip/releases/tag/v2026.1023.0 and
https://www.npmjs.com/package/@paperclipai/server/v/2026.1023.0.

## Smallest delivery change

- Read plugin descriptors from the app's already-registered gateway/dispatcher.
  Missing registration fails closed. No parallel plugin registry is created.
- Ask the existing gateway for fresh company/agent/active-run authorization.
- Add sorted exact plugin names to the existing version-1 assignment only when
  present. Connection-only assignment bytes and digests are unchanged.
- Add exact `tool_name` profile selectors to the existing aggregate gateway.
- The native runner snapshot and heartbeat realization use the same helper.
- Codex already merges aggregate `runtimeMcp` servers into its managed config.
  Its config writer is unchanged. `createManagedMcpRunConfig` is also unchanged:
  empty ordinary connection IDs remain ineligible, never wildcard access.

## Authorization boundary

New plugin-aware assignments store their complete assignment payload in existing
profile/gateway metadata. The run token's immutable client label pins the digest;
public token operations can revoke, not edit, that marker. No database schema,
external codec, policy grammar, or token format changes are required.

At discovery and invocation the gateway rebuilds the canonical assignment, checks
its digest against the token pin, and intersects it with exact profile selectors.
Plugin names must be captured names. Ordinary tools must have both a captured
connection ID and catalog entry ID; no connection means no ordinary tool access.
Builtins and newly introduced tools cannot enter this channel through broad allow
policies. Missing, cleared, malformed, or changed metadata fails closed. Direct
administrator database rewriting of the bearer/token record is outside this trust
boundary, just as rewriting stored authorization records is outside upstream's.

The immutable profile never becomes a durable grant: current agent/run policy is
also checked without that gateway profile. Revocation and blocks take effect on
already-issued tokens. Current approval requirements remain restrictive. Replayed
and approved calls are checked again; an approved retry checks its verified signed
arguments before claiming the action, not caller placeholder arguments. Rejections
retain policy audit records. Existing native bearer expiry, revocation, company,
agent, active-run and provenance checks remain in force. Plugin parameters never
supply the authoritative `ToolRunContext`.

## Apply, qualify and remove

1. Use this bundle's normal exact-source bootstrap. Unknown versions, build hashes,
   source drift, mixed/partial states and patch tampering are rejected.
2. `npm run test:plugin-runtime` exercises actual pinned snapshot/heartbeat functions,
   Codex config generation, native assignment projection, named gateway authorization,
   plugin dispatcher and real SQL migrations in disposable PGlite. The worker's
   external boundary is synthetic; no model/provider is called.
3. `npm test` runs the existing host suite under disposable PostgreSQL. Runtime
   tests are not a live Docker/agent qualification. The approved local executor owns
   actual Docker activation and end-to-end Codex runs.
4. For upgrade or removal, start from a fresh official package install, review any
   upstream fix, refresh exact pins, and rerun qualification. Never apply this patch
   fuzzily to another version or stack it onto unknown modified sources.

The installer is idempotent and never starts a host. Do not treat source test
success as permission to create live grants, activate production, or change auth.
