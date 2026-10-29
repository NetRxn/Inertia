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
- VERIFIED CURRENT22:34:35Z: pluginREADY, bridgeenabled, controlled relay,1total binding,0real-relay bindings,0active real human pairings,0real outbound-comment bindings. Signer-reference/public-key presence belongs to the controlled configuration. Receipt counters were not freshly probed. Safe receipt `/tmp/inertia-buzz-config-metadata-20261029/latest.json`; no secret resolution, relay contact or message read/write.
- ⚠ Real bridge signer reference/public-key match and relay admission; real channel UUID/thread root; verified human public-key→native user pairings; exact canary scope remain unverified. Owner: root/operator with relay owner/Kyle.

## Review focus

No global/general-channel canary; no member-reader credential cloning; unpaired authors deny; stale card digest denies; outboundComments=false is not a universal no-write switch because inbound receipts/cards can publish.

### Task1: Bounded current readiness projection (owner: implement_host, read-only)

Use existing root/operator metadata probe/config reader. Return only relay class, configured/enabled counts, real-vs-controlled binding count, active human pairing count, signer-reference presence, cards/receipt counts and current image/config hashes. Do not resolve signing material or print raw config. Compare to the old recorded receipt explicitly.

- [x] Record a fresh source/runtime classification; keep missing references ⚠.
- [ ] Prepare a disabled exact canary mapping only after nonsecret channel/root/native issue and verified pairing references are supplied.

### Task2: Controlled exchange (owners: sole operator + relay owner; separate live authorization)

Existing paths: src/config.ts; src/buzz/http.ts/events.ts; src/bridge/service.ts/policy.ts/reconcile.ts; worker signer resolution. No new transport or scheduler.

- [ ] Offline real SDK/state fixture: paired signed event→one native comment→one same-event signed receipt; uncertain ACK/restart replay no second comment. Foreign thread/author/current native membership negatives.
- [ ] With explicit canary scope, one actual signed read of that thread; then one agreed test event/native comment/receipt exchange. Record IDs/counts/status only; never post in real general merely to test.
- [ ] Prove replay and native permissions, then explicitly decide whether outbound comment mirroring is wanted. Do not infer consent from bridge enablement.

**Acceptance:** one actual authorized canary exchange survives replay with correct native human identity. Member /work or relay settings are not bridge acceptance.

## Focused adversarial review — 2026-10-29 (one pass)

**Finding BZ-1 — ⚠ the current acceptance sentence is narrower than the approved business loop.** Historical authority is the original master plan Task4 (canonical workspace reference: `mission-alignment-20261028/midnight-delivery-plan-20261028.md`) and P1/P2 plan (canonical workspace reference: `mission-alignment-20261028/p1-buzz-p2-docs-production-plan.md`), dated October28 18:35 CDT: isolated substantive member request → native work → signed response, followed by safe new-message shadow ingress; bidirectional production acceptance requires the exact approved canary. A comment/receipt round trip alone does not demonstrate work execution or a useful returned result. This is acceptance drift, not a missing transport framework. The original files are delivery snapshots outside the enclosing Git checkout; an approval commit for those exact files is **UNKNOWN**, not inferred from their title.

**Existing native primitive, verified first-party this pass:** Paperclip SDK `issues.createComment` with a verified active human `actorUserId` preserves identity and invokes the ordinary assignee wake; agent-attributed comments do not. See [current canonical host source](https://raw.githubusercontent.com/paperclipai/paperclip/master/server/src/services/plugin-host-services.ts), `createComment`, and [current Issues API](https://docs.paperclip.ing/reference/api/issues/). Compare the installed pin separately: [bba6a45 host source](https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/server/src/services/plugin-host-services.ts). Current upstream is capability evidence, not an upgrade or installed-runtime claim.

**Actual implementation inspected:** `/tmp/inertia-delivery-20261028/inertia`, HEAD `9a202c6db15240e5d1b4bafc072c13260e13f19a`; `src/paperclip/adapter.ts:31` already passes `actorUserId` to native comment creation. `src/bridge/service.ts` retains receipt/outbox handling and `deliver()` can publish receipts independently of outbound comment mirroring. Existing signed transport, pairings and state are the correct seams. No source change or duplicate wake mechanism is justified by this review. The plan correctly warns that `outboundComments=false` is insufficient proof of zero publications.

**Minimum change / next owner:** implement_host retains Task1 metadata projection and adds the original substantive-work step to Task2's isolated fixture and acceptance receipt. Sole operator retains real canary scope and signer/channel/pairing configuration. For inbound shadow, explicitly prove that the selected activation mode suppresses *all* sends and native mutations, including receipts/cards; if that switch is not established, keep the bridge disabled and inspect permitted messages through the existing read path. Do not advertise outbound-off as shadow by itself.

**Exact acceptance:** one source-linked request from a paired synthetic human causes one native comment and one eligible native work run; the run produces a useful result linked to that request, and the isolated relay receives its signed attributed return. Reconstruct after lost ACK/restart with no duplicate native mutation/result publication; revoke pairing/current membership and prove denial. Separately record a fresh real-channel watermark shadow receipt with zero sends and zero work mutations. Only the separately approved real canary can establish production bidirectional acceptance. Existing member-app chat success remains accepted and is not retested.
