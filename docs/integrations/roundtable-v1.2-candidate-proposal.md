# Proposed Roundtable v1.2: grounded summaries and notes-only sources

Proposal only. No new website schema, route, client codec or live deployment is implemented here. The website owner must approve and qualify it before use. Existing v1.1/extractive-v1 requests remain unchanged.

## Why a new contract

v1.1 requires a full transcript and exact complete-line extracts. It cannot honestly represent source-faithful paraphrase, sub-line evidence, summary-only notes, or a partial transcript publication awaiting extraction. Do not silently put rewritten text into extractive-v1, fabricate a transcript/revision, or call empty candidates complete.

## Smallest additive envelope

Use a distinct `roundtable-publication-v1.2` envelope and outputVersion `grounded-notes-v2` with these explicit fields:

- `source`: original sourceId, opaque revision, raw contentHash, sourceKind transcript or notes, original text, audience and provenance. A notes source never asserts verbatim transcript coverage.
- `transcript`: a separate original-preserving normalized transcript, or null for notes-only input. `transcriptStatus` is present or missing. Missing is a disclosed exception, not a fabricated empty transcript.
- `notes`, `decisions`, `actions`: concise faithful text plus one or more evidence spans. Each span binds the exact source ID/revision/hash, UTF-8 or Unicode-code-point convention (choose one explicitly), half-open offsets and the exact quoted evidence. Preserve material uncertainty/negation. Explicit `classificationStatus: candidate` and `authority: unverified`; no automatic adoption or inferred owners/dates.
- `extractionStatus`: pending or complete, with a bounded exception code when incomplete. Empty arrays are only meaningful with complete, never an inference from a missing worker. Notes-only may have complete notes with transcriptStatus missing.
- `metadata`: exact title/date/attendees/agenda/tags snapshot. Keep unknown values null; no inferred dates or attendees.

A new canonical operation/output hash must bind all of the above, the exact metadata snapshot, original-source identity, output version and expectedPreviousOutputHash. Keep source revision distinct from processing/output revision, so adding notes later can create a new CAS-bound output for the same unchanged source. Use a deterministic output-revision token, not fabricated source chronology. Replays use the exact original serialized request bytes.

## Server and authorization requirements

Preserve fixed audience/member authorization, source visibility/withdrawal checks, atomic same-operation idempotency and expected-parent CAS, immutable prior receipts and authoritative exact-content readback. A partial or notes-only receipt must report its actual state, not a fabricated transcript URL. Expose only authorized audience-scoped views; narrowed or withdrawn source suppresses access. The schema does not grant purchases, outreach, task execution, data sharing or motion approval. Native work candidates remain subject to existing native mandates.

## Acceptance before adoption

Website and client owners agree span units, canonical codec and response fields; add cross-language golden hash vectors, exact-span/negation/ambiguity examples, notes-only missing-transcript samples, delayed same-source enrichment, correction/replay/CAS/ack-loss cases, withdrawal/audience/cache tests and false-source-kind rejection. Independently compare useful generated summaries against owner-provided de-identified sources. Only after both sides and the audience policy are qualified may the new contract replace the current pending states.
