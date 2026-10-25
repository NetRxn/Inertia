# Public Source CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this bounded configuration change.

**Goal:** Add trustworthy exact-head public root-package qualification.

**Architecture:** One fail-closed GitHub Actions job delegates to existing root
scripts. No new application/runtime or private integration behavior.

**Tech Stack:** GitHub Actions YAML, Node 24 LTS, npm lockfile, existing Vitest and
package verification scripts.

**Spec:** `docs/development/public-source-ci.md`

## Global Constraints

- Public root package only; no secrets/private repositories or permission changes.
- Standard `ubuntu-24.04`, 25-minute timeout, one Vitest worker; no schedule.
- Read-only contents token, no persisted credentials/cache, verified official SHA pins.
- Record actual source and step outcomes; private skips are not qualifications.
- Independent review and maintainer disposition before workflow publication/activation.
- No heavy local aggregate until coordinated capacity approval. Configuration
  validation and simulated step-outcome checks are authorized for this change.

## Review Focus

- A PR head differs from its merge ref: check and report the exact head SHA.
- Earlier checks fail or checkout never finishes: summary must not imply success.
- Private cross-repository fixtures are unavailable: name both as unqualified.
- A draft becomes ready or a newer commit arrives: triggers/concurrency must work.
- Untrusted PR code runs: token, credentials, official pins and event choice must
  not introduce privileged execution.

## Task 1: Add the public-package job and its documented boundary

**Files:** Create `.github/workflows/public-source.yml` and this plan/spec.

**Interfaces:** Consume existing `typecheck`, `build`, `test`, `test:package`
scripts without modification. Produce one `root-package` job/check and a job
summary, never a deployment or published package.

- [x] Validate YAML structure and trigger/permission/pin/command expectations.
- [x] Add the workflow with PR head checkout and an explicit SHA equality check.
- [x] Validate each extracted shell body with `bash -n` and exercise the summary
  with success, failure, skipped and cancelled synthetic step outcomes.
- [x] Check install-hook compatibility against the existing locked loaders and
  package gate; do not disable tests or substitute fake passing fixtures.
- [x] Review complete diff independently; resolve important findings.
- [x] Hand off exact files and validation evidence for maintainer disposition.
  Record hosted CI and heavy local checks as never run until they actually run.
- [ ] Establish a passing hosted run on the published exact candidate head;
  fresh install and all root qualification steps remain pending until then.
- [ ] Obtain maintainer activation/merge disposition after hosted qualification.
