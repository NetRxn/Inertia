# Disposable discovery-native qualification

This profile uses official Paperclip 2026.1012.0 native services/worker and a
fresh PostgreSQL 18.1 cluster. It does not deploy, enroll a real member, use a
model/provider, activate a public source adapter, or access production data.
No packages are installed or downloaded by this runner.

## Inputs and invocation

Use the repository's already-prepared dependencies and the separate locked host
and PostgreSQL tooling documented in `../cloud-rehearsal/README.md`. The host lock
must be SHA256 `68092b1b2f601a2f84836f63962daeb2046a18df5b28442d6fbc4547e9d49e9f`;
the Linux x64 PostgreSQL binary must be SHA256
`c85fa9c977d9e641c2d22d93675a9b7097764b7df2c4c9ea021f5780522b2af2`.
The runner fails closed on mismatched tooling rather than fetching replacements.

From the DFW checkout, generate a fresh synthetic fixture using its pinned,
already-prepared Python environment:

    /path/to/python qualification/make-scoped-discovery-fixture.py --output /new/empty/fixture

Then, from the Inertia checkout:

    node node_modules/typescript/bin/tsc
    node --test scripts/test/discovery-rehearsal.test.mjs
    PAPERCLIP_QUALIFICATION_HOST_DIR=/path/to/prepared/host \
    PG_NATIVE_ROOT=/path/to/@embedded-postgres/linux-x64/native \
    DFW_DISCOVERY_FIXTURE=/new/empty/fixture/fixture.json \
      node scripts/discovery-rehearsal/run.mjs

Default tooling paths are the existing `scripts/cloud-rehearsal` preparations;
without `DFW_DISCOVERY_FIXTURE`, the runner reads `cold-fixture.json` beside itself.
Do not commit fixture SQLite data, raw captures or machine-local fixture configs.
The fixture carries exact bootstrap, DFW Python-source-tree and role-config pins.
It must be regenerated after a source change, not repaired by replacing its hashes.

The runner copies the pristine fixture into its owned disposable workspace before
admission, rebases only copied source-document storage paths, and writes new
synthetic native-project-scoped role configs. Original fixture data is not mutated.

## What the profile asserts

- Native loader/worker activation, declared migrations, disabled jobs and native
  SQL binding; native human attribution, membership refusal and checkout guards.
- A configured synthetic discovery-worker reload, including an inaccessible
  foreign company, and actual `executeTool` query-first context using scoped DFW
  subprocess configuration. Run/agent identities are synthetic authoritative rows,
  not authenticated production HTTP requests or a real agent reasoning trace.
- Native issue documents through the unmodified host. Append-only snapshots use
  complete native list/get, highest numeric sequence and lost-write-ack replay.
  Previous snapshots remain visible; this is not erasure or update-in-place.
- Controlled captured-source composition through actual DFW subprocess
  begin/read_capture/review_capture and SQLite knowledge persistence. Scout cannot
  approve its own review; official program identity is reused on a later query.
- Actual configured-worker independent source validation against an exact named
  hyperlink in a separately captured qualified page. This admits source identity
  for one capture only, not funding facts, eligibility or a recurring adapter.
- Actual native requestWakeup and persisted urgent/diligence request rows. Native
  responsible-user requirements are met by a separate synthetic active member.
  Assigned process adapters are `/bin/true`; no model/provider is configured.
- Real native PostgreSQL outbox and real Buzz HTTP client with signed Nostr event
  and HTTP-authorization validation, exact-event retry after a lost/mismatched
  acknowledgment, fresh delivery-instance dedupe and pending source revocation.
  HTTP is an in-memory transport fixture, never a real relay or human-read proof.
- Immediate PostgreSQL crash/restart preserves native document, wakeup, signed
  alert-outbox and scope fingerprints, plus the existing fenced recovery checks.

## Important limits

Fixture construction runs actual DFW capture services under controlled synthetic
HTML transport. During native composition, acquisition is an explicit replay of
that persisted capture, including the deadline-wrapped bridge seam. Actual public
search/browser acquisition, open-ended sponsor coverage, LLM reasoning, full host
HTTP/UI, PPC2 container isolation and real human receipt/read/action are not
qualified. This is not a fresh production-only dependency installation, production
activation, or a production-ready claim. Snapshot-history growth is not qualified.

The harness rejects database overrides, owns a fresh data directory and random
loopback-only port, uses SCRAM, disables background scheduling, sanitizes the
fixture password from logs, and confirms the owned process has stopped before
removal. Failed/uncertain shutdown retains the owned data and fails the receipt.
An uncatchable executor kill remains outside process-level cleanup guarantees.

Each output directory contains sanitized logs, a terminal cleanup receipt and
`artifact-hashes.json` with the exact source/runtime/scripts inventories, fixture
pins and explicit hash algorithm. Preserve those files with the source revision;
a result from an earlier source snapshot does not qualify later edits.
