# Regular upstream upgrades without a permanent fork

2026.1012.0 is the source baseline proven by this bundle, not a permanent version requirement and not a claim to be the newest Paperclip release. No production activation is supplied. Do not keep an obsolete deployment merely because this prototype was qualified against it.

## Check for changes

Run npm run check-upstream when preparing an upgrade, or from an operator-owned scheduled read-only check. It queries the official public registry, prints the latest release alongside the qualified baseline, and reports whether requalification is required. An unavailable registry fails explicitly and makes no freshness claim. This bundle creates no schedule and installs nothing through that check.

## Requalify a new release

1. Make a fresh isolated candidate. Fetch the latest official release selected by the operator and refresh package.json plus the integrity lock using the public npm registry and a local cache. Do not disable fingerprints or install a moving latest tag into a live service.
2. Inspect the new native item-verdict transaction and actor/resolver routing. Prefer a supported upstream atomic acceptance hook if it exists. If upstream supports the needed hook, remove this patch instead of carrying a perpetual local fork. Otherwise port only the narrow transaction hook and the host-owned capture/reader, not the whole upstream codebase.
3. Review membership, scoped permission grant, issue/document/link locking and every withdrawal/expiry/deletion path. Verify acceptance source fields survive the current activity redactor exactly. Validate ordinary lifecycle/archive support before providing a production retention contract. Do not treat old source inspections as evidence for a new release.
4. Update the exact package version/build commit, original and candidate file hashes, and the zero-fuzz patch. Never set the original fingerprint to unknown content just to silence a failure. Bootstrap must still reject version/source drift and partially patched installations.
5. Refresh the qualified native PostgreSQL dependency only if needed. Record and review official package integrity, binary fingerprints, hydration script and symlink manifest. Requalify platform/library behavior, environment rejection and verified shutdown before deleting temporary state.
6. Run the native real-PostgreSQL suite and the affected upstream interaction regression suite on the new release. Preserve rollback, backend-disconnect, lost-publication scan recovery, duplicate/partial-card behavior, role revocation ordering, content/revision exactness, redaction, tenant isolation and mandatory retention-gate tests.
7. Run cross-domain/run.py against the new host bundle and the DFW project's locked environment: actual proposal apply, packet-role apply, and cancellation-first. Run DFW's owning-service PostgreSQL cancellation/apply race suite and migrations separately. Changing the native approval model requires a new explicit decision, not merely a version update.
8. Obtain independent review of exact final hashes, integration outputs and production activation gates. Publish only the new isolated composition path. Keep production disabled until the owning host's approved registration/role/retention/transport integration is complete.

## Drift is a stop, not a repair prompt

Bootstrap checks all expected original files before touching any one of them. It either applies the whole known patch with zero fuzz, verifies an already-applied exact candidate, or stops. Unknown source, mismatched version/build, partial patch or changed binaries is never auto-repaired. Start fresh and requalify; do not repeatedly retry patch failures against a live host.
