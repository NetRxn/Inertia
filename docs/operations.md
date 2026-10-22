# Run the connected Buzz–Paperclip loop

## Try it now

Use Node 24 and run `npm ci && npm run demo`. This uses the real signature verifier, native SDK adapter, PostgreSQL migration/store, service and Buzz HTTP transport. Only the external host and relay I/O are fixtures. It prints the linked source, native comment and receipt IDs, then proves replay after service reconstruction creates no second comment. Nothing leaves your computer and no credentials are needed.

`npm test && npm run typecheck && npm run build` verifies the full repository. `npm run demo:transport` isolates the signed HTTP transport.

## Connect an admitted installation

1. Build the package and install it through Paperclip's admitted plugin workflow using `paperclipPlugin.manifest` and `paperclipPlugin.worker` from package.json. Host/SDK target: 2026.1012.0. The host applies `migrations/` to its derived plugin namespace. Keep plugin ID `netrxn.inertia` unchanged.
2. In company configuration, select the Buzz HTTPS relay and an existing Paperclip secret reference containing the bridge's hex signing key. Set its matching public key. Never put key material in this repository or a plain configuration field.
3. Add explicit channel/thread → company/issue bindings and verified signed-member-key → native member pairings. Start disabled, check mappings, then enable. Pairing is an operator action, never a claim made inside a chat message. An agent key cannot impersonate its owner.
4. The native scheduled job runs each minute. Replies become native comments; supported native confirmation cards appear in the same Buzz thread. A member can use the displayed accept/reject command, and Paperclip still performs its own current membership and decision checks. Complex decisions stay in the native dashboard.

Configuration keys: `enabled`, `relayUrl`, `bridgePubkey`, `signingKeyRef` (`{type: "secret_ref", secretId: "existing-secret-id"}`), `bindings`, `pairings`, and `cards` (normally empty; rendered cards are recorded automatically). Binding and pairing shapes are documented in `docs/bridge-state-contract.md`. All mapping rows must belong to the configuration's company and relay. Disable a connection or revoke a pairing in company configuration to stop new mutations.

## Recovery without babysitting

- Lost Buzz receipt: keep the exact signed event and retry it, respecting the relay's retry window.
- Lost native mutation response: look for the exact correlated native comment and paired author, or the native decision's authoritative resolved state. Never submit the mutation a second time merely because a timeout occurred.
- Process restart: inbox/outbox and scan checkpoints live in native plugin SQL. A saved native result without an outbox entry is repaired automatically.
- Unknown native result: health shows an actionable review requirement. Check the issue in Paperclip. Do not delete the inbox record to force replay.
- Invalid configuration or permission failure: correct the connection in Paperclip. After fixing a permanent relay denial, run the native “Retry blocked deliveries” job once. It requeues only this company’s bound receipts; normal recovery then publishes the original signed event. Error messages exclude raw response bodies, secrets and private conversation text.
- Polling rechecks the last 24 hours to catch delayed signed messages and deduplicates by event ID. Larger backlogs resume in bounded batches on the next native job. Use “Backfill connected conversations” to scan all retained history after a longer offline period; its progress survives restarts. A saturated timestamp preserves the checkpoint and reports an operator-visible blocker instead of silently dropping events.

The plugin runs a delivery reconciliation job, not a separate task scheduler. Paperclip keeps ownership, decisions, hierarchy, assignment, wakes and native audit history. No blockchain vote, grant submission, credential creation or live deployment is performed by this demo.
