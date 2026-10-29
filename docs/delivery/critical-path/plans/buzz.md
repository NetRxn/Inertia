# Buzz bridge Implementation Plan

> **For agentic workers:** Execute the approved tasks in this session; use superpowers:executing-plans. Source review and live acceptance are separate.

**Goal:** Connect one explicitly bound native conversation to the already-existing Buzz relay without changing the member app.

**Architecture:** Reuse the current signed HTTP query/publication client, native bridge state, immutable receipt replay and identity pairings. Member relay reading and the Paperclip bridge are independent.

**Tech Stack:** Existing TypeScript, native Paperclip SDK, PostgreSQL/Drizzle, bounded HTTP and protected secret references; no new platform.

**Spec:** /tmp/inertia-p1-contract-20261029.md

## Global constraints

- Preserve existing data, native authority, provenance, genuine holds and peer active checkouts.
- No credential values, cookies, provider logs or real Buzz posts in source or receipts.
- Test fixtures are synthetic. A known-DAO-style fixture is not a verified production fact.
- Page/response limits bound transport, not the amount of work the agents may perform.
- Source-qualified, deployed, observed and business-accepted are distinct states.

## Clean versus ⚠

- CLEAN: signed NIP98 POST /query and POST /events contracts, immutable publication/replay, exact channel/root mapping and native membership guards exist and have controlled-source tests.
- CLEAN: user demonstrated member app use; do not re-test it as a prerequisite.
- ⚠ Last recorded Paperclip metadata was controlled-relay-only,0real bindings,0pairings,0inbound receipts. Obtain one current safe projection before claiming it remains current; no secret resolution or messages.
- ⚠ Real bridge signer reference/public-key match and relay admission; real channel UUID/thread root; verified human public-key→native user pairings; exact canary scope remain unverified. Owner: root/operator with relay owner/Kyle.

## Review focus

No global/general-channel canary; no member-reader credential cloning; unpaired authors deny; stale card digest denies; outboundComments=false is not a universal no-write switch because inbound receipts/cards can publish.

### Task1: Bounded current readiness projection (owner: implement_host, read-only)

Use existing root/operator metadata probe/config reader. Return only relay class, configured/enabled counts, real-vs-controlled binding count, active human pairing count, signer-reference presence, cards/receipt counts and current image/config hashes. Do not resolve signing material or print raw config. Compare to the old recorded receipt explicitly.

- [ ] Record a fresh source/runtime classification; keep missing references ⚠.
- [ ] Prepare a disabled exact canary mapping only after nonsecret channel/root/native issue and verified pairing references are supplied.

### Task2: Controlled exchange (owners: sole operator + relay owner; separate live authorization)

Existing paths: src/config.ts; src/buzz/http.ts/events.ts; src/bridge/service.ts/policy.ts/reconcile.ts; worker signer resolution. No new transport or scheduler.

- [ ] Offline real SDK/state fixture: paired signed event→one native comment→one same-event signed receipt; uncertain ACK/restart replay no second comment. Foreign thread/author/current native membership negatives.
- [ ] With explicit canary scope, one actual signed read of that thread; then one agreed test event/native comment/receipt exchange. Record IDs/counts/status only; never post in real general merely to test.
- [ ] Prove replay and native permissions, then explicitly decide whether outbound comment mirroring is wanted. Do not infer consent from bridge enablement.

**Acceptance:** one actual authorized canary exchange survives replay with correct native human identity. Member /work or relay settings are not bridge acceptance.
