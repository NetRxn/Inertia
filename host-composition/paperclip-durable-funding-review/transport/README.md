# Default-disabled review-service transport composition

This source-only qualification connects the existing native human acceptance ledger to DFW's existing durable guarded application/cancellation service. It adds no approval UI, authorization tool, task ledger, credential issuer, scheduled daemon, deployment, or grant submission.

## Concrete composition

- `native/acceptance-routes.mjs`: Express Router mounted by an owning Paperclip host at `/api/funding-review-transport`, after its real `actorMiddleware`. Exact configured board-key ID, user ID and current company membership are required. No ambient local-board/session/agent identity is accepted. GET scope/read/list routes return only exact scoped receipts. Existing native capture owns human authority.
- `dfw_incentives.review_transport` (installed from the private DFW package): FastAPI APIRouter at `/funding-review-transport`, composed with the actual durable DFW service and explicit verified transport principal mapping. ID-only apply/cancel/outcome routes; cancellation actor comes from host configuration, never request JSON. NativeReceiptReader performs the paired scope handshake, bounded authenticated authoritative read, digest and human/binding checks.
- `native/host-composition.mjs`: default-disabled trusted owning-host assembly. It supplies pre-parser bodyless framing rejection and a router after the stock hostname, cloud identity, warm-standby and native actor gates. `registerReviewTransportJob` is a trusted worker-local bootstrap function, not a JSON-configurable hook; its declaration has no schedule and rejects non-manual invocation.
- `native/reconcile.mjs`: callable bounded sweep body using the existing SDK `ctx.http.fetch`, `ctx.secrets.resolve`, and company-scoped `ctx.state`. Supply it to an already approved native job. The reconciler itself does not register or schedule anything; the optional assembly registers only an explicit manual callable. Scan cursors are per-record resumable progress only, reset after every full sweep. Stale/rejected records remain unacknowledged while independent later records progress; every full sweep retries them. Effects/deduplication/cancellation remain DFW audit transactions.

The full immutable source/destination/company/applicant/source-scope/purpose object is checked on both ends and hashed in `X-Funding-Scope`. Receipt hashes bind exact canonical JSON, not signatures or a replacement for TLS/authenticated source readback. The transport principal is not the human reviewer. Agent/event content cannot supply commands, reviewer authority, destination, or cancellation actor.

## Owning-host integration and activation gates

The installed SDK has outbound HTTP, secret references and jobs, but no generic authenticated route registration. The fingerprinted source patch adds one optional `createApp` construction capability, `fundingReviewTransport`, with an exact owning `Db`, bodyless pre-parser middleware and the existing router. It is absent by default. JSON cannot supply its required functions. The app snapshots it, verifies database ownership, rejects body framing before global parsers and mounts receipt access only after all stock hostname/cloud identity/warm-standby/actor gates. No existing gate is moved or bypassed.

Construct `createReviewTransportHost` in reviewed owning-host code with the actual capture, immutable scope and principal, approved lifecycle functions, fixed endpoint URLs and existing secret references; spread its `appOptions` into `createApp`. The server process keeps its database and read lifecycle capability. A separately reviewed worker bootstrap calls `registerReviewTransportJob(ctx, trustedWorkerComposition)` with its own local approved terminal lifecycle function. Functions/database handles are never serialized through plugin configuration or RPC. Add the returned manual declaration only to that explicitly composed manifest. Existing runtime `src/manifest.ts` and `src/worker.ts` remain unchanged: no default funding job or enable flag is added.

The native loader must already authorize the exact configured company. The manual worker requires existing `http.outbound`, `secrets.read-ref`, `plugin.state.read` and `plugin.state.write` capabilities. This bundle does not grant them or widen the packaged plugin manifest. Native `triggerJob` invokes the schedule-free declaration; a pending/incomplete reconciliation records a generic failed run that requires another explicit manual invocation. No recurring run or automatic retry is introduced.

DFW's existing `create_app` contains read/admin guards and installs API security middleware. An owning host may include this router only with an explicit credential-to-principal/company/applicant/source/destination/purpose mapping. An existing generic admin token is NOT asserted to be least privilege; this adapter does not automatically authorize it or create credentials. The authenticated principal dependency must be current on every call, including offline terminal reads. Required approvals for live keys/grants remain outstanding.

