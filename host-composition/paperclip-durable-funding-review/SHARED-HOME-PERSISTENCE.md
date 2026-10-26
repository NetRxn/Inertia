# Shared Paperclip home: composition preparation, not activation

Status: source-only preparation. The read-only helper below is implemented; the exact
private boot/launcher integration is PENDING and has not been reconstructed from
excerpts. No mount, migration, expanded credential retention, service restart or
provider run is authorized by this document.

## Native model and minimal composition

Use the official pinned Paperclip home-persistence model, not a source fork or
per-agent Docker bindings. Keep the existing PAPERCLIP_HOME pathname unchanged.
Add one real bind at that pathname from a private sibling directory on the existing
application volume. Do not place that directory inside the existing runtime-data
tree: the retained instance/data link points to that tree and could create a cycle.
The exact host source is an action-time operator choice, not a public default.

Retain the parent work tmpfs and temporary-directory tmpfs. Retain all existing
explicit database, research, artifact, config, workspace and skills bindings, runtime
UID/GID, umask, security settings and externally supplied master-key handling.
Keep HOME separate and transient. Do not relocate PAPERCLIP_HOME via environment.

One optional instance-level secrets tmpfs nested under the persistent home preserves
the existing transient decision-signing-key copy. It is not a per-agent setting.
Its exact target must match the effective instance. The launcher must establish
parent tmpfs, home bind, then secrets tmpfs; effective mount identity and masking
must be checked, not inferred from command order. No key is seeded into durable
home. The master-key working copy already lies outside this home boundary.
Inventory the secrets directory first; unexpected additional required material stops
this option rather than silently hiding it. This exception is NOT a general
credential-free-storage mechanism.

## Required startup change

Existing plain symbolic-link creation is not restart-idempotent. For the existing
fixed data/workspace/skill links only: create when genuinely absent; if present,
require a symlink with the exact expected target; otherwise stop. Never recursively
delete, replace, relink, chown, or merge conflicting existing state. The managed
instruction ancestry itself must consist of real directories, not symlinks.

Remove the old agent-specific instruction-link creation from the shared-home boot
only after the private migration inventory and proposed image are reviewed. Do not
replace it with automatic agent discovery, a per-agent mount loop or implicit copy.
New agents use the normal native hierarchy without launcher edits.

Preserve the existing config writer deliberately: it rewrites the configured file
on every boot. An operator JSON edit is therefore not a durable configuration fix.
This plan changes neither its database/key settings nor config authority.

## Retention that needs explicit approval

The shared home retains instructions, file-sync adoption/manifest/run-copy metadata,
and instance lock state. It can ALSO retain plaintext launch credentials, runtime
tokens and provider histories. Relevant pinned native path families include:

- instance/companies/*/codex-home and codex-auth-cache;
- instance/companies/*/grok-home, claude-config-seed and claude-prompt-cache;
- instance/companies/*/agents/*/codex-home and claude-runtime (per-run MCP tokens);
- instance/companies/*/acp-engine;
- instance/runtime/paperclip-runner, including durable sessions, provider homes,
  control-plane state, checkpoints and provider runtime state;
- instance/locks and other application-managed state created in the home.

These are path families requiring inventory, not an assertion that each currently
exists. With the secrets tmpfs exception, the current decision-signing-key working
copy remains transient; without it, its retention also needs explicit approval.
Initial managed-connection homes under the temporary directory remain transient.
Native recovery-copy exclusions do not filter an ordinary whole-volume backup.
Canonical encrypted database credentials do not imply encrypted runtime auth files
or whole-disk encryption. No new credential, login, grant or rotation is proposed.

Approve the exact protected app-state storage/backup custody and expanded retention
before application. Do not expose this home as shared agent knowledge, publish it,
or assume restrictive file modes protect against the same runtime UID or host admin.

## Preservation and migration gate

1. Privately inventory effective mounts and the entire relevant current native home
   using metadata only for credentials. Inventory all canonical instruction files,
   siblings, binary assets and associated file-sync state against authoritative
   saved content. Include existing separately persisted instruction sources and
   all agents, not just the currently affected agent. Unknown/missing inventory stops.
2. The current home is tmpfs: stopping/recreating the container can discard its
   bytes. Do NOT use a naive stop-container-then-copy sequence. Keep agents paused,
   establish a validated quiesced snapshot procedure while the source tmpfs still
   exists, and prove every server/provider/collector writer is stopped or otherwise
   safely quiesced under that procedure. Zero active database rows alone are
   insufficient. No freezer/export mechanism is claimed tested. Preserve original
   authoritative persistent sources; take a protected coordinated filesystem/database
   recovery checkpoint under existing custody policy and verify inventory/hashes
   before any tmpfs-destroying operation. Active or uncertain ownership stops. Never
   print or publish credential bytes. Only after a verified snapshot can container
   teardown and exclusive-writer cutover proceed.
3. Stage the new home in a separate reviewed directory without modifying originals.
   Preserve exact relative paths, safe file types, modes and application-owned
   metadata. Do not follow arbitrary links or copy master/signing keys into it.
   If using the secrets tmpfs exception, exclude that entire subtree from the
   initial durable copy and verify its absence before mounting. Merely hiding an
   already-copied signing key with tmpfs would still retain it underneath.
   Materialize existing instruction bundles as real native directories; preserve
   matching file-sync state. Reconcile any contradictory existing source explicitly.
   Missing adoption markers require normal service adoption before supported guarded
   restoration; never fabricate markers or replay stale legacy heads blindly.
4. Apply only the separately approved composition/image. Verify actual mounts,
   preserved external bindings, source ownership, link targets and secrets masking.
   Read back complete canonical instruction inventories/hashes through supported API.
   Use current baseHash on any authorized restoration (null only genuinely absent);
   stale conflicts stop. No automatic API writes or migration utility is proposed.
5. Stop and recreate with the SAME composition, confirm inventory/hash readback,
   restart-idempotent boot, same encrypted connection identity and unchanged DB/
   research/credential custody. No provider run until these and prior runtime gates
   pass. No claim of live acceptance follows from source tests.

## Rollback

Keep old source directories and the original launcher/image intact. Before any
replacement use, confirm a rollback image with the same shared-home-safe boot and
compatible native state. Stop replacement writers before rollback; retain the same
durable home and secrets exclusion. Never run the original non-idempotent link
creation unchanged against the populated home. Never restore stale canonical files
over newer ones. Reverting to the original transient layout is not a durability
rollback and needs explicit operator disposition plus preservation of new changes.

## Read-only source helper

Within this existing composition, with no new package or CI project:

```
node scripts/preflight-shared-home.mjs /private/shared-home-config.json
node --test tests/shared-home.test.mjs
```

Example private configuration (synthetic paths only):

```json
{
  "hostHome": "/existing-app-volume/native-home",
  "hostData": "/existing-app-volume/runtime-data",
  "paperclipHome": "/work/paperclip",
  "instanceId": "default",
  "transientInstanceSecrets": true
}
```

`hostHome` and `hostData` are **Docker daemon host** paths, not container aliases.
They must be existing real directories with no symlink ancestry and no nesting in
either direction. `paperclipHome` is the unchanged container path; `instanceId`
must match the effective native instance. No company/agent IDs are used or
needed for mapping: new agents use the native hierarchy.

The exported `sharedHomeMounts(config)` returns one home bind descriptor and,
when explicitly requested, one nested secrets tmpfs descriptor. These are review
inputs, **not executable commands or a complete Docker/Compose configuration**.
The parent work/tmp mounts and every unrelated setting remain outside the helper.
The optional tmpfs descriptor intentionally does not select UID/GID, mode, size or
other mount options: preserve the exact approved existing runtime values in the
separately reviewed launcher. Confirm nonroot access and effective masking; do not
accept Docker defaults as proof of compatibility.

`preflightSharedHome(config)` performs read-only host-directory ancestry checks.
With secrets exclusion enabled it also checks the underlying effective-instance
secrets path is absent or empty, without reading any credential bytes. Nonempty
underlying material is rejected rather than hidden by a future tmpfs. This does
not find secrets elsewhere, inventory the entire home, validate backup custody,
check ACLs/ownership, check mount identities or establish durability. Its output
always has `deploymentReady:false` and `runtimeQualified:false`. Keep operational
output private. Lexical disjointness and lstat do not detect bind aliases or nested
mounts. Checks are snapshots, not protection against concurrent mutation (TOCTOU).
Reject nested source mounts and unexpected links/file types during the separate
private migration inventory; this helper does not recursively traverse content.

`inspectFixedLink(link, expectedTarget)` is a read-only building block for the
existing fixed data/workspace/skill link sites. It returns `absent` or `matching`
and throws on a nonmatching link or ordinary file/directory. A matching result
means exact link text only, not destination existence or admission. It validates existing
parent directories and never creates a link, replaces an entry, or mutates any
state. This helper alone does **not** make the current boot restart-idempotent.
The exact private boot patch must implement create-if-absent / verify-if-present
at reviewed fixed sites and remove reviewed old agent-specific instruction links.
No generic agent discovery or new public replacement launcher is supplied.

The focused tests use temporary synthetic files and no Docker, database, secrets
or provider. They establish descriptor count, lexical/path rejection, secrets
nonempty refusal, fixed-link inspection and sample nonmutation only. Real mount
ordering, key masking, quiesced snapshot, adoption, full-bundle API recovery,
restart-idempotent boot and Docker recreation remain **unrun**. An original image
with non-idempotent boot is not a compatible populated-home rollback.

Before runtime application, independently review exact private launcher/image
changes and approve plaintext runtime retention/storage custody. Complete all
preservation, mount, full inventory/API and restart gates above before any provider
run. Source publication or passing tests grants no runtime activation authority.

## Pinned official references

- https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/docs/deploy/docker.md
- https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/docker/docker-compose.yml
- https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/doc/agent-files.md
- https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/docs/deploy/secrets.md
