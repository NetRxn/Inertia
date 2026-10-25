# Restrictive Codex Command Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a fail-closed typed command-tool restriction without changing managed-auth protections.
**Architecture:** Exact adapter overlay in the existing host composition; shared builder and engine-selection validation.
**Tech Stack:** Node24, pinned Paperclip2026.1012.0, Codex0.156.1, Docker offline test fixtures.
**Spec:** docs/superpowers/specs/2026-10-25-codex-command-tools-design.md

## Global Constraints
- No push, PR, deployment, personal login, provider inference or security-setting changes.
- Managed-auth guard stays byte-identical; no raw-flag bypass or arbitrary config support.
- True requires explicit engine=cli, explicit bypass=false, no conflicting raw CLI arguments.
- Preserve default/false behavior and native MCP/target network protections.

## Review Focus
- Unsupported ACP/default engine silently ignoring restriction: reject before process startup.
- String false or bypass aliases changing meaning: strict booleans and explicit safe settings.
- Hidden raw argument precedence: reject both raw argument fields when enabled.
- Installer partial/drift/symlink inputs: reject with no source writes.
- Tool-schema fixture incorrectly proving absence: positive command control and retained MCP tool.

### Task1: Restrictive adapter overlay and qualification

**Files:** host-composition/paperclip-durable-funding-review/{patches/codex-command-tools-pins.json,patches/paperclip-2026.1012.0-codex-command-tools.patch,scripts/apply-codex-command-tools.mjs,tests/codex-command-tools.test.mjs,tests/codex-command-installer.test.mjs,tests/codex-command-capability.test.mjs,package.json,README.md}.
**Interfaces:** consumes existing adapter2026.1012.0 and managed-auth/runtimeMCP construction; produces typed `disableCommandExecution:boolean`, unchanged guarded auth path and reproducible pinned overlay.

- [x] Write builder/engine/type/bypass/argument conflict tests; run against original adapter and observe expected failures.
- [x] Implement minimal fixed-option builder and shared early engine validation; document field. Generate zero-fuzz patch and exact baseline/candidate hashes.
- [x] Run focused tests green, including fresh/resume/hello and unchanged auth guard.
- [x] Add fail-closed installer using existing pattern; prove clean/idempotent, mixed/drift/symlink/build/version/integrity rejection without writes.
- [x] Run actual CLI tool-schema fixture with positive baseline and retained MCP; record limitations separately from provider/model evidence.
- [x] Run complete public checks and existing runtimeMCP qualification; independently review final diff, fix important findings with red/green tests.
- [x] Commit local coherent source only and return exact hashes, results and required future install/config steps. No publication.

## Executed evidence

- Original adapter:36policy/builder regressions failed,2existing behavior/auth tests passed. Direct native entry/hello regressions also failed before correction.
- Final candidate:113focused tests passed,0skipped (40policy/entry/hello,19installer,1actual CLI schema,53existing nativeMCP tests).
- Current-develop application704tests and contributor validator53tests passed; type/build/strict declaration and offline clean production-only package checks passed.
- Codex0.156.1 actual outgoing schemas: control advertises exec_command/write_stdin; restricted neither; both load read-only MCP through native client tool search. Four deterministic local requests, no personal auth or model inference.
- Independent final read-only review: no remaining P1/P2; reviewer inspected source and receipts, did not rerun tests.
- Complete PostgreSQL/x64-only composition suite was not rerun on this ARM64 executor; no native database or PostgreSQL patch changes are included. Deployment/auth/model qualification remains separate.