Production lifecycle policy is a required host capability, not supplied here. Native reads require `lifecycle.assertReadable({scope,receipt})` to return true after verifying the already-approved storage contract. Reconciliation calls idempotent `lifecycle.acknowledgeTerminal({scope,receipt,receiptDigest,outcome})` only for exact authoritative applied/cancelled readback; throw to refuse acknowledgement. That capability owns any approved archive/deletion behavior and receipt handoff. Tests record the acknowledgement only; they do not delete or archive records. There is no indefinite company-deletion lock, no new retention policy, and no claim that a terminal acknowledgement alone approves deletion.

The native capture's root-Db transaction, retention contract and exact command registrations must already be qualified. DFW's immutable inputs, current funding gates, PostgreSQL legacy-writer fence and cancellation actor authorization remain mandatory. Source identity-to-origin and destination identity-to-database mappings must remain immutable; changing either requires explicit reviewed migration, not reusing an old source/destination label.

No production mount, credentials, recurring schedule, real tenant/data transfer, human UI walkthrough or archive policy activation is performed.

## HTTP bounds and deployment constraints

Production endpoints require HTTPS, fixed exact mounts, no userinfo/query/fragment and no redirects. Numeric-loopback plaintext is available only through explicit fixture flags. The DFW reader streams a maximum of 1 MiB with time bounds and rejects compression, malformed JSON and duplicate keys. Native responses and reconciliation parsing enforce a 1 MiB protocol limit; native pages cap at 500 and are byte-bounded with correct continuation. An individually oversized record is explicitly deferred, never acknowledged, and cannot starve later records.

The optional owning-host capability applies trusted limits to `netrxn.inertia` host services only: an 8 KiB request budget, 8 KiB native response-header parser cap, 1 MiB raw response body, and 15-second absolute DNS-plus-socket deadline. These are plugin-wide outbound limits while this composition is explicitly enabled, so other enabled uses of that plugin must be qualified under them. Other plugins and default-disabled hosts keep the stock HTTP budgets. The original one-resolution IP pinning, private-target denial, single-request/no-follow redirects and TLS verification remain unchanged. Private-only connectivity still needs a supported owning-host route, never a direct-fetch bypass.

Request metadata is capped by the reconciler before calling the SDK, including endpoint/credential component caps before JSON measurement. The actual host rejects excess metadata/declared length before DNS/socket work. Response declared length/compression are rejected before collection. The opted-in collector uses fixed bounded storage, aborts overflow/deadline and releases it on completion/failure before RPC; invalid UTF-8 is rejected instead of expanded. JSON-RPC escaping adds a bounded expansion, so this is a 1 MiB raw-body limit, not a claim of a 1 MiB total RPC message or total process memory. The SDK still omits AbortSignal; the host deadline is the actual socket/DNS enforcement.

Source allocation remains a distinct gate: capture reads full activity rows before validation; trusted binding strings/arrays have no per-row byte maximum. The 4,000-character reason and 500-row page limits do not establish a source-memory byte bound. Smaller pages alone cannot close that gate. Byte paging/defer semantics remain unchanged and no database/archive policy is invented.

Each invocation permits at most six HTTP requests, including scope handshakes and reserved uncertain-result readback, for at most 90 seconds of opted-in host HTTP time. Company-scoped native state checkpoints each processed/deferred ID. Exhaustion uses existing `ctx.state.delete` (same write capability); get/set-only adapters use a tiny JSON reset marker instead of invalid SQL NULL. Legacy UUID cursors and malformed/unknown state remain conservatively readable as before, and complete sweeps restart from the beginning.

The native scheduler retains its five-minute timeout. The disposable spawned-worker qualification includes actual capture and PostgreSQL state, lost-response readback, delayed synthetic secret/state/HTTP/lifecycle operations and terminal-only acknowledgement. That finite fixture is not a bound on arbitrary production lifecycle callbacks or a production latency SLA. Qualify approved callbacks and secret/state responsiveness before activation; no uncancelled timeout race is wrapped around an archival operation.

All errors emitted by these adapters are generic; no raw remote exception, secret, authorization header or receipt payload is logged. Credentials are resolved at request time and never persisted by this code. SDK/native/global access logs still require operator redaction review before activation.

## Qualification

