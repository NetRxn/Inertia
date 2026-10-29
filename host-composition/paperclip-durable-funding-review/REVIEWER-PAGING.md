# Bounded semantic reviewer paging

Apply `scripts/apply-native-review-paging.mjs` after the exact `native-source-review` overlay. It verifies every frozen predecessor guard, rejects partial/drifted/symlinked sources, and installs once or verifies an exact replay. It does not start a service or configure agents.

An assigned native domain reviewer reads the default `get_task_context({})`. Small packets retain their complete payload. A large packet returns an exact manifest and descriptor catalog with `delivery: "paged"`; a catalog alone does not establish review. The same tool accepts only:

```json
{"artifact_view":{"manifest_hash":"<current SHA256>","artifact_key":"<catalog key>","offset":0,"limit":8000}}
```

Read every artifact. Follow `next_offset` until `null`; offsets count Unicode code points, and exact EOF returns empty text. `limit` is 1–32000. Keep the exact manifest, descriptor and semantic hash across pages; reconstruct full UTF-8 and verify `semantic_hash`. DOCX semantics are canonical JSON containing ordered paragraph and table blocks, with recursive table cell blocks. This view describes semantic content, not visual rendering.

The selector uses the existing native assignment, current case and manifest, configuration pins, and `funding_review_context` authorization. It cannot choose another task or a filesystem path. Revocation or drift denies the next page. Whole-packet review and native admission retain their existing contracts. There is no total packet cap; each transport response keeps its bounded limit.

## Focused qualification

Run the unit/runtime/stdio checks in the tests named `native-review-paging`, `native-packet-review`, `native-review-stdio`, `native-case-review-runtime`, `native-review-runtime`, `native-domain-review-composition` and `native-case-review-router`.

The installer test requires `INERTIA_NATIVE_PAGING_BASE` (exact predecessor package) and `INERTIA_NATIVE_PAGING_CANDIDATE` (exact final package).

The real domain cold protocol test requires `INERTIA_DFW_ROOT`, `INERTIA_DFW_PYTHON` and `INERTIA_NATIVE_PAGING_FIXTURE` (the isolated registered domain export); optionally set `INERTIA_NATIVE_PAGING_EXPORT` to save complete verified semantics. It deliberately skips when those explicit qualification inputs are absent. The fixture must include an actual review artifact above 1 MiB and an actual DOCX with paragraph/table/nested-table content.

The disposable Docker native test mounts this checkout at `/qual/source`, the overlaid candidate at `/qual/candidate`, and a directory containing the verified `export.json` at `/qual/paging`, all read-only. Run `node --test /qual/source/host-composition/paperclip-durable-funding-review/tests/native-review-paging-native.test.mjs` in the existing offline native qualifier. It uses real PostgreSQL, native completion assignment, tool catalog, runtime and authorization; its domain subprocess is an explicit snapshot boundary containing real cold-protocol-exported semantics. No provider launches. The real Python and native PostgreSQL proofs are separate seams, not a claim of a deployed combined runtime.
