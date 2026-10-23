# Partner graph core: local implementation contract

Contract: `partner-graph-v1`, separate from unchanged legacy `dao-knowledge-v1` comparison semantics. This slice is a composable domain core, not deployed endpoints or a completed partner inventory.

## Ownership and executable boundaries

DFW's evidence-owning domain persists typed assertions/evidence bindings, entity references, query-first receipts, delta receipts, existing audit history and its projection outbox in its existing SQLAlchemy/Alembic transaction. Website members/projects retain their canonical source IDs and ownership. Paperclip keeps tasks, authenticated decisions and plugin transport state; no partner-domain tables are added to Paperclip's plugin schema.

Inertia `src/partners/` contains the SDK-backed rebuildable projection and trusted service composition:

- `types.ts`: projection refs/events, typed entities/predicates, scope and bounded candidate query.
- `helix.ts`: actual typed operation-tree schema/index initialization, fenced versioned replacement/tombstones, receipt reconciliation and indexed pointer queries.
- `projector.ts`: one bounded batch suitable for the existing job lifecycle. Source service owns lease and contiguous outbox ack; no scheduler or task creation.
- `retrieval.ts`: authoritative currentness check, graph candidates, every-hit source/scope/version revalidation, bounded refill, query-bound opaque cursor and indexed PG fallback.
- `research.ts`: query-first receipt → gap-directed research → answer plus durable typed knowledge delta receipt. Rejected opportunities can add useful knowledge; zero useful changes require a reason. Persistence failure prevents a successful completion.

These modules are not silently registered as an unauthenticated HTTP/MCP API. Host composition must construct principals and implement `ProjectionSource`, `PartnerReadSource` and `ResearchSource` against authenticated owning-service functions. The domain supplies named partner, context, role-evidence and introduction-path reads. Never deserialize a producer's actor, policy, audience, verified flag or authority as server context. The initial code cannot claim live opportunity-scout/website ingestion until the host adapters and actual authorized sources are configured.

## Projection and safety

Typed `PartnerEntity` nodes contain only tenant, canonical ID and entity type, not names or contacts. `PartnerAssertion` records contain canonical subject/object IDs, predicate, revision, tenant-qualified lookup keys and a digest of exact typed value. Per-binding `PartnerEvidence` nodes preserve independent audience/project/opportunity/validity/freshness restrictions. `SUBJECT`, predicate-named and `SUPPORTED_BY` edges connect those references. Quotes, raw attributes, names, aliases and contacts are hydrated only from currently authorized PG evidence. Shared entity nodes cannot broaden those fields' scope.

Unique equality indexes protect tenant-qualified fence/receipt/entity/assertion keys. Equality indexes start tenant/predicate, capability-digest, subject/object and assertion-evidence selection. Initialization polls official DDL operation receipts until active before permitting projection/query use; timeouts/blocked indexes fail closed. There is no Cypher MERGE or variable-length path assumption.

Lease takeover advances a target-side monotonic epoch and owner. Each assertion write touches that same fence node in the transaction that checks the epoch/owner, compares assertion revision, replaces data/evidence and writes the receipt. Touching the fence is essential: an isolated read-only guard could permit write skew against takeover. A stale epoch cannot write even a numerically higher assertion revision. A newer tombstone keeps its receipt after data is removed; old replay cannot recreate it. Canonical entity type changes are rejected within the same transaction.

A same-revision changed structured snapshot is rejected. Duplicate and reordered evidence replay converge. Lost write responses are reconciled by writer receipt readback before any acknowledgment, not blindly retried. If acknowledgment crashes after target commit, the durable outbox event replays idempotently. Source revalidation immediately denies revoked/private/stale evidence even while the target is offline. PG authorization failures never become graph-only success.

For a genuinely oversized (>100 current source bindings) assertion, PG retains every admitted support. The exporter emits an explicit versioned `projection_omitted` tombstone rather than truncating scopes or stalling all later events. Per-assertion durable omission state keeps health degraded even after outbox acknowledgment; `projectionCurrent` must require zero pending events AND zero coverage omissions. Authorized PG fallback continues returning the complete source result. Falling below the bound creates a new complete projection revision and clears that omission. Freshness rechecks of the same exact source binding are revisioned updates, not new corroboration. This is bounded degraded coverage, not full graph readiness.

The owning service must advance assertion revision/outbox whenever evidence, scope, source revision, identity or freshness state changes. Source-change reconciliation must not send changed same-version snapshots. It must preserve a contiguous committed outbox checkpoint under its organization lock; an uncommitted sequence cannot be skipped. Revocation/deletion reconciles to a versioned tombstone, not proof inferred from a missing scrape result.

## Official Helix pin and actual qualification

Pinned `@helix-db/helix-db` **3.1.0**, official `@helix-db/helix-db-embedded` **0.3.3** for dev/test only. Node baseline remains the repository's >=24.11.0. Production runtime depends only on the SDK; the large embedded native runtime is not a production dependency.

Sources checked October23,2026:
- [TypeScript SDK](https://docs.helix-db.com/database/helix-db/start-here/sdk-setup/typescript-project-setup)
- [HTTP/OpenAPI](https://docs.helix-db.com/database/helix-db/query-guides/http-api)
- [Atomic writes](https://docs.helix-db.com/database/helix-db/query-guides/writing-data)
- [Conditional batches](https://docs.helix-db.com/database/helix-db/query-guides/advanced)
- [Secondary index lifecycle](https://docs.helix-db.com/database/helix-db/query-guides/secondary-indexes)

Server mode uses writer-only reads and durability-waiting writes. Embedded mode is explicit because it rejects server execution headers. SDK3.1.0 supports standalone/database-specific endpoints; GA shared-gateway database selection requires SDK3.2.0+ and is **not qualified or claimed** here. No account, database or credential was provisioned.

Actual local tests execute the official native embedded runtime: index activation, conditional mutation, tenant/audience/project/time filtering, replay, stale worker after takeover, concurrent writes, immutable type identity and tombstones. HTTP header/lost-response tests use a fake HTTP transport backed by that actual runtime; they are not a remote gateway test. Server deployment/version, multi-process storage/failover and account-level access remain separate gates.

## Seeds and remaining release gates

`fixtures/partners/seed-inventory-proposal.json` is a bounded proposal, **not ingested/admitted records**. It separates DAO EIN/tax status/mailing/service geography, TechFW vs MADE, Moonshot manufacturing identity, candidate Liquid Acres alias and HackFW activity stages. Source inventory must resolve canonical IDs and exact current evidence before admission. No private scout delta or private member fields were copied.

Before release: real disposable PostgreSQL concurrency/schema/role tests; exact deployed Helix version and writer/durability/failover qualification; authorized website/meeting ID/source inventory; host service bindings; backfill/generation-switch reconciliation; representative 10,000-entity/100,000-assertion p95 measurement; and full opportunity query → research → durable delta → graph reuse rehearsal. Target p95<1s top20 and <60s projection are acceptance targets, not measured promises. Optional vector recall and broad990 enrichment remain out of scope.
