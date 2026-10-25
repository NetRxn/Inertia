# Buzz durable transport implementation plan

> **For agentic workers:** Use test-driven implementation and independent review.

**Goal:** Publish delayed business records with a fresh initial transport timestamp while preserving one immutable signed identity and delivery uncertainty across retries and restarts.

**Architecture:** Extend the existing outbox, not a second ledger. Persist signed wire bytes and a conservative write-ahead delivery-attempt marker before I/O. Retain existing source, actor, binding and audience gates. Never replace an existing signed event; aged events require exact-ID verified readback and remain unresolved if absent or inaccessible.

**Tech stack:** TypeScript, Nostr signatures, native plugin PostgreSQL, Vitest/PGlite.

**Spec:** `docs/development/buzz-transport.md`; relay compatibility: ordinary event freshness is limited to ±900 seconds before deduplication.

## Constraints and review focus

- Preserve business timestamps in payloads and current durable logical receipt keys.
- Crash between attempted publication and response must never reset uncertainty.
- Concurrent insertion must reuse the winning persisted signature, never a new identity.
- Membership/audience loss or readback absence is not authority to publish a replacement.
- Legacy records have no reliable attempted marker and must migrate conservatively.
- No runtime configuration, deployment, credentials or actual relay traffic.

## Tasks

1. HTTP tests first: durable prior uncertainty, aged exact-ID readback, missing/mismatched/denied readback, clock jump inside retry, preserved serialized bytes. Implement optional publication context with bounded retry policy unchanged for fresh events.
2. Store/service tests first: persist wire bytes and write-ahead attempt marker, survive reconstruction, initial timestamp independent of business history, membership/audience revocation. Add one outbox migration and conditional marker update; retain immutable rows.
3. Urgent alert tests first: separate observedAt from transport time and use same existing outbox publication context, without changing source or audience gates.
4. Run focused tests, complete npm test, typecheck, build and package checks. Independently review the complete diff and address important findings. Publish source draft only after verification; integration/relay qualification is separate.
