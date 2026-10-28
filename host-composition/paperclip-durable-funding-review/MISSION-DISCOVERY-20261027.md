# Native public funding discovery — source qualification, 2026-10-27

The optional `native-discovery-profile` overlay adds task-specific discovery and
independent diligence to the existing native funding authority. It creates no
grants, tasks, credentials, schedules or enabled configuration. Existing drafting
and attention-review catalogs remain on their existing paths. Installation and
source qualification are not deployed web access or business acceptance.

## Pinned composition

Paperclip `2026.1012.0`, upstream
`bba6a45f0d364cfd962ac59b3bdf2426a8222adb`, with the existing Inertia native funding,
reviewer-catalog and domain-review overlays. The new installer verifies exact
base/candidate hashes plus unchanged managed-auth, funding-policy and command
sandbox guards. Drift, partial installation and symlinked parents fail closed.
The overlay is optional and does not run from bootstrap.

## Behavior and authority

Fresh `fundingDiscovery` configuration selects the catalog only when the current
native issue, project, agent, principal mapping, running run, ownership and finite
`nativeFunding` policy agree. A session pins the discovery fingerprint; changed
configuration revokes it. Catalog reads and calls intersect the existing session
assignment with fresh gateway decisions. Every execution still uses the real
native gateway and its permissions, approvals and audit ledger.

| Current task/actor | Exact plugin tools |
| --- | --- |
| Configured scout / producer | `funding-discovery-context`, `funding-discovery-submit` |
| Configured independent diligence / reviewer | `funding-diligence-context`, `funding-diligence-submit`, `funding-source-validation-submit`, `funding-facts-submit`; native `list_documents`, `read_document` for current-task public capture work only |
| Existing drafting task | Existing four drafting tools |
| Existing native attention reviewer | Existing native review catalog |

All plugin tool names retain the `netrxn.inertia:` namespace and existing stable
assigned-MCP projection. The discovery/diligence path does not set `fundingProducer`
and does not inherit drafting preapproval. Actual gateway policy and grants remain
required. Removing one grant while a separate allow policy still authorizes the
same tool is not complete permission revocation.

A trusted scout projection supplies only configured public query facets, a bounded
public routing key and native completion identifiers. It replaces private initial
instructions and turn prose, withholds skills/connection runtime context and writes
`web_search = "live"` before `[features]` in the fresh isolated Codex home. Normal
sessions do not receive that setting. Shell execution and command-network access
remain disabled. Private task descriptions, criterion wording, responses, history,
workspace references and server instructions are not copied into this projection.

The scout requires a fresh empty execution workspace without ancestor AGENTS files
and a routing key matching `public-[a-z0-9-]{1,100}`. Resume, steer and retained-runner
recovery are refused pending separate public-context continuity qualification. The
first-statement `#resume()` guard also covers internal `thread/read` and adoption
paths. A dedicated discovery completion contract is required by the owning task
composition; a scout result must not be treated as completion of the wider mission.

Hosted search is a Codex built-in, outside the assigned-tool gateway. Public-only
provider context prevents access to private mission prose; the public-query
instruction is not a hard query-string firewall. Owners must keep configured
facets public and preserve the host's scoped public evidence projection.

## Supported web capability

An exact Codex `0.156.1` Darwin ARM64 offline app-server probe observed:

| Mode | Advertised hosted search | External web access |
| --- | --- | --- |
| Default/unset | yes | false |
| disabled | no | — |
| cached | yes | false |
| live | yes | true |

All four modes had no command tools and command-network permission false. Receipt:
`evidence/native-web-capability-20261027.json`. The earlier command-tool fixture
explicitly disabled search and cannot establish a production agent's web setting.
Pinned primary contracts:
[Codex mode resolution](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/core/src/config/mod.rs),
[provider capability bounds](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/model-provider/src/provider.rs),
and [Paperclip provider materialization](https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/packages/paperclip-runner/runner/crates/runner-core/src/codex_provider.rs).

## Focused qualification

The installed-source fixture uses immutable Linux ARM64 image
`sha256:7dfcc8c7b63d0dd2ea7021a5677e66a239bb7e1d53b92598233be366fa5710e1`,
nonroot uid1000, no network, no credentials or live mounts, read-only root and
bounded disposable scratch. Scratch `/tmp` is executable solely for the trusted
deterministic fake app-server. It uses the image's real embedded PostgreSQL,
actual native SQL schema/services, actual gateway/dispatcher and native runner.

