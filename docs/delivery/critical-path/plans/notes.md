# Owner notes and shared readback Implementation Plan

> **For agentic workers:** Execute the approved tasks in this session; use superpowers:executing-plans. Source review and live acceptance are separate.

**Goal:** Import the five approved owner DOCX exports faithfully into the existing member source store and route one native Coordinator intake with deduplicated actions.

**Architecture:** Reuse ownerNotes/notes-intake durable intents, existing POST ingest and the same organization source read/hash interface. The five-export converter is pure; native context/catalog and action triage remain explicit owned seams.

**Tech Stack:** Existing TypeScript, native Paperclip SDK, PostgreSQL/Drizzle, bounded HTTP and protected secret references; no new platform.

**Spec:** /tmp/inertia-p2-contract-20261029.md; /tmp/inertia-p2-replay-fix-20261029/CURRENT-CLOSURE-AUDIT.md

## Global constraints

- Preserve existing data, native authority, provenance, genuine holds and peer active checkouts.
- No credential values, cookies, provider logs or real Buzz posts in source or receipts.
- Test fixtures are synthetic. A known-DAO-style fixture is not a verified production fact.
- Page/response limits bound transport, not the amount of work the agents may perform.
- Source-qualified, deployed, observed and business-accepted are distinct states.

## Clean versus ⚠

- CLEAN: source-qualified notes adapter88a27582 plus JSONB replay correction; exact ordered Quick/full blocks, faithful text/hash checks, lost-ACK intent recovery, one meeting objective/native wake exist.
- CLEAN: ingest POST{id,duplicate}, internal getSource, exact contentHash and active/hidden state exist on peer5049059.
- ⚠ Worker still registers notes jobs without a concrete owning-app resolver; enabled job correctly returns notes_app_binding_required. Owner: our plugin composition.
- ⚠ App read(id)/findByHash(hash) machine interface + read/write secret references/ingress are not yet established. Share Task1 organization-reader route, but keep ingest-write and reader credentials separate. The source candidate now supports active identity lookup and bounded exact-hash source pages; the production notes resolver must reconstruct/hash-check complete content before calling its existing readback validator.
- ⚠ Five real export paths/hashes/meeting mappings are protected and must be explicitly pinned by operator. No private export contents in source/tests.
- ⚠ meeting_source_context native catalog/current-assignment advertisement and populated candidate-to-task deduplication are not wired by an empty-array helper test. Native author ownership requires parent assignment; current author owns lifecycle only.
- ⚠ Changed revisions/corrections remain notes_correction_contract_required. Future Google push needs its own exact producer/revision/auth/replay contract; no broad Drive pull.

## Review focus

Never call notes transcripts; preserve every ordered block/table-derived text; hidden/duplicate store rows do not prove active faithful readback; lost ACK cannot repeat POST blindly; distinct wording/negation/owners cannot collapse into one action.

### Task1: Pure five-export conversion (owner: our notes source author)

Existing src/roundtable/notes.ts/source reader + scripts owner-export converter. Inputs are protected exact DOCX references; output is pinned owner-export JSON with meeting/source/revision, ordered Quick/full blocks and original provenance. Synthetic fixtures only in Git.

- [ ] RED/GREEN: five synthetic DOCX exports including paragraph/table order convert byte-faithfully to the existing DTO; malformed/hash-changed/false-transcript inputs deny.
- [ ] Operator pins the approved five real exports and verifies conversion hashes privately; no real import yet.

### Task2: Wire existing app resolver (owners: implement_host plugin; peer isolated read route)

Files in notes integration branch: src/roundtable/notes-host.ts, notes-intake.ts, worker.ts. Resolver implements existing write→{id,duplicate}, read(id), findByHash(hash) with exact active content/hash, not a fabricated publication.

- [ ] Actual member addSource/HTTP/PG RED→GREEN: one write, faithful readback, duplicate, hidden denial, lost-ACK hash recovery/restart/concurrent attempts; no duplicate POST or native objective.
- [ ] Pass the concrete resolver at production worker composition, not only a factory fixture. Leave correction branch blocked.

### Task3: Native context and action triage (owner: assigned native author)

- [ ] Advertise meeting_source_context to the actual mapped Coordinator/descendants; fresh native run/actor/source/readback checks; cold catalog test and foreign/reassigned actor denials.
- [ ] Populate existing exact action grouping with actual proposal candidates/excerpt locators; persist candidate→task native idempotency and one Coordinator routing. No app findWorkIn second writer.
- [ ] One approved real owner export initial import→member readback→native intake→actual Coordinator reads notes and produces evidence-backed deduplicated actions; then preserved batch. Do not claim import merely from queued wake.

