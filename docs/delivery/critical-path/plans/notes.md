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
- ⚠ App read(id)/findByHash(hash) machine interface + read/write secret references/ingress are not yet established. Share Task1 organization-reader route, but keep ingest-write and reader credentials separate.
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