- 5 installer integrity/idempotence checks.
- 17 policy, current-task, role, gateway intersection, projection, materializer and
  recovery-entry checks.
- 8 existing funding policy/provider/parser/security regressions.
- 7 native integration checks: scout and diligence catalogs plus persisted native
  invocations; unchanged drafting selection; stale config/ownership/role rejection;
  permission revocation; actual executor assignment-construction seam; and real
  native runner public instruction/turn/materializer delivery against a fake
  app-server, including resume/steer denial.

The executor seam stubs only empty-workspace validation and never launches a
provider. The separate runner test exercises real PRP/runner delivery with a
locally scripted app-server, not real Codex inference or search. Plugin worker
responses in SQL tests are synthetic; persisted invocation receipts are not DFW
source captures. Native integration coverage does not prove a complete discovery
business cycle, native attention-review lifecycle or real-provider entitlement.

Run `tests/qualification/native-discovery/run.mjs` only in the described disposable
fixture with read-only source at `/qual/source`, exact baseline files at
`/qual/baseline` and scratch `/work`. Local narrow tests accept
`NATIVE_DISCOVERY_CANDIDATE` / `NATIVE_DISCOVERY_BASE`; no download/login happens in
the tests. Preserve actual test counts and artifact hashes in the evidence receipt.

## Existing discovery-to-ranking path and runtime handoff

`funding-discovery-context` queries saved public knowledge before research.
`funding-discovery-submit` accepts URLs, never source facts or authority. Trusted
DFW `ScopedDiscoveryBridge.inspect` independently captures HTTPS and uses existing
repository source-record/project operations. Unknown origins remain B2 source
candidates. Independent identity review and exact-span funding facts admit only
their defined claims; eligibility, fit and current-cycle gaps remain explicit.

After ordinary canonical opportunity enrichment/publication admission, existing
`ProfileCycleRunner` → `Phase2Orchestrator` → `OpportunityManifestLoader` →
`MatchingAgent` → `Phase2Repository` performs matching/ranking, persistence and
packets. Native cycle selection retains exact source scope and rejects B2,
unpublished, inactive or non-`agent_ready` opportunities. Captured leads and
conditional knowledge alone do not satisfy the mission or B01.

The owning runtime must still configure exact tasks, public facets, finite policy
scope, DFW organization/principal/process pins, independent reviewer policy and
necessary gateway permissions, then qualify its combined image before a real
public-source run. No identities/process policies are guessed here. Real hosted
web-use evidence, source URLs/retrieval dates, native ownership, DFW persistence
and readback must be recorded separately, distinguishing capture from admission,
matching and ranking. This source lane performs no live rollout or provider call.

## Diligence capture handoff correction

The first overlay omitted the native reads needed to discover the existing host's
immutable `funding-diligence-work-*` snapshots. The correction adds only
`list_documents` and `read_document` to admitted independent diligence runs.
The tool descriptions instruct Beta to list, read the returned key, then use the
returned `binding` and each `captureId` with `funding-diligence-context`.
No task-description edit, manual wake payload, extra grant or new queue is needed.

Both reads use the existing native document service after fresh current actor,
run, task, configuration and assigned business-tool permission checks. They
reject all task overrides, and expose only matching-binding work
snapshots whose key derives from their capture IDs. Returned bodies contain
only binding, capture IDs, source hashes, HTTPS source URLs and static guidance.
Saved instruction text, arbitrary documents, task descriptions and document
author metadata are withheld. Scout and existing drafting/review scopes remain
unchanged. These two native reads do not require plugin tool grants.

The regression first failed on the missing catalog entry, then passed using real
native PostgreSQL and the production immutable document writer. It persists a
synthetic capture reference on the independently assigned reviewer task, reads
it through actual authority, and submits its binding/capture ID through the real
gateway/dispatcher. Private documents, wrong bindings, another task's key, task
overrides, changed ownership and revoked permissions are denied. This is an
actual persisted reference fixture, not a real DFW capture or hosted search.

The corrected overlay replaces the prior pinned overlay in a fresh qualified
image build. Its installer deliberately refuses an in-place old/partial overlay.
Runtime deployment, policy admission and a real public-source capture/diligence
run remain the runtime owner's work. Named-program source identity, canonical
admission and Phase2 ranking are unchanged downstream prerequisites.

Matching keys and JSON shape do not establish document authorship or capture
validity. These are untrusted routing references, including when a same-task
writer supplies a matching document. Existing `funding-diligence-context` and
DFW exact-capture validation remain authoritative; reads confer no admission,
source identity, approval or claim of public-source truth.
