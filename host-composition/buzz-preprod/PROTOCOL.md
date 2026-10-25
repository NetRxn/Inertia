# Protocol compatibility and qualification gates

Read-only source review, 2026-10-25. Phone use is deferred. No server, invite, account, key generation, installation or product-code change occurred. The primary next qualification is an isolated synthetic local actor → official relay → Inertia → reply/readback flow.

## Pinned evidence and verdict

- Buzz `9e8c9fc04daf20259cd259dcaec89109587cc7f5`.
- Inertia develop `8d15eaaa514d5604244fd731982df13e9a54f810`.
- Relevant Inertia source copied unchanged under `evidence/inertia/src/`.

**The real relay already provides the HTTP protocol Inertia consumes. No protocol shim or additional orchestrator is required for immediate kind-9 channel traffic. Actual relay execution remains unqualified; the offline test is not a relay substitute.**

| Contract | Source finding |
|---|---|
| Query | `POST /query`, JSON array of Nostr filters, JSON array of signed events. |
| Publish | `POST /events`, signed event object, receipt `{event_id, accepted, message}`. |
| HTTP authorization | `Authorization: Nostr <base64(JSON signed event)>`; kind 27235, exact URL/method/body SHA-256, fresh nonce. |
| Auth timestamp | ±60 seconds; client and server clocks must agree. |
| Community | Actual Host selects tenant; configured WSS scheme makes expected HTTP authorization URL HTTPS. Proxy must preserve canonical authority. |
| Event signature | Schnorr/id verified; kind-9 author must equal NIP-98 authenticated public key. |
| Channel/thread | UUID `h` plus NIP-10 root/reply. Root-only is top-level; root+reply resolves root, reply-only resolves reply target. |
| Host transport | Worker calls `ctx.http.fetch`; actual native host response/header/stream/redirect and origin admission must be tested, not inferred from global fetch. |