**Acceptance:** five retained owner exports visible faithfully in the owning store, one intake per logical meeting, actual native context read and deduplicated triage. Google-native automatic push is a separate future producer, not a prerequisite for the initial batch.

## Focused adversarial review — 2026-10-29 (one pass)

**Finding NT-1 — ⚠ production composition and actual native consumption remain unclosed; current tasks identify the right minimum seams.** Historical authority is the original master plan Task5 (canonical workspace reference: `mission-alignment-20261028/midnight-delivery-plan-20261028.md`) and P1/P2 plan (canonical workspace reference: `mission-alignment-20261028/p1-buzz-p2-docs-production-plan.md`), October28 18:35 CDT: preserve Quick/full notes in the owning DAO surface, then one source-attributed Coordinator intake and deduplicated actions; source text grants no execution authority. The newer five-export initial batch is a scoped delivery step. It does not establish the original future automatic producer/correction acceptance. Original exact-plan approval commit is **UNKNOWN** because these delivery snapshots are outside the enclosing Git checkout.

**Prior reviews retained, not repeated:** meeting auto-start review (canonical workspace reference: `mission-alignment-20261028/meeting-autostart-independent-review.md`) proved initial native admission but explicitly excluded later correction wake; extraction review (canonical workspace reference: `mission-alignment-20261028/meeting-extraction-contract-independent-review.md`) preserved exact evidence and prohibited all-empty machine acceptance. The notes-specific `/tmp/inertia-p2-resolver-review-20261029.md` and `/tmp/inertia-notes-request-replay-review-20261029.md` already established the production resolver seam and independently cleared the narrow JSONB request comparison correction. No new review round is required for that cleared correction.

**Existing native primitive, verified first-party this pass:** native issues/delegation and SDK `issues.requestWakeup` provide assigned-work admission with blocker/budget checks and an idempotency key; they do not implement an external app's exact read/hash API. See [current canonical host source](https://raw.githubusercontent.com/paperclipai/paperclip/master/server/src/services/plugin-host-services.ts), `requestWakeup`, and [current Issues API](https://docs.paperclip.ing/reference/api/issues/). The inspected installed-source baseline remains [bba6a45](https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/server/src/services/plugin-host-services.ts); current canonical upstream is not evidence of a deployed upgrade.

**Actual implementation inspected:** `/tmp/inertia-notes-integration-20261029`, HEAD `88a27582c38bce75b60486dab81a534388ce64f5`; `src/worker.ts:88` calls `registerOwnerNotesJobs(ctx)` without a resolver; `src/roundtable/notes-host.ts:31` defaults it to `async()=>null`, and `:54` returns `notes_app_binding_required`. Its guarded context `:63–75` already checks actor/task, current mapping and exact active member-store readback. The root cause is unwired owning-app ports, not lack of native task machinery. `/tmp/inertia-p2-replay-fix-20261029/CURRENT-CLOSURE-AUDIT.md` separately records the native Coordinator whitelist gap and rich-export DTO conversion seam. A factory-injected fake resolver or a queued wake cannot close either.

**Minimum change / next owner:** implement_host + peer isolated read-route owner supply existing store `read(id)`/`findByHash(hash)` through admitted service authority and wire the concrete resolver at the production worker root. Notes author maps the five exports into the existing DTO; assigned native author admits the existing `meeting_source_context` to the exact Coordinator lineage and exercises actual triage. Preserve the current explicit changed-revision block until the owning correction contract exists. Reuse native tasks and current import intents; do not add another queue or let the app create competing work.

**Exact acceptance:** actual owning-app HTTP/store import→byte/hash-equal active readback→one mapped native intake; the actual eligible Coordinator reads notes through its real catalog and creates source-attributed deduplicated actions with uncertainty/proposed owners intact. Replay, concurrent delivery, hidden/wrong-kind readback, lost ACK, foreign/reassigned actor and revoked source must preserve one logical write/intake and deny unauthorized reads. Show the five approved exports in the owning surface. Future signed Google push, all-tab/revision race and changed-revision correction remain a separately labeled original-plan remainder, never silently credited by the initial batch.


## OWNED converter/catalog milestone — notes source lane, 2026-10-29 17:33 CDT

