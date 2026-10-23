# Native comment mirroring (opt-in)

The existing native reconciliation job can project first-publication Paperclip comments to a bound Buzz thread. Paperclip owns tasks, assignments, budgets, author identity and wakes. Mirroring uses existing plugin capabilities and scheduling.

## Enable only for a verified audience

Existing bindings remain outbound-disabled. On an explicitly authorized binding, add:

```json
"outboundComments": {
  "enabled": true,
  "audienceAcknowledged": true,
  "notBefore": "2026-10-23T00:00:00.000Z"
}
```

The acknowledgment means the operator authorizes native comment text to be shared with **everyone who can read the configured Buzz thread**. Native membership and signed reply pairing do not establish the readership of that thread. Verify the destination audience before enabling. Use a canonical UTC ISO timestamp including milliseconds to bound the history that may be exported. Disabling, removing the binding or narrowing the start boundary prevents subsequent publication of affected queued snapshots.

Only known user/agent authors with matching native identity fields, valid creation timestamps and nonempty bodies up to 16 KiB qualify. Unknown/system authors, ambiguous attribution, deleted comments and malformed timestamps fail closed. The projection contains company/issue/comment identifiers, creation time, generic author label and body. Metadata, attachments, run IDs, responsible-user IDs and native author IDs are not projected. The event is signed by the bridge, not by the native author.

## Delivery and limits

A stable full-binding/comment-ID receipt key deduplicates scans and restarts in the existing outbox. Retries retain the exact persisted signed event. Real inbound echoes are suppressed using the existing durable source correlation, not arbitrary marker-looking text.

Before publishing, the bridge rechecks configuration and reads the native comment. Missing, deleted, edited or no-longer-authorized snapshots become terminal suppressed records. The retry-blocked job cannot resurrect them. A failed native read defers the operation; it does not authorize stale publication or imply deletion. If the comment later returns to the old body, its suppressed first-publication identity remains suppressed.

Scope: **first-publication mirroring**. Delivered posts remain unchanged after native edits or deletion. A publish timeout may mean the relay accepted the event; suppressing its retry cannot retract a possible earlier acceptance. Rebinding to a new destination creates a distinct delivery identity and requires fresh audience verification.

The existing once-per-minute reconciliation job enqueues at most 100 new comments per binding per pass. Native reads currently return the complete issue comment list because the inspected SDK has no pagination argument. The outbox's existing bounded delivery and retry behavior applies. Native events are not used as the sole source because the inspected host event bus is in-process and does not provide durable replay.

Test scope: synthetic fixtures; live exports pending.

## Concurrency and interrupted publication

Publication starts with an atomic, non-expiring `pending` → `publishing` claim in the existing outbox. A worker holding an old pending snapshot cannot claim a row another worker already suppressed. Once claimed, the operation is **in flight**: a subsequent revocation requests suppression but cannot recall a request that may already reach the relay. Confirmed success becomes delivered; failure becomes suppressed if suppression was requested, otherwise normal exact-event retry/backoff applies. Blocked and deferred snapshots also receive bounded, rotating source/config revalidation independently of delivery eligibility. The scan uses persisted company scopes, including old relays and removed bindings. Disabling the whole connection requests suppression in bounded batches without any external reads or sends; outstanding publishing claims stay visible in company health.

Claims must not expire or be stolen. At inspected Paperclip host commit `bba6a45`, [the worker RPC timeout](https://github.com/paperclipai/paperclip/blob/bba6a45/server/src/services/plugin-worker-manager.ts) rejects the RPC without cancelling its asynchronous handler; [the scheduler](https://github.com/paperclipai/paperclip/blob/bba6a45/server/src/services/plugin-job-scheduler.ts) then releases its in-memory overlap guard. A timed-out handler may still resume. Time elapsed therefore cannot prove that an old publisher is stopped.

An interrupted claim remains explicitly uncertain in health (`inFlightPublications`) with recovery guidance. Ordinary retries and “Retry blocked deliveries” never steal it. To recover:

1. An administrator verifies all prior worker processes capable of holding the claim are stopped, not merely timed out. If this cannot be established, leave the claim uncertain.
2. Inspect the exact company-scoped receipt and current `publish_token` in the existing outbox. Do not change the stored event or event ID.
3. Perform one token-matched recovery using `recoverCommentDelivery(receiptKey, token)` through an authorized administrative maintenance context. This helper is not exposed as an automatic or scheduled job. It changes only that still-publishing token's row: suppression requested → suppressed; otherwise → pending. A wrong/stale token is a no-op.
4. Start/resume the worker. Current source and configuration are revalidated before any new claim. An eligible retry publishes the identical stored event, not a newly signed replacement. A relay may have accepted the earlier request even when its response was lost.

Known failures retry automatically. Uncertain claims require the verified-termination recovery above.

### Native SQL parameter binding

Paperclip 2026.1012.0's `plugin-database` `bindSql` interpolates each RPC parameter
through Drizzle's SQL template. JavaScript arrays expand as SQL lists, so they
are not PostgreSQL `text[]` parameters (an empty array renders `()`). Issue-set
filters and validation-scan updates therefore send scalar JSON strings and use
`jsonb_array_elements_text` in a subquery. This preserves empty-set semantics and
keeps every identifier value parameterized. Direct PGlite parameter tests do not
exercise this host boundary; release qualification must also run the packaged
worker against the actual pinned host database RPC implementation.
