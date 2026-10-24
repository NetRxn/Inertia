# Meeting source and native composition plan

Baseline: Inertia develop 338fb528263a3c105f9ff677daa170ff0593f1eb. Additive only; unchanged website v1.1 caller, intake issue adapter, worker, package and migrations.

## Design decision
Use fixed Google API endpoints and a trusted, explicit meeting/file/folder binding, not filename heuristics or model-selected destinations. A Meet transcript must report FILE_GENERATED and name the configured document. Google Docs content is exported as text between two Drive metadata reads; require unchanged decimal version, file ID, MIME type, and allowed parent. Drive version is a change counter, not headRevisionId (the latter does not exist for Docs). Gemini notes are a distinct summary-only artifact and never substituted for transcript. Unavailable or changed inputs do not establish withdrawal or source absence.

Native composition uses an atomic non-expiring ownership claim in the existing runtime table spanning preparation, durable state writes, publication and optional native intake; runtime get/set alone is not a lock. Persist one immutable website operation before I/O. Resume it on retry without regenerating model output. Save terminal, retry-not-before and auth-pause outcomes durably. Corrections require strictly newer Drive versions and a verified prior publication; never automatic conflict rebase. A withdrawn meeting remains stopped. Explicit new admission revision may resume auth pauses, not a timer. Scope keys include company, source binding, origin, principal, and meeting. No content or credentials in job outcomes.

## Test-first implementation steps
1. Source contract tests: stable IDs, FILE_GENERATED, summary-only, fixed endpoints/redirect rejection, scope mismatches, version race, auth failure, unchanged transcript/injection text.
2. Implement source reader and content-free typed outcomes using dependency-injected fetch/token; no installed credentials or live reads.
3. Native lifecycle tests: persist-before-publish, exact retry bytes after restart, duplicate, correction/CAS, version collision/stale inputs, pause/resume, deferred retries, withdrawal, exclusive concurrent calls, disabled configuration.
4. Implement native ownership/state ports and opt-in job registration. No scheduler creation or default worker activation.
5. Run focused tests, full suite, typecheck/build; obtain independent review. Deliver hashes and patch; parent alone owns Git writes.

## External admission gates
Actual organization Drive/Meet access, explicit folder/file/meeting mappings, source principal, retention decision, host recovery proof/runbook and live capability review, production private state authorization, website v1.1 deployment/credential provisioning, synthetic staging canary, and separate live enablement remain unclaimed.

Implementation refinement: use the existing objective intake CAS/native issue adapter for reference-only meeting follow-up and missing-transcript exceptions. The root approved code-only issues.read/create/update declarations, optional default-disabled schema and unscheduled worker registration. Live capability grants remain outside this slice.