Owner: dedicated P2 source implementer. Isolated source `/tmp/inertia-p2-converter-20261029`; exact report `CONVERTER-CATALOG-REPORT.md`, four-file `converter-catalog.patch`, SHA256 inventory `converter-catalog-files.json`. Base is replay-qualified88a integration archive. No host.ts/app route edits, live host contact, credentials, import or merges.

- [x] Pure `src/roundtable/notes-converter.ts` validates operator-pinned extraction+DOCX hashes and explicit identities, produces the existing strict OwnerNotesExport and lossless raw-extraction provenance sidecar. Retains Quick/full/bridge order, all blanks/table-derived paragraphs and UTF16 paragraph locators. No Google/canonical meeting/person IDs or finality invented. Bridge is a separate quick-notes DTO block with original export_bridge attribution retained in sidecar.
- [x] Actual local review-only conversion of all five supplied files:545 paragraphs/50 candidates/100 exact source references; all block substrings and grouping/evidence counts checked. Private0600 converted artifacts use local source identities, NOT deployment mappings. `five-conversion-receipt.json` records hashes/counts without source text.
- [x] Scoped native source correction: existing task-project projected reader path selected only roundtable config; ownerNotes now uses the same mapped-objective/actor/run/project/opt-in/fresh-grant path and receives only meeting_source_context. No broad Coordinator whitelist change or transcript submission authority. Concurrent unrelated transcript config preserved; ambiguous matching lanes deny. Empty notes batch regression independently found and fixed RED→GREEN.
- [x] Final local checks67/67 plugin tests (existing64 plus3 converter),36/36 pure native catalog tests, TypeScript typecheck. Independent read-only review: one important empty-batch issue corrected; no other important findings. Exact RED/GREEN logs in isolated source folder.
- ⚠ Actual native DB/gateway/provider proof of this notes-specific catalog change is still REQUIRED; earlier transcript fixture proof is not notes proof. Installer/overlay/exact candidate image qualification belongs to integration/root.
- ⚠ Production resolver/read/hash wiring remains with implement_host; this section does not change its interface plan. Explicit deployment source mappings, actual active readback/import, native Coordinator context consumption and durable candidate→task idempotency remain open. Pure populated grouping is proven; task persistence is not. No P2 live/business green claimed.

### OWNED continuation plan — resolver and native handoff, 2026-10-29

Authorized follow-up assigns notes resolver composition to this dedicated source lane. PR142/b54de126 reader contract inspected locally at `/tmp/inertia-member-knowledge-reader-20261029/apps/member/src/org/machine-reader.ts`: POST `/api/org/knowledge`, operations read(sourceId,contentHash?,offset?,limit?) and find_by_hash(contentHash). Read pages use Unicode code-point offsets; hash lookup returns identity only. No read credential is configured and activation remains off.

1. Add a small `notes-app.ts` adapter using existing SDK HTTP/secrets and ownerNotes.origin with exact fixed ingest/knowledge paths. Optional protected `ownerNotes.memberStore` contains DISTINCT readTokenRef/writeTokenRef. Missing refs => null resolver/no network. Recheck current company configuration before/after every secret/HTTP operation. Reconstruct pinned pages, demand progress/unchanged ID/hash/kind/active status/length and complete SHA256. Lost-ACK hash lookup then full read; never retry ingest POST.
2. Wire this concrete resolver in actual worker setup. Extend only owner-notes schema/settings for optional protected refs; no host.ts, app route, live credentials or native runtime edits. RED→GREEN transport tests cover multi-page Unicode, hash lookup, hidden, drift/hash mismatch, revoked refs, credential separation, ambiguous write, bounded bodies and default-null. Registered SDK/PGlite job composition must prove one write/wake on replay/lost ACK.
3. Existing native create_task already owns durable idempotent task creation; there is NO notes-specific persistent candidate writer in the plugin. Reuse generic native creation rather than implementing another writer. Prepare pure source-validated excerpt grouping→stable idempotent create_task arguments using current trusted Coordinator scope and opaque source evidence locators. Prove DTO/conversion→group→ordinary native admission in existing disposable native fixture if available. A model-selectable grounded-excerpt invocation remains an explicit tool/catalog contract until integrated by assigned native owner; do not credit a pure helper as actual delegation.
4. One independent focused source review, final targeted checks/typecheck and one source handoff containing converter/replay/resolver/catalog patches. Root/native owner rebases to current43/26 baseline and qualifies installer/image. No deployment or real DAO import in this lane.
