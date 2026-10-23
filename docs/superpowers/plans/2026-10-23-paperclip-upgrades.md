# Paperclip Upgrade Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make latest stable Paperclip upgrades a repeatable, isolated qualification rather than a frozen pin or automatic production change.
**Architecture:** Resolve official package/release metadata, preserve baseline evidence, and run existing Inertia checks against exact candidate locks in temporary workspaces. Native host checks reuse the existing qualification harness.
**Tech Stack:** Node 24.11+, npm, existing TypeScript/Vitest/package verification.
**Spec:** `docs/qualification/paperclip-upgrades.md`.

## Global Constraints
- Do not mutate the root lock, deploy, add credentials, or schedule upgrades.
- Keep version observation, SDK qualification, native host qualification, and promotion distinct.
- Latest published stable is the target; `2026.1012.0` is an evidence baseline.

## Review Focus
- Registry errors, package substitution, malformed integrity, mismatched version streams, and lock substitution must fail or remain visible.
- Unqualified native host compatibility must never become an implied promotion approval.

### Task 1: Resolve and qualify a candidate
**Files:** `scripts/paperclip-upgrade.mjs`, `scripts/test/paperclip-upgrade.test.mjs`, `docs/qualification/paperclip-versions.json`, `docs/qualification/paperclip-upgrades.md`.
**Interfaces:** `resolveCandidate(fetcher)` returns independent host/SDK/release observations; `validatePackage(data, name)` validates registry identity; `verifyLock(lock, candidate)` checks exact version/integrity.
- [x] Write mocked metadata tests and verify missing implementation fails.
- [x] Implement default report and explicit isolated qualification.
- [x] Run mocked tests, including malformed input and lock substitution.
- [x] Run actual candidate typecheck, full suite, and package verification; retain receipt.
- [x] Verify root lock unchanged.
- [ ] Obtain independent review before merge.
