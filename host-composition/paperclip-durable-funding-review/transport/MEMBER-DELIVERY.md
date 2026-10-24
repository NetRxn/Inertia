# Disabled member-packet delivery composition

This additive v2 source slice connects the existing immutable native review and submission producers to an owning member domain adapter. Importing or constructing it without `enabled: true` creates no routes, requests, jobs, grants or effects. It is not a production membership designation, deployment, provider submission, cancellation or retention-policy installation.

## Exact supported bootstrap order

1. Install the already qualified native bundle and run its existing bootstrap. Keep its original patch and pins unchanged.
2. If using the frozen Task2 action/UI candidate, complete that candidate's original bootstrap first. Do not apply this overlay and then run an older bootstrap against the changed app files.
3. Run `node scripts/apply-member-transport.mjs`. It accepts only the exact merged member-capture app pair or the frozen Task2 `37ad334` app pair and verifies both resulting hashes. Unknown, mixed and partial inputs fail before writes. Running this overlay again is idempotent.

The two exact source variants are a temporary compatibility seam, not a permanent version policy. Requalify on upstream changes. The overlay adds `memberPacketTransport` before-body-parser and authenticated route mounts, its type, and `(reviewTransport || memberTransport)` for the existing Inertia SDK resource limits. It does not replace the v1 mounts or change Task2's action router/client.

## Native host

`createMemberPacketSource` takes a trusted root native database, exact full transport scope, the existing fixed member codecs, and explicitly registered native review/action bindings. It uses one PostgreSQL query ordered by the stored activity `(created_at, id)` keyset over `member.packet.review.accepted` and `member.packet.action.accepted`, independently decodes their existing stored schemas, and checks full policy scope, original human and responsible-user provenance, immutable intent hash and original producer correlation. Existing malformed candidate IDs are unavailable/deferred, not false missing acceptances. Task2's prior-request existence and collision logic is untouched.

Each selected activity projection is at most 32KiB; pages contain at most 32 candidates. Pages carry `{cursor: {createdAt, id}, envelope, ambiguous}` entries. The cursor preserves the stored timestamp at microsecond precision, never the caller's intent timestamp. Oversized or unprovable candidates remain explicit null-envelope entries. Valid actions sharing a stored timestamp on the same issue are marked ambiguous; a sweep stops there for reconciliation. The ID tie-break only supports pagination and is not a causal guarantee. Complete foreign scopes are excluded from both paging and ambiguity checks. The source applies a 2s statement timeout and 500ms lock timeout inside its read transaction. The JSON projection is bounded before it reaches Node, including the selected provenance metadata; these are not claims about indexing or total production database load. Limits also apply to the 1MiB HTTP response.

`createMemberPacketSourceRouter` takes that source, the exact configured native board-key transport principal and an approved `lifecycle.assertReadable` callback. Spread its `appOptions` into the owning `createApp`. The mount is `/api/member-packet-transport`, after the normal native authentication and host gates; only bodyless GET scope, page and individual source reads exist. The transport principal is never substituted for the accepted human.

## Worker and Task2 projection

`createMemberPacketDelivery(ctx, config)` uses only existing SDK HTTP, secret-reference and company-state primitives. Give it both fixed HTTPS mount URLs, exact scope/codecs and existing secret references. `readOutcome` is directly compatible with Task2's frozen callback and never applies an effect. It uses the merged strict durable outcome projection, including full scope, acceptance digest, intent hash and eventId-to-effectId matching.

`reconcile()` is an explicitly invoked bounded sweep. It performs both scope handshakes, permits at most six outer HTTP requests, reserves apply plus authoritative readback capacity, and permits only one in-flight apply per delivery instance. An uncertain/lost apply reply is read back locally by the owning domain endpoint before it is reported as applied. Missing terminal, malformed reply or access failure is pending/reconciliation, never a durable rejection or a reversal of an existing effect. Concurrent calls on the same instance return busy.

`memberDeliveryJob` and `registerMemberPacketDeliveryJob` are an optional existing native manual-job seam with no schedule; nonmanual invocations are rejected. A scan cursor and persisted unresolved-sweep flag are only progress. An unresolved valid apply stops before advancing that source, so later transitions cannot overtake it; unknown malformed or oversized sources remain explicitly pending while scanning can continue. Empty tail pages cannot turn an unresolved sweep into ready. Full sweeps restart, unresolved sources are retried, and there is no archive acknowledgement, deletion or new receipt registry. Keep original native rows and request correlation readable until separately approved archive custody exists.

The SDK's existing 8KiB serialized-request cap, 1MiB pre-buffer/RPC response cap and 15s pre-DNS network deadline are enabled by the app overlay. Every outer HTTP call resolves its existing secret again. Scope is carried in `X-Member-Packet-Scope`; the native side uses Bearer authentication, while the domain side uses its existing configured admin-token header.

## Separate production inputs and bounds

The private reader uses one read-only native acceptance GET per domain apply, with a default 5s subprocess-enforced network deadline and required kill/reap cleanup. The six outer-call budget does not count that nested source call or a future current-authority call. The source read occurs before the domain writer transaction; the domain's current-authority check and atomic effect+terminal remain its responsibility. Credential, state, lifecycle and current-authority callbacks need qualified bounded host implementations. Database lock/statement limits and writer fencing also require a qualified production composition. An outer timeout never pretends to cancel a domain transaction that might still commit.

A real original-human CURRENT membership/application/native-action authority adapter is not supplied here. The current authorization callback in the integration fixture is explicitly synthetic. Missing production designation, native policy reconstruction, configured origins/secret references, bounded authority and approved receipt/archive custody remain activation inputs, not fabricated grants. Native and private databases are not one atomic revocation transaction; a revocation after the final successful current check can race the subsequent commit.

## Disposable qualification

Run the focused source and mount tests with the existing `tests/with-disposable-pg.sh`; run delivery/outcome/resource tests with Node's test runner. `transport/tests/run-member-cross-domain-postgres.sh` delegates only to the owning private project's disposable launcher. Set the existing `REVIEW_PYTHON`, `REVIEW_DFW_PROJECT`, `PG_FIXTURE_ROOT` and `QUALIFICATION_OUTPUT` inputs. Until Task2 is merged, `MEMBER_TASK2_ROOT` may point to the exact frozen candidate checkout with its existing compiled UI contracts. Its source is consumed unchanged.

That integration uses actual native HTTP approval and Task2 submission producers, authenticated native source HTTP, the private bounded reader and real PostgreSQL/PostGIS domain persistence. It checks two complete replay sweeps, one lost successful response, exact request correlation recovery and durable local outcome reads after revoking the native transport key. Standard fetch is injected for disposable loopback requests; real SDK DNS/pinned-target/pre-buffer behavior is qualified separately by the existing resource suite. No live service, user credential, provider submission or source deletion is involved.
