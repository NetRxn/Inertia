# Run the connected Buzz–Paperclip loop

> The live MVP guide and release scope are in [MVP guide](guide/README.md). This document describes the controlled Buzz bridge/fixture and connection contract; real Paperclip-Buzz participation is deferred from the current MVP.

## Run the fixture

From a source checkout, use Node 24.11.0 or newer and run `npm ci && npm run demo`. Run development commands from the checkout. This uses the real signature verifier, native SDK adapter, PostgreSQL migration/store, service and Buzz HTTP transport. External host and relay I/O are synthetic. It prints the linked source, native comment and receipt IDs, then proves replay after service reconstruction creates no second comment. The fixture runs offline without credentials.

`npm test && npm run typecheck && npm run build` verifies the full repository. `npm run demo:transport` isolates the signed HTTP transport.

## Connect an admitted installation

1. Build the package and install it through Paperclip's admitted plugin workflow using `paperclipPlugin.manifest` and `paperclipPlugin.worker` from package.json. Host/SDK target: 2026.1012.0. The host applies `migrations/` to its derived plugin namespace. Keep plugin ID `netrxn.inertia` unchanged.
2. In company configuration, select the Buzz HTTPS relay and an existing Paperclip secret reference containing the bridge's hex signing key. Set its matching public key. Never put key material in this repository or a plain configuration field.
3. Add explicit channel/thread → company/issue bindings and verified signed-member-key → native member pairings. Start disabled, check mappings, then enable. Pairing is an operator action, never a claim made inside a chat message. An agent key cannot impersonate its owner.
4. The native scheduled job runs each minute. Replies become native comments; supported native confirmation cards appear in the same Buzz thread. A member can use the displayed accept/reject command, and Paperclip still performs its own current membership and decision checks. Complex decisions stay in the native dashboard.

Configuration keys: `enabled`, `relayUrl`, `bridgePubkey`, `signingKeyRef` (`{type: "secret_ref", secretId: "existing-secret-id"}`), `bindings`, `pairings`, and `cards` (normally empty; rendered cards are recorded automatically). See [mapping fields](#mapping-fields) and the [native state contract](bridge-state-contract.md). All mapping rows must belong to the configuration's company and relay. Disable a connection or revoke a pairing in company configuration to stop new mutations.

## Recovery without babysitting

- Lost Buzz receipt: keep the exact signed event and retry it, respecting the relay's retry window.
- Lost native mutation response: look for the exact correlated native comment and paired author, or the native decision's authoritative resolved state. Never submit the mutation a second time merely because a timeout occurred.
- Process restart: inbox/outbox and scan checkpoints live in native plugin SQL. A saved native result without an outbox entry is repaired automatically.
- Unknown native result: health shows an actionable review requirement. Check the issue in Paperclip. Do not delete the inbox record to force replay.
- Invalid configuration or permission failure: correct the connection in Paperclip. After fixing a permanent relay denial, run the native “Retry blocked deliveries” job once. It requeues only this company’s bound receipts; normal recovery then publishes the original signed event. Error messages exclude raw response bodies, secrets and private conversation text.
- Polling rechecks the last 24 hours to catch delayed signed messages and deduplicates by event ID. Larger backlogs resume in bounded batches on the next native job. Use “Backfill connected conversations” to scan all retained history after a longer offline period; its progress survives restarts. A saturated timestamp preserves the checkpoint and reports an operator-visible blocker instead of silently dropping events.

Native jobs reconcile delivery. Paperclip owns tasks, decisions, hierarchy, assignments, wakes and audit history. Demo scope: synthetic bridge I/O.

## Mapping fields

Configure these in the intended Paperclip company's plugin settings. Use IDs from the actual native objects and signed Buzz events, not names or IDs supplied in a chat message.

- `bindings`: `{relay, channelId, rootId, companyId, issueId}`. `relay` exactly matches `relayUrl` without a trailing slash; `channelId` is the Buzz channel UUID; `rootId` is the 64-character signed thread-root event ID. Native company/issue IDs identify the destination.
- `pairings`: `{relay, companyId, pubkey, actorUserId, kind, active}`. `pubkey` is the verified member's 64-character Nostr public key, and `actorUserId` is that same person's native member ID. Use `kind: "human"` only for a verified human key; agent keys use `"agent"` and cannot submit human decisions. `active: false` revokes the mapping.
- `cards`: normally `[]`. The bridge records supported native confirmation cards automatically. Do not copy or invent another issue's card tokens.
- `bridgePubkey`: the public key matching the selected existing signing-key secret. `signingKeyRef` is a Paperclip secret reference object, never the key itself.

Example shape (synthetic placeholders; replace every ID with verified values before enabling):

```json
{
  "enabled": false,
  "relayUrl": "https://buzz.example.invalid",
  "bridgePubkey": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "signingKeyRef": {"type": "secret_ref", "secretId": "SELECT_EXISTING_SECRET"},
  "bindings": [{
    "relay": "https://buzz.example.invalid",
    "channelId": "44444444-4444-4444-8444-444444444444",
    "rootId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "companyId": "11111111-1111-4111-8111-111111111111",
    "issueId": "22222222-2222-4222-8222-222222222222"
  }],
  "pairings": [{
    "relay": "https://buzz.example.invalid",
    "companyId": "11111111-1111-4111-8111-111111111111",
    "pubkey": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "actorUserId": "33333333-3333-4333-8333-333333333333",
    "kind": "human",
    "active": true
  }],
  "cards": []
}
```
