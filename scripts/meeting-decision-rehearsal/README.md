# Synthetic meeting return-loop qualification

This additive harness can live at `scripts/meeting-decision-rehearsal/` in the Inertia repository. It composes the existing Inertia brief/research ports, actual DFW domain operations and official Paperclip native services. It is not a production admission endpoint or rollout.

## Required pre-existing inputs

Provide all six absolute paths explicitly. There are no workspace defaults and no installation step:

```sh
export INERTIA_REPO_ROOT=/absolute/path/to/inertia-repository
export DFW_REPO_ROOT=/absolute/path/to/dfw-repository
export PAPERCLIP_HOST_ROOT=/absolute/path/to/qualified-paperclip-host
export POSTGRES_NATIVE_ROOT=/absolute/path/to/qualified-postgres-native
export DFW_PYTHON=/absolute/path/to/qualified-dfw-venv/bin/python
export MEETING_OUTPUT_ROOT=/absolute/path/to/owned-evidence-output
mkdir -p "$MEETING_OUTPUT_ROOT"
```

- `DFW_REPO_ROOT` contains `government-funding-dfw/`.
- `PAPERCLIP_HOST_ROOT` contains the already-installed `node_modules/` and qualified `package-lock.json`. Expected Paperclip version: 2026.1012.0.
- `POSTGRES_NATIVE_ROOT` contains the qualified PostgreSQL 18.1 `bin/` and `lib/` directories.
- `DFW_PYTHON` selects the existing CPython 3.14.6 DFW virtual environment. Its final symlink is preserved so execution keeps the virtual environment; the underlying executable is hashed.
- Inertia must already have its locked TypeScript dependency installed. The launcher rebuilds its ignored `dist/` output before use.
- The output directory must exist and may not be inside the host or PostgreSQL dependency roots.

`pins.json` binds the used Inertia brief/research/type source files, build configuration and lockfile; all DFW Python domain source and imported synthetic seed files; and critical qualified host, PostgreSQL and Python files. Every selected directory is canonicalized and pinned file bytes are checked before a database or temporary run directory is created. This verifies the listed files, not the entire transitive installed dependency tree or shared-library closure. The Python executable hash alone does not attest that virtual-environment dependencies are present: the same bare interpreter may pass path/hash preflight and then fail domain imports. Use the qualified existing virtual environment; no installer or environment repair is provided.

The original qualification source pins are Inertia `7b6f0692842cc5939a73fb1310fbef4db6afbdde` and DFW `88b855d3bc3cef805319ef087c86ff48bb6465ae`. Actual repository HEADs are separately recorded. Equivalent merged commits and additive script commits are allowed only if all pinned service/source files still match. Updating the pin manifest requires new qualification, not an override flag.

Unset incoming `DATABASE_URL`, `QUALIFICATION_DATABASE_URL`, `PGHOST`, `PGSERVICE`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGPASSFILE` and `PGSERVICEFILE`. The runner rejects these overrides; it never accepts a database URL.

## Run

From the Inertia repository containing these additive scripts:

```sh
node --test scripts/meeting-decision-rehearsal/config.test.mjs scripts/meeting-decision-rehearsal/policy.test.mjs
PYTHONPATH="$DFW_REPO_ROOT/government-funding-dfw/src:$DFW_REPO_ROOT/government-funding-dfw/tests:$PWD/scripts/meeting-decision-rehearsal" \
  "$DFW_PYTHON" -m pytest scripts/meeting-decision-rehearsal/test_domain.py -q
node scripts/meeting-decision-rehearsal/run.mjs
```

All PostgreSQL startup, migration, actual native/domain use and cleanup run in one launcher command namespace. It owns a new SCRAM password, cluster, temporary directory and local port. `owned-postgres.mjs` contains unchanged prerequisite/owned-cleanup function bodies from the previously qualified cloud launcher. The Python bytecode cache is isolated in the owned temporary directory so source-root caches are not reused. Native/domain outputs are sanitized and stored in a unique child directory of `MEETING_OUTPUT_ROOT`; `configuration.json` records actual input paths and identities.

Do not start PostgreSQL separately, point this at another database, install dependencies to bypass a hash mismatch, or retry full HTTP startup. A missing/mismatched input is a setup/qualification blocker.

## What a passing run establishes

A synthetic active native member answers one human-only opportunity question. Exact native question, actor/role, company/issue, source revision/digest and opportunity scope are checked. Existing DFW services admit the answer as `authorized_human` knowledge scoped only to `fund:1`. Existing knowledge is queried before research, a real native follow-up reuses the original parent/goal, and the actual DFW builder/Inertia renderer updates a real native document revision.

The run covers exact in-run replay, unauthorized/stale input rejection, post-admission member revocation blocking refresh/publication, and current DFW source/packet/opportunity/artifact checks. Two persisted partner-research receipts explain reuse; their empty graph delta does not cryptographically bind meeting evidence. Evidence is bound separately by the admitted knowledge and brief sources.

The follow-up remains `todo`; its creation is not execution or completion. The scoped human deferral is not an adopted DAO motion, spending permission, grant signoff or submission. Comparison includes expected value versus application and delivery effort, without a hard dollar cutoff. No live Walmart application preparation is performed.

## Unchanged limits

Synthetic configured authority only. No live identity/login, website ACL, source-revocation transport, HTTP deployment, full daemon/worker execution or real organization governance is qualified. Direct DFW reads depend on their DFW source projection; guarded calls do not establish global revocation propagation. Native PostgreSQL and DFW SQLite have no cross-store atomic transaction; crash/signal recovery and production writer fences remain unqualified. Native idempotency-key retention is bounded, and exact sequential in-run replay is not a restart/recovery guarantee.
