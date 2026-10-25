# Meeting source and native composition

## Status and boundaries

Subsequent source completion: [native meeting extraction and local preproduction](native-meeting-extraction.md) replaces the original transcript-copy transform with protected native extraction tools, an owner-file source path and explicit private SQL local publication/readback. Missing extraction binding stays pending, never empty-success publication. The original lifecycle/security contract below remains in force; actual model quality and live connectors remain separate qualification.

Additive caller composition around the unchanged website v1.1 adapter. Default disabled. The native manifest registers `reconcile-roundtable-sources` without a schedule. Neither registration nor the tests provision credentials, grant live permissions, publish real meetings, create production issues, or deploy a website route.

Modules:
- `src/roundtable/source.ts`: explicit Drive/Meet readiness and version adapter.
- `src/roundtable/native.ts`: private durable publication lifecycle.
- `src/roundtable/host.ts`: actual pinned SDK config, secrets, HTTP, jobs, runtime and health composition.
- `src/roundtable/intake.ts`: existing objective intake service/store/issue adapter reused for reference-only native follow-up.
- `src/bridge/ownership.ts`: exclusive owner over the existing runtime table, not a new work queue.

## Source contract

Configure each stable DAO meeting ID and explicit date/title separately from its approved Drive folder/file ID and Meet transcript resource. Titles, filenames, ingestion times and document instructions are not identity or authority. A transcript must have a matching `conferenceRecords/.../transcripts/...` name, `FILE_GENERATED` state, and matching `docsDestination.document`.

The adapter reads Drive file metadata, exports Google Docs as `text/plain`, then rereads metadata. File ID, allowed parent, non-trashed status and Google Docs MIME type must match, with the same positive decimal `version` before and after export. This is a Drive change counter, not a claimed historical revision download. It may advance on metadata changes. `headRevisionId` is not used: Google Docs do not populate that blob-file field. Revision ordering uses bigint, never lossy JavaScript numeric comparison. Read errors and 404s are not withdrawal evidence.

Gemini notes are a separate artifact. A `gemini-notes` binding does not qualify as a transcript and does not cause credential resolution or content export. Its protected file reference is retained in private runtime state; its original notes remain in authorized Drive. With admitted native intake, it produces actionable missing-transcript work. After explicit new admission, a summary-only binding can change to a verified transcript binding if no publication operation has ever been prepared and the principal is unchanged. Prepared operations and withdrawal tombstones cannot be rebound this way.

**R-M02 partial acceptance:** notes-only website publication is not implemented. The existing v1.1 endpoint requires a transcript. An actual de-identified organization Gemini sample and an approved notes-only website contract are needed before exporting/publishing notes-only content. No transcript is invented and no fabricated Gemini API response is claimed.

