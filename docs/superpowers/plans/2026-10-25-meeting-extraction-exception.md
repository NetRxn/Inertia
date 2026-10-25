# Meeting Extraction Assignment Exception Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an unavailable configured native extraction assignment produce actionable work in the existing meeting intake mapping, without publishing or changing native task authority.

**Architecture:** Retain the existing native task lookup and fail-closed assignment/status checks. Route a confirmed unavailable/nonmatching lookup through the existing `MeetingExtractionPending` and `runMeetingJob.onResult` path; reuse the same objective claim/CAS/native issue mapping. Thrown service/read failures remain unclassified rather than being mislabeled as reassignment.

**Tech Stack:** TypeScript, pinned Paperclip plugin SDK 2026.1012.0, Vitest, PGlite.

**Spec:** Existing `docs/development/meeting-source-native-composition.md` native exception contract and `docs/development/native-meeting-extraction.md` active-assignment contract. Parent approved this bounded repair on 2026-10-25.

## Global Constraints

- No new pipeline, task queue, credentials, resources, scheduler, runtime, or production publication.
- Preserve website publication and exact-byte/current/previous receipt behavior.
- Never reopen, reassign, or wake an unavailable extraction task; the native owner restores it.
- Preserve current native/source access authorization and idempotent reference-only intake.

## Review Focus

- Completed extraction task: actionable assigned intake exception, no publication/wakeup.
- Reassigned/missing task: same outcome without asserting why a lookup returned unavailable.
- Read denial/service exception: never relabeled as assignment-required.
- Restored assignment: resume original source and reconcile the same intake issue.
- Repeated exception: reuse the native mapping, never duplicate tasks.

## Task 1: Route confirmed unavailable extraction assignments

**Files:** `src/roundtable/extraction.ts`, `src/roundtable/intake.ts`, `test/roundtable/owner-extraction.test.ts`, `docs/development/native-meeting-extraction.md`.

**Interfaces:** Keep `registerMeetingExtraction(...).transform(...)`, `MeetingExtractionPending`, and `reconcileMeetingIntake(...)` signatures unchanged. Add safe outcome code `native_extraction_assignment_required` only.

- [x] Add composed regression for done/reassigned/missing configured extractor, no publication/wakeup, assigned existing intake issue, and restored same-source continuation.
- [x] Run regression to observe expected assertion failure, not a worker/setup error. Three expected assertion failures recorded.
- [x] Replace only the failed lookup/assignment/status check's generic Error with existing typed pending exception; add fixed actionable guidance in intake.
- [x] Cover thrown lookup failures and repeated exception replay; update the native extraction contract.
- [x] Run focused tests, typecheck, build, whitespace check; whole-suite verification explicitly handed to the parent single-owner aggregate after resource contention (not yet green).
- [ ] Obtain independent review and hand off a focused patch/commit with exact evidence and limitations.
