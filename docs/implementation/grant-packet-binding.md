# Grant packet binding implementation

The packet core is implemented; the [native-first human-decision/domain adapter](../development/native-grant-workflow.md) is planned. Paperclip tasks/documents/cards are the default review UI; funding persistence and validation remain authoritative. The funding web UI is optional specialist/admin fallback.

## Contract audit

Read-only source inspected: NetRxn/DFW-Gov-Fund at `859a9f5a7b88bbbdd6eda3cb9c453fb15184a045`, supervised beta 3.4.0. Contracts: `government-funding-dfw/src/dfw_incentives/{models.py,api.py,packet_handoff.py,opportunity_manifests.py,agents/drafting.py}`.

The engine owns acquisition, intake, eligibility, drafting, artifact integrity, and human signoffs. `ApplicationPacket` contains `id`, `applicant_id`, opportunity identity, `version`, `status`, `packet_data`; `ApplicationArtifact` contains `packet_id`, `artifact_key`, `content_hash`, and placeholders. `artifacts.json` uses DraftArtifact `key`, not database `artifact_key`. This adapter consumes database-export field names, not that differently shaped manifest. Required packet artifacts include Markdown, DOCX, packet_data and review. Source deadline is `close_date` (date precision), not an invented timestamp.

`GET /applicants/{slug}/application-packets` omits packet_data. `ReviewedGrantSource` therefore needs a trusted domain adapter composing engine-owned packet/artifact records, authoritative lifecycle, summarize_packet_handoff result and current opportunity in one consistent read, plus verified bytes. Its `ReviewedGrantExport` type is a data contract, not a mandatory separate-UI export or an existing HTTP response. Native human decisions reach domain services through the planned authenticated adapter; current MCP lacks acceptance/signoff.

The shipped Inertia freeze/vote core accepts only `direct_application` with `authorize_manual_submission` and all five role checks. Other route rules remain funding-domain/planned-adapter behavior, not added core support.

## Implemented core and acceptance

1. Define a typed read-only source port and preserve complete JSON packet and handoff record.
2. Fail closed on unavailable/stale/currentness or engine review blockers. Verify artifact bytes against source hashes. Canonicalize sorted JSON keys (arrays remain ordered) under the domain-separated inertia-grant-v1 contract. Freeze identity, version, packet content, artifacts and review together; observation time is not part of content identity.
3. Inject a provider verification port for exact network, proposal, action and packet hash; require finality and passed outcome. Re-read current engine state before evaluating authority. Reject conflicting prior evidence and return stable idempotent receipts.
4. Run fixture-only demo and negative tests before any live provider integration. Fixture results are always labeled as simulations. Grant submission remains a separately authorized human handoff.

Acceptance tests cover content/version/review changes, wrong proposal/network/action, unfinalized/rejected votes, conflict/replay, missing signoffs, unknown eligibility, expired/currentness/source freshness, invalid artifact hashes and mutation, unsupported JSON, unknown deadlines, and fixture-versus-chain labeling.

## Deployment handoff

Run `npm run build && node dist/src/grants/demo.js`. The demo uses synthetic I/O. Pending adapters: trusted domain reads, native human-decision application and governance verification; the verifier owns chain-specific proofs, eligible voter/result rules, reorganization policy and finality. The core accepts only evidence from that injected verifier, never a member-supplied verified boolean. The evaluator returns evidence only. Native receipt acceptance remains pending; coordinate it with guarded domain state and durable reconciliation, not an assumed transaction across Paperclip and funding persistence. The host must serialize acceptance with the source revision and revalidate at the eventual manual handoff. A vote cannot replace the engine's reviews or authorized representative.

Review hardening: policy dates, verifier kind/function, source methods and prior receipt are captured before the first asynchronous read. ISO timestamps validate calendar dates and time/offset ranges, preserving engine microsecond precision; impossible dates cannot normalize into accepted review evidence.

## Public organizational draft evidence

Use the [source-pinned public DAO grounding reference](public-dao-grant-grounding.md) for attributed draft identity and mission material while primary documents are pending. It labels self-published claims and unresolved governance. Primary legal/tax evidence and existing review/eligibility gates still apply.

Native decision references must enter domain review provenance consistently before vote creation; the current freeze includes reviews in its canonical payload. Changed reviews need a new snapshot/vote. This documentation revision does not change the runtime schema or implement the adapter.