Public API evidence checked 2026-10-24:
- [Meet artifacts](https://developers.google.com/workspace/meet/api/guides/artifacts)
- [Meet transcripts and FILE_GENERATED](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.transcripts)
- [DocsDestination document ID](https://developers.google.com/workspace/meet/api/reference/rest/v2/DocsDestination)
- [Drive files version/headRevisionId](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)
- [Google explanation of Gemini notes saved to Drive](https://blog.google/products-and-platforms/products/workspace/take-notes-for-me/)

## Durable behavior

Private state is scoped by company, fixed website origin and stable meeting identity. The binding digest additionally includes principal, approved folder/file, artifact kind and Meet resource. Same meeting ownership cannot be split by changing a file or principal. Entire exact-byte website operations are saved before dispatch. Pending operations resume unchanged, including after restart, before a newer source can prepare a correction. A verified current prior receipt supplies the correction CAS parent; non-current receipts/conflicts cannot silently rebase. Same-version changed bytes and stale versions stop. Only current and previous operation records are kept here, not an unbounded duplicate transcript history.

401/403 from source or website pauses durably, including the first source read before any operation exists. A timer cannot resume it: explicit new admission is required. Retry-not-before survives reconstruction. Withdrawal is a durable stopped state and is not inferred from a failed source read. Local withdrawal stops this caller; it is not a website deletion API and does not claim remote content was erased. Website withdrawal receipts also stop the meeting. Retention and erasure remain separately authorized administrative actions.

Configuration is checked before source/secret work, after asynchronous secret resolution and before each source/website HTTP request, including the GET-absence to POST boundary. Disabled configuration makes no source, secret or native issue calls. Enabling does not create a recurring schedule. Tests use only synthetic content, including hostile instructions that remain inert transcript text. The host now obtains candidate classifications through the explicitly configured native extraction task. Exact full-line validation and null-owner/unverified candidate restrictions remain; no configured extractor means pending, not a transcript-copy notes substitute. See the native extraction contract for section limits, source checks and local-mode distinctions.

## Native work, not a second backlog

Optional `roundtable.nativeIntake` contains verified `organizationId`, `intakeAgentId` and `referenceOnly: true`; company ID comes from native context. It reuses `ingestObjective`, `createIntakeStore` and `createNativeObjectiveAdapter` without rewriting their claim, CAS, origin lookup or uncertain-create behavior. A small presentation wrapper labels the resulting issue as meeting follow-up and preserves the adapter's revision marker. Lost create acknowledgments reconcile the exact existing origin; uncertain absence never triggers a duplicate create.

New/corrected verified publications update one reference-only native issue. Summary-only sources create missing-transcript work. Auth/conflict/pending outcomes create or update bounded integration follow-up. Withdrawal cancels only mapped work. Issue text contains fixed action guidance and an opaque protected meeting reference, never transcript, notes, attendees, raw source URLs, credentials or model instructions. Actual source references and member content remain protected. Unverified meeting candidates are not approved tasks or execution authority. Native intake pending/blocked/conflict keeps health in attention state even if website publication succeeded.

The manifest declares existing `issues.read`, `issues.create` and `issues.update` capabilities for this optional path. This source change is not a grant to a live instance. Installation/upgrade permission review remains a team gate.

## Ownership and exact recovery action

The SDK scheduled-job context supplies a job run ID, not an agent heartbeat checkout. `issues.assertCheckoutOwner` cannot acquire ownership, and the pinned scheduler's read-then-start overlap check is not an atomic multi-instance lock. The helper therefore uses an atomic `INSERT ... ON CONFLICT DO NOTHING` into existing `bridge_runtime`, with a fresh opaque token and worker incarnation ID. Release uses a conditional delete matching that token. There is no TTL or timeout stealing. Normal completed/rejected runs release ownership; an interrupted executor or failed/unconfirmed release can leave a durable claim.

For recovery, a trusted native lifecycle integration or operator must:
1. Inspect the exact company/origin/key with `owner.inspect(scope)` and retain the observed token and worker incarnation.
2. Establish that this exact old worker incarnation has actually stopped, not merely that its job timed out or its heartbeat is old.
3. Call `owner.recoverStopped(scope, observedToken, confirmStopped)`, where `confirmStopped` consults that trusted lifecycle evidence. This function is not exposed as an agent tool or user-configurable assertion. No trusted automatic proof API is available in the current plugin SDK, so the default plugin does not automatically clear crashed claims.
4. Rerun the manual native job. It reconciles any saved website/native operation before new work. If the token changed meanwhile, recovery returns false and does not remove the new owner.

Only opaque owner metadata is needed for recovery. Never delete the meeting state or pending intake claim to make a retry appear clean. Never treat a new process start as evidence every other worker stopped.

## Transport qualification limitation

The direct-fetch implementation requests redirect refusal, a 15-second AbortSignal and no-store, and bounds source-body parsing to 2,000,000 bytes. Tests check request options, signal presence, oversized input and redirected responses; they do not time a real 15-second network timeout. **Those are not upstream network bounds in the pinned SDK transport.** Its worker RPC serializes method/headers/body but drops redirect/cache/signal, and reconstructs the response without redirect metadata. The pinned host uses its own non-redirect-following HTTP implementation, a 30-second timeout and up-to-200-MB buffering before this adapter sees the body. Therefore local source and receipt validation caps do not prevent upstream buffering of an oversized response. Production transport resource qualification or a host-level bounded-response improvement is a named integration gate. No false 2-MB/15-second native-network guarantee is made.

## Admission checklist

Team-owned prerequisites: explicit approved source mappings and de-identified Gemini fixture; scoped source/website credentials through secure references; organization/company/intake agent mapping and live capability review; member-only website v1.1 routes with transactional idempotency/CAS/withdrawal/cache tests; retention for private native state; ownership recovery evidence/runbook; host transport resource qualification; synthetic staging canary; then separate live enablement authorization. No live acceptance is claimed by local tests.

Run focused tests with `npm test -- test/roundtable/source.test.ts test/roundtable/native.test.ts test/roundtable/ownership.test.ts test/roundtable/host.test.ts test/roundtable/intake.test.ts --maxWorkers=1`, then full suite, typecheck, build, package and actual disposable native-service qualification. The implementation handoff records exact final hashes and command evidence.