Sources: [official bridge](https://github.com/block/buzz/blob/9e8c9fc04daf20259cd259dcaec89109587cc7f5/crates/buzz-relay/src/api/bridge.rs) (`submit_event`, `query_events`, `nip98_expected_url`); [NIP-98 verifier](https://github.com/block/buzz/blob/9e8c9fc04daf20259cd259dcaec89109587cc7f5/crates/buzz-auth/src/nip98.rs); [CLI signing/query](https://github.com/block/buzz/blob/9e8c9fc04daf20259cd259dcaec89109587cc7f5/crates/buzz-cli/src/client.rs); [thread semantics](https://github.com/block/buzz/blob/9e8c9fc04daf20259cd259dcaec89109587cc7f5/crates/buzz-cli/src/commands/messages.rs); [Inertia HTTP](https://github.com/NetRxn/Inertia/blob/8d15eaaa514d5604244fd731982df13e9a54f810/src/buzz/http.ts); [worker wiring](https://github.com/NetRxn/Inertia/blob/8d15eaaa514d5604244fd731982df13e9a54f810/src/worker.ts).

## Admission is separate from protocol compatibility

The bridge key needs independent relay membership and channel access. The synthetic human key needs its own membership and trusted active Inertia pairing to a native user. Exact relay/company/issue/channel/root binding is host-owned; joining a Buzz community does not grant native authorization. The bridge ignores its own echoes and rejects unpaired/unbound input. No credentials should be reused from the grant runtime.

NIP-FI `enforce` requires a separate `Nostr-Federated-Identity: Bearer <JWS>` header absent from this adapter. Verified OSS default is `off` when unset; this is a new isolated deployment assumption, not permission to disable another deployment's policy. NIP-OA delegated membership requires `x-auth-tag`, also absent. Initial tests should independently admit the bridge identity rather than silently assuming either mechanism.

Sources: [binding policy](https://github.com/NetRxn/Inertia/blob/8d15eaaa514d5604244fd731982df13e9a54f810/src/bridge/policy.ts); [NIP-FI ingress](https://github.com/block/buzz/blob/9e8c9fc04daf20259cd259dcaec89109587cc7f5/crates/buzz-relay/src/nip_fi_http.rs); [default mode](https://github.com/block/buzz/blob/9e8c9fc04daf20259cd259dcaec89109587cc7f5/crates/buzz-relay/src/nip_fi_config.rs).

## Identified delayed-publication incompatibility

Official [ingest.rs](https://github.com/block/buzz/blob/9e8c9fc04daf20259cd259dcaec89109587cc7f5/crates/buzz-relay/src/handlers/ingest.rs), lines 2574–2581, rejects ordinary event timestamps outside ±900 seconds before ordinary duplicate handling. Inertia [service.ts](https://github.com/NetRxn/Inertia/blob/8d15eaaa514d5604244fd731982df13e9a54f810/src/bridge/service.ts) `makeReceipt` timestamps at inbox creation and `mirrorComments` at original native comment time; retries preserve signed bytes.

Consequences:
1. A native comment older than fifteen minutes can fail on its first relay publication.
2. A successfully stored event whose response was lost can be rejected when retried after fifteen minutes.
3. Within one client call, uncertainty is preserved after an ambiguous attempt. Across separate calls, the client sees a first-attempt 400 and reports `BuzzRequestRejected`; the durable service may mark a previously uncertain delivery blocked. That refusal is not proof the earlier event was absent.
4. Current service delivery does not perform exact-ID readback before retry. Readback capability exists in the HTTP query client but is not integrated recovery.

### Proposed smallest repair contract — NOT implemented

Keep changes in existing service/outbox transport; no wrapper or additional daemon.

- Separate logical receipt/comment identity and original business timestamp from transport `created_at`. Preserve source time in the signed payload. Newly constructed first publications use current transport time, with original identity unchanged.
- Persist signed bytes/event ID before attempting delivery. Retries reuse bytes; never refresh an ambiguous event's timestamp in place.
- Persist delivery uncertainty across calls. A later age refusal cannot erase it.
- Before retrying an expired persisted event, query the exact event ID in the trusted relay/channel scope with current NIP-98 auth. A matching independently verified event can reconcile delivered without republishing.
- Empty readback alone is NOT sufficient evidence for a new event: account for access revocation, stale replica reads, outages and uncertainty. If replacement is ever authorized, require an authoritative absence/reconciliation policy, retain prior event ID and original logical receipt ID, and ensure one logical native effect. Otherwise leave blocked/unknown for operator review.
- On revocation or malformed/mismatched readback, remain blocked/unknown. Do not bypass membership or re-sign to force progress.

### Reproducible offline characterization

`tests/timestamp-contract.mjs` bundles the pinned copied HTTP/events source using existing dependencies. It uses the existing public all-01 Inertia fixture key (never a deployment identity), injected fetch, fixed clock and an in-memory rule model. It starts no listener and makes no network request. Its query model handles exact IDs only; it does not simulate kinds/channel filtering, membership or real read consistency. It asserts raw serialized retry-body equality as well as event equality. Five assertions cover older first publication, lost response plus delayed retry, later-call uncertainty gap, exact-ID readback, and absence without replacement authorization.

```sh
INERTIA_DEPENDENCY_ROOT=/path/to/existing/reviewed/Inertia-checkout \
  node tests/timestamp-contract.mjs
```

Observed: Node v24.22.1, existing esbuild 0.28.2 / nostr-tools 2.25.2; 5 characterization checks passed (rerun the command to reproduce; transient logs are not published). This confirms client behavior against the explicitly modeled source rule, NOT official relay enforcement, real host HTTP behavior, full worker recovery, or a repaired product. Product source was not changed. The first run encountered a test-only comparison of nostr-tools' verification symbol; comparison was corrected to canonical JSON fields and rerun successfully.

## Real official-relay test plan — requires a Docker-capable isolated executor

Prerequisites: reviewed image digests; approved isolated Docker host; approved isolated secret procedure; private TLS endpoint trusted by Inertia; exact tenant hostname; separate native test host/company/issue and member identities. No public hostname is needed while phone is deferred. Do not use fixture keys in any exposed deployment. Docker is absent in this executor; these steps have NOT run.

1. Start only the isolated official synthetic stack; verify each dependency healthy and relay `/_readiness`. Verify canonical tenant Host and TLS (no insecure bypass). Keep source pins and actual image digests in evidence.
2. Bootstrap isolated owner, independently admit bridge and synthetic member, create a test channel and kind-9 root using official supported APIs/CLI. Record public IDs only. Community admission does not automatically establish channel access.
3. Configure native test issue/user and exact Inertia bindings/pairing. Verify `ctx.http.fetch` admits only the intended origin, preserves NIP-98/body bytes, returns stream-compatible Responses and refuses redirects. No existing grant-runtime DB, native issue or secret is permitted.
4. Synthetic member publishes a fresh signed reply with exact `h`, root and reply tags. Worker polls real `/query`, verifies the event, applies exactly one synthetic native comment and durably stores ingress receipt.
5. Worker signs/persists/publishes the reply via real `/events`; require matching accepted event ID. Query that exact ID, independently verify signature/content/thread and assert native and relay evidence agree. A green readiness probe is insufficient.
6. Repeat polling/reconciliation; assert one native comment, one logical receipt, no echo loop. Verify unpaired key, wrong channel/root/host, tampered event/body, replayed NIP-98 and revoked memberships fail closed.
7. Publish an event dated 901 seconds old: require official rejection and no stored event. Mirror a synthetic native comment >15 minutes old to reproduce the service-level first-publication failure.
8. Simulate response loss only in the approved test transport after official relay accepts an event. Preserve original outbox bytes, advance controlled server clock in a dedicated test harness OR wait past the relay's fifteen-minute window; do not alter shared host clocks. Retry same bytes, capture rejection/uncertainty, and query exact ID to prove whether the original was stored. Test both fresh inline retry and later durable-worker invocation.
9. Query through the actual authorized identity; prove matched ID reconciles without new signature. Empty, denied, malformed, stale or unavailable readback must not trigger an automatic new message. If replica routing is configured, explicitly qualify read consistency before treating absence as meaningful.
10. Do not label recovery qualified until a reviewed repair passes these cases against real relay and durable native host. Stop only this preprod project; retain test receipts without secrets. No publication or runtime ownership is transferred implicitly.

## Optional phone join — deferred

Future owner/admin mints limited-use expiring `POST /api/invites`; relay returns code and tenant-host URL. Phone-local joining identity signs `POST /api/invites/claim` with `{code, policy_receipt?}`; required join policy must be accepted first. This is community join, not copying desktop identity. It still needs a compatible installed app, approved reachable HTTPS/WSS and channel setup; installed app version remains unknown. Do not create an invite now.

Source: [invite mint and claim](https://github.com/block/buzz/blob/9e8c9fc04daf20259cd259dcaec89109587cc7f5/crates/buzz-relay/src/api/invites.rs).
