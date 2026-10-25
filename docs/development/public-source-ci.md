# Public source CI

## Purpose and design

`Public source CI / root-package` checks the public root package on the exact
pull-request head, on pushes to `develop`, and on manually selected refs. It is
verification infrastructure, not an application orchestrator or a replacement
for Paperclip. The initial source baseline is public `develop`
`8d0654546fa905511b2d52a710a7e6ca4ddf51d0`.

Approaches considered: retain local-only checks (no shared exact-head evidence),
add one bounded public-package job (selected), or include native-host/private
cross-repository qualification immediately (larger dependency and access scope).
The single job supplies the missing public check without changing runtime or
private-repository authority. Independent review and maintainer disposition
precede publication/activation; a passing run never authorizes merge by itself.

## Checks and limits

The job uses one standard GitHub-hosted `ubuntu-24.04` runner, Node 24 LTS,
the committed lockfile and a 25-minute timeout. Automatic PR and `develop`
push runs are fast checks only:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm run build
```

Full root tests (one worker) and package verification run only on explicit
`workflow_dispatch` integration checkpoints, never automatically on pushes or
ready-for-review events. The same existing commands remain available manually
from the selected exact source checkout:

```sh
npm test -- --maxWorkers=1
npm run test:package
```

Use focused tests alongside changed code during development. Reserve aggregate
tests/package for explicit integration checkpoints rather than making CI
maintenance or repeated full-suite runs a prerequisite for draft/partner work.
Fast-mode summaries explicitly mark full tests/package as skipped and **not
qualified**; a passing fast check is not an aggregate test or package pass.

Install lifecycle scripts are disabled; explicitly requested build/test scripts
still run. The lock includes the Linux x64 esbuild optional binary and koffi
prebuild, which their loaders use without an install hook. Do not omit optional
dependencies. The existing package gate also installs with `--ignore-scripts`,
then deliberately invokes `npm pack` and its `prepack` build in a clean source
tree. The gate checks a production-only consumer and package contents; it does
not publish anything. No root scripts or dependency locks are changed here.

The two optional private cross-repository fixtures remain visibly skipped:

- `test/central/real-bridge.test.ts`: no `DFW_TEST_ROOT` / `DFW_TEST_PYTHON`.
- `test/drafting/native-cycle.test.ts`: no `NATIVE_CYCLE_DFW_HOME` /
  `NATIVE_CYCLE_PYTHON`.

These variables are explicitly empty in this public job. The ordinary Vitest
report shows actual passed/failed/skipped counts; the job summary labels each
step's actual outcome and repeats the private-fixture exclusions. A skipped or
failed step is not a pass. Early failures skip dependent checks; timeout or
cancellation can also prevent the final summary from being written.

Native PostgreSQL/Paperclip host qualification, other nested-package suites,
private integration, actual providers, relay/Drive/website, deployment, and
production readiness are **not qualified** by this job. Existing host-specific
and independent-review gates remain mandatory where applicable.

## Trigger and security boundary

- Pull requests targeting `develop`: opened, synchronized, reopened, or marked
  ready for review; drafts are not silently excluded. The checkout is the PR
  head, not GitHub's synthetic merge commit. Post-merge `develop` pushes check
  the resulting integrated commit separately.
- Manual dispatch checks the selected ref; GitHub exposes this trigger only
  after the workflow exists on the repository's default branch, currently `main`.
  Until then, use the existing manual commands at an explicit integration
  checkpoint. Do not change `main`, the default branch or branch protection just
  to expose dispatch. It accepts no source/command inputs and creates no recurring
  work; no labels or alternate trigger framework are added.
- Newer runs cancel obsolete runs for the same event/PR or event/ref.
- Only `contents: read` is granted. Checkout does not persist credentials;
  setup-node caching is explicitly disabled. No secrets, private checkout,
  self-hosted runner, publishing, deployment, schedules, or permission changes.
- Official actions are full-SHA pinned. Verified against their upstream tag and
  signed commit on 2026-10-25:
  [checkout v7.0.1](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1)
  and
  [setup-node v7.1.0](https://github.com/actions/setup-node/commit/949feb2413d6458794dcd2491c4babbbce0c15c1).
  Updating pins requires reviewing official upstream release/commit identity.

Exact checkout SHA, selected Node/npm versions, package-lock digest, step logs
and outcomes identify each run. Node's supported 24 LTS patch may advance; the
run records the actual version rather than claiming a fixed image/runtime.

This workflow does not alter branch protection. External/fork PRs remain subject
to GitHub's normal Actions approval policy. Review both the workflow diff and
the exact checked source when relying on a PR's evidence.
