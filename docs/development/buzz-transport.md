# Buzz transport foundation

Run with Node.js 24.11 or later:

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
npm run demo
```

The offline demo uses a public fixture key and in-process relay. It verifies signed messages and transient-outage recovery with a stable outgoing event ID.

## Contracts

- `verifyBuzzEvent(raw)` copies canonical fields, verifies the event hash and Schnorr signature, freezes the result, and extracts one UUID channel plus unambiguous root/reply references. Buzz classifies a root-only message as top-level (its own ID); root+reply resolves to root, and reply-only resolves to the reply target. Nostr verification cache flags on caller objects are never trusted.
- `makeBuzzHttpClient({ relayUrl, signer, fetch, clock, sleep? })` exposes `query(filters)` and `publish(signedEvent)`. `clock` returns Unix seconds; `signer` can be asynchronous. The HTTP client binds signed routing hints to the configured HTTPS relay.
- Query is `POST /query` with a JSON array of filters. Publish is `POST /events` with the signed event, expecting `{event_id, accepted, message}`. Only kind 9 messages are supported by this initial surface, not moderation or other potentially non-idempotent commands.
- Each attempt gets fresh NIP-98 auth, including URL, method, body SHA-256, timestamp and nonce. Redirects are disabled. Retries reuse the immutable signed message and exact serialized bytes. Network failures and 429/500/502/503/504 receive up to three attempts with bounded exponential delay and jitter. Retry-After seconds and HTTP dates are honored; delays beyond 30 seconds are deferred with BuzzRetryDeferred rather than retried early.
- Response parsing is streamed and capped at 1 MiB by default, including chunked bodies. Serialized individual events are capped at 64 KiB. Both limits are configurable from 1 byte to 16 MiB. Oversized bodies are cancelled before full buffering.
- BuzzConfigurationError identifies pre-delivery configuration/signing failures; BuzzRequestRejected identifies a definitive first-attempt 4xx refusal (except 429) or a matching accepted=false receipt. These should be blocked, not blindly retried. A refusal after an earlier ambiguous attempt preserves uncertainty. Malformed/mismatched success receipts are also uncertain.
- Exhausted publication errors return `BuzzDeliveryUnknown` carrying the stable event ID. Reconcile against the relay or retry the same persisted signed event, never re-sign the message blindly. The caller is responsible for durable outbox storage before `publish`.
- Signatures establish key ownership. The bridge enforces trusted relay/company/member bindings and native authorization.

## Reproducible source baseline

Buzz source: `block/buzz` at `dc25198d530acc6237a0320b697365f29daf0ea6`:
- `crates/buzz-cli/src/client.rs`: `sign_nip98`, `query_multi`, `submit_stored_event`.
- `crates/buzz-relay/src/api/bridge.rs`: `submit_event`, receipt JSON.
- `crates/buzz-cli/src/commands/messages.rs`: channel UUID and NIP-10 root/reply references.

Paperclip SDK: public registry `@paperclipai/plugin-sdk@2026.1012.0`, exact dependency and integrity in `package-lock.json`. This is the release baseline selected alongside source pin `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`. The source package version is a publishing placeholder (`1.0.0`); no byte-for-byte source-to-registry equivalence is asserted. The transport itself does not invoke the SDK; subsequent adapters compile against this pinned package.

Fixtures contain synthetic data only.

## Durable freshness and uncertainty

The official relay checks ordinary event `created_at` within ±900 seconds **before** deduplication. A historical native comment or recovered receipt therefore uses the bridge clock at its first signing, not the original business time. Native comment `createdAt`, alert `observedAt`, and receipt `sourceCreatedAt` remain in signed content. Persisting a signed message does not permit later changing its timestamp or signature.

Migration `008_transport_delivery.sql` extends the existing outbox with original serialized event bytes and a conservative write-ahead `delivery_attempted` marker. The marker is persisted before network I/O and survives worker reconstruction, blocked-receipt resumption, and targeted stopped-worker recovery. It means **may have reached the relay**, not proof of acceptance. Legacy rows retain their existing event unchanged, have no fabricated original-byte string, and are treated as potentially delivered. New rows store their wire bytes before sending. Logical receipt keys and unique signed event identities remain immutable.

The publisher accepts optional `{ priorUncertain, serializedEvent }` from that durable record. Persisted bytes must verify as the exact signed event and are reused verbatim. A later rejection cannot erase earlier uncertain delivery. Before each aged publication attempt (also after asynchronous auth signing), the client queries the exact event ID and verifies the returned signed event, including its original signature. Exact readback establishes historical relay acceptance; an empty result, query outage, different event/signature, or membership denial does not establish non-delivery. These cases remain unresolved and do not send an aged message or generate a replacement identity. Fresh retries retain the existing bounded retry/backoff behavior.

Current actor, membership, binding, native-source and audience checks still govern publication; reconciliation does not grant permissions. A delayed queue can age out before any observed send, and legacy records may lack reliable delivery history. They remain conservative rather than silently replacing identity. Operators must not infer from a pending/blocked row or missing readback that it is safe to create a second message. No automatic re-signing or identity replacement is provided.

Tests model these boundaries with synthetic events and in-process responses; they do not establish deployment or actual-relay qualification.

Publication claims do not expire, including ordinary receipts. A process interrupted before sending or after possible acceptance leaves its claim visible as in-flight/uncertain; a new worker does not steal it. After independently verifying that the previous worker has stopped, an authorized administrative maintenance context may call `recoverCommentDelivery(receiptKey, matchingToken)` (legacy method name) for that exact row. Wrong tokens are no-ops; suppression remains terminal. Recovery preserves wire bytes, event identity and attempted history, then permits normal same-event reconciliation. This is not unattended restart recovery and no automatic administrative recovery is introduced.
