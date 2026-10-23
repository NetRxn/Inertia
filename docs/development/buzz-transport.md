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
