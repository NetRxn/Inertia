# Keep Paperclip current

Target the latest published stable Paperclip release. The 2026.1012.0 baseline records a reproducible evaluation, not a permanent version policy. On 2026-10-23, both official npm packages and the latest upstream release still resolve to that version. A newer upstream source commit is not a published release.

## One-command check

`node scripts/paperclip-upgrade.mjs`

This refreshes official npm metadata for `paperclipai` and `@paperclipai/plugin-sdk` plus the latest GitHub release, then prints the exact versions, registry integrity, and comparison with the baseline. `--dry-run` is equivalent. It does not install packages, edit repository files, change a deployment, or schedule anything. Different host/SDK versions and a release-tag mismatch are shown rather than silently normalized. Network errors and metadata redirects fail closed. SHA-512 digests and canonical registry URLs are validated.

## One-command isolated qualification

`node scripts/paperclip-upgrade.mjs --qualify`

Node 24.11+ and npm are required. Allow several GB of temporary disk space; set TMPDIR to a larger writable volume if the default temporary filesystem is constrained. The command copies git-tracked source into a disposable temporary directory, updates only that copy's SDK version, generates an exact candidate lock, checks its integrity against the observed registry metadata, then runs `npm ci --ignore-scripts`, the existing typecheck, full test suite, and package verification. The package verifier checks production-only installation, native manifest schema acceptance, worker loading, migrations, and package privacy. This reuses the existing checks instead of inventing another host implementation.

A second disposable directory holds the exact host package and generated lock. Both directories and the empty temporary npm configuration directory are reported. `upgrade-receipt.json` records completed gates or failure in the SDK workspace; the host lock is ready for `npm ci` in a disposable host environment. Inherited npm registry settings are isolated. Existing and generated locks must use canonical official registry tarball URLs without credentials, query strings, or fragments; the selected candidate must match its exact observed tarball URL and integrity. npm verifies downloaded package integrity. These retained directories are inspection artifacts, not live installations. Remove them after retaining the evidence you need. Bundled dependencies may omit their own tarball only when an integrity-bound official registry ancestor supplies them. No root package or lockfile is changed. Reports include the source commit and whether tracked source has uncommitted edits. Setup failures emit a failed report, and also a receipt file whenever the workspace can be written.

The command executes project tests, but npm dependency install scripts are disabled. It does not start Paperclip or connect to a database. SDK/package qualification is one gate, not automatic host promotion.

## Native compatibility and promotion

1. Run the existing [native-service qualification](native-services.md) with the candidate host workspace and the newly packed candidate plugin. Reuse `qualify-runtime.mjs`; do not replace native RPC with a fake. The harness reads hostVersion from the installed official package. Use only a disposable, newly migrated synthetic database.
2. Run the full HTTP/UI smoke in the intended deployment sandbox: plugin install/activation, company config validation, jobs, restart, and connection recovery. The cloud's `os.networkInterfaces` restriction may require Docker elsewhere. Native service results remain useful separately.
3. After passing these gates, open a feature branch from develop, intentionally update package.json/package-lock.json from the reviewed candidate, update the version profile and evidence, and merge after review. Keep the deployment host version exact too. Never float production to an unqualified tag or copy an unreviewed lock wholesale.
4. Before a live upgrade, make a database backup and verify restoration into a disposable database. Read candidate migrations, release notes, and dependency advisories; SDK compatibility alone does not clear a security regression. For compatible schema changes, use the documented downgrade path. For incompatible or uncertain migrations, restore the tested pre-upgrade database backup together with the prior application/plugin versions and configuration. An old binary against a newly migrated schema is not a rollback plan.

Use this command whenever preparing an update. There is no cron, automatic live upgrade, or additional decision ceremony. The existing execution-hardening integration's evaluation pin can advance when its own checks pass; this workflow does not mutate that repository.

The first [isolated qualification receipt](paperclip-upgrade-receipt.json) records 152 runtime tests, 12 workflow tests, successful typecheck/package verification, and the unchanged root lock hash.

## Workflow tests

`node --test scripts/test/paperclip-upgrade.test.mjs`

Mocked metadata tests cover registry failures, identity/integrity checks, unexpected tarball origins, independently changing host/SDK versions, and lock substitution. Existing project tests remain the runtime behavior regression suite.