Set `REVIEW_NATIVE_ROOT` to the verified bootstrapped durable native bundle (public Paperclip 2026.1012.0 baseline). A local `node_modules` link is only a qualification convenience, not a publication dependency. Run native tests under that bundle's hardened disposable PostgreSQL launcher. Run Python tests with current DFW `src` and `tests` on PYTHONPATH and its locked Python 3.14 environment. Cross-domain script requires `REVIEW_PYTHON` and `REVIEW_DFW_PROJECT`; it uses only disposable synthetic loopback databases/keys and removes its fixture files.

Packaged runtime registration is unchanged; the optional owning-host assembly is source-only and default-disabled. This public transport subtree contains no DFW domain implementation; use the separately reviewed private DFW adapter and fixture helper. Parent owns current-base verification, final review and Git/public artifact publication. See `evidence/` and the final handoff for exact passed/failed/never-run checks.

Run the portable native checks from the bootstrapped parent bundle with `bash transport/tests/run-native.sh`. For the real cross-HTTP rehearsal, set REVIEW_PYTHON to the private DFW locked environment and REVIEW_DFW_PROJECT to its reviewed project root, then run `bash transport/tests/run-cross-domain.sh`. The private project must contain the separately published `dfw_incentives.review_transport` module and `tests/dfw_transport_fixture.py`.


## Resource qualification scope

`bash transport/tests/run-native.sh` now runs actual owning-app/auth/ingress fixtures, actual spawned SDK/manual scheduler/native-state fixtures, the existing native receipt route and reconciler regressions, and pinned host HTTP/RPC resource tests. Only the OS DNS/socket edge of resource cases is synthetic; no external/private target is contacted. Manual-job domain HTTP replies and credentials are disposable fixture values, not live integration. Existing cross-domain HTTP scripts remain functional rehearsals using their established transport, not a claim that the two qualifications are a production deployment.

## Separate all-PostgreSQL functional lane

The existing `run-cross-domain.sh` remains the native-PostgreSQL → funding-SQLite
lane. The additive `run-cross-domain-postgres.sh` asks the installed private owning
project to start its own disposable PostgreSQL/PostGIS fixture, then runs the native
domain in a separate fingerprint-qualified PostgreSQL cluster. Supply only explicit
reviewed fixture roots, never an external database URL:

    REVIEW_PYTHON=/absolute/private-project/.venv/bin/python \
    REVIEW_DFW_PROJECT=/absolute/private-project \
    PG_FIXTURE_ROOT=/absolute/private-postgres-preparation/root \
    QUALIFICATION_OUTPUT=/absolute/private-receipts \
    bash transport/tests/run-cross-domain-postgres.sh

The private project owns its fixture implementation and generated connection handoff;
none of that implementation is copied here. The native rehearsal captures one in-scope acceptance plus two filtered other-applicant
acceptances per scenario, exercises one-record pages and current-key revocation, and
checks proposal application, packet-role application and cancellation-first over HTTP.
It also exercises committed-response loss/readback and concurrent duplicate delivery.
Each reconciliation invocation still has at most six requests. Later native role and
document changes do not rewrite the accepted instruction.

Receipts identify both actual database dialects. This remains an injected-standard-fetch
functional rehearsal, not qualification of the actual SDK HTTP/RPC resource boundary.
The explicit disposable writer fence is not a production writer/grant policy. Approved
production writer inventory/fencing, lifecycle/retention, scheduling and a real authenticated
human walkthrough remain activation gates. No deployment, scheduler or live grant is added.

### Optional whole-packet acceptance

A protected native review scope may opt into `wholePacketReview: true`. Its private producer and reviewer configurations must both opt into `whole_packet_review: true`; the reviewer requires the existing exact `preparation` mapping. This source change applies none of these settings. Existing scopes keep their candidate-only contract.

In the optional mode, the existing review artifact schema accepts section or packet artifacts, while acceptance requires a current complete-packet receipt. A supported section is returned through the existing native attention lifecycle so the real Alpha continuation can regenerate/register the full packet. Beta then receives complete JSON/Markdown/DOCX/review bytes and the exact source-run manifest. Acceptance checks the independent current reviewer, card, decision, source run, packet/version and manifest under the held private PostgreSQL/file fence. Missing, oversized, corrupted, stale or candidate-only evidence fails closed. The private DFW contract is documented in `docs/NATIVE_WHOLE_PACKET_REVIEW.md` in that repository. No scheduler, broad document access, hosted search, shell/network access, credentials or live policy changes are introduced by this acceptance mode.
