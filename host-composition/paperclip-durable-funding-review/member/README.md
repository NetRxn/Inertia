# Source-only member ingress and native attempt fencing

Default-disabled engineering composition, not a deployed service or enrollment. Independent security qualification remains open; this bundle is not approved for activation.
This reuses Inertia's candidate-only boundary, native issue/checkout authority,
native JWT signing and the existing plugin `bridge_runtime` table. It adds no
scheduler, provider control plane, secret store, credential grant or completion
writer. Private provider implementation is not included.

## Exact qualified scope

Baseline Inertia develop `89f88e8463e70426d3dd7fff85c5e88d7bebfeb6`; official
Paperclip 2026.1012.0 build `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`.
`patches/pins.json` records original/candidate SHA-256 for ten public native
files and the patch digest. The local bootstrap refuses unknown/mixed source or
version/build drift before applying anything and verifies the final candidate.
No root dependency or native schema migration is added.

Qualified: the native legacy `process` adapter, one owning native host process,
actual native heartbeat/JWT/auth middleware and checkout route, real disposable
PostgreSQL, synthetic enrolled humans/agents/tasks, and a real synthetic Node
process invoking bounded HTTP. Other adapters supporting local native JWTs must
be separately qualified. Native-runtime runner credentials, arbitrary replica
routing, real provider execution/isolation and live membership/enrollment are
not qualified. `fullHttp:false` in the rehearsal receipt still means that the
entire stock Paperclip app/UI was not launched; the HTTP lane uses real native
middleware/routes in a disposable Express host. The optional full-app mount
preserves native hostname, cloud identity and warm-standby gates, but requires
full-host qualification before activation.

## Runtime HTTP contract

`createContributionIngress` is exported from `src/contributions/ingress.ts`.
Mount it under `/api/member-contributions` before any generic body parser:

- POST `/export`: exactly `{ "issueId": "approved issue" }`.
- POST `/submit`: exactly `{ "binding": <unchanged exported binding>, "artifacts": [...] }`.
- No query strings, aliases, trailing slash, member retrieval or journal API.
- JSON UTF-8 only, no content encoding, duplicate sensitive-header rejection,
  1 MiB raw-byte ceiling before parsing and a 10-second total body deadline.
  This ceiling permits JSON escape expansion; PR37's tighter artifact limits
  still apply. Invalid/pre-parsed/truncated bodies fail closed.
- Disabled/missing ingress dependencies return 503 before body/auth/source/
  native/journal access. The enabled gate is rechecked across awaits.
- Authentication independently supplies the actor. Identity/epoch-like request
  fields cannot become authority. Inline artifacts remain inert and untrusted.
- Identical candidate retries converge, changed evidence conflicts, lost writes
  reconcile, and an unknown storage outcome is never success. A candidate receipt
  is not review dispatch, display, acceptance or completion.

## Native attempt authority

`createMemberAttemptAuthority({ db, scopes })` takes only server-approved exact
company/project/issue/agent/member scopes. Repository access is not enrollment.
It exposes `begin`, `assertCurrent`, conditional `finish`, `readCurrent`, and
native request/claims authentication. These methods are trusted host ports, never
member endpoints. There is one mutable fencing record per company/issue in
`inertia:member-attempt:v1`; this is not a parallel task ledger.

The opt-in native heartbeat construction hook issues a fresh random epoch before
JWT creation and checks it again immediately before actual adapter dispatch.
The existing JWT helper signs that epoch as `jti` and adds the explicit
`inertia_member_attempt: true` marker. No member secret or reusable generation
can select the epoch. The record binds native run, member/agent/company/task,
optional actual native environment lease and the native process boot UUID.
Current native controller ownership/expiry, cancellation, assignment, membership
and run state are checked in PostgreSQL. Viewer membership is not admitted.

Native execution ownership may precede checkout. Begin/pre-dispatch therefore
allow an assigned todo task only when its exact native execution run is current
and no other checkout is held. They do not acquire/adopt work. The signed attempt
can call the existing native checkout route. Input/submission authentication and
PR37 still require exact in-progress run AND checkout. The approved enrollment
source must establish the post-checkout conservative task revision; the authority
does not silently rewrite it or weaken revision checks.

The native authentication patch only changes explicitly marked attempt tokens:

- Every marked token requires the configured current-record validator; a host
  without that validator denies it, rather than treating it as an ordinary JWT.
- It can POST only the exact member export/submit routes and its exact native
  issue checkout route. Other task/company/admin/read routes, encoded paths,
  queries, trailing aliases and other methods are denied before handlers.
- The marked-token pre-parser path first runs native hostname, cloud identity and
  warm-standby gates, then actual native authentication, before global JSON
  parsing. Unmarked requests keep their original host path. A decoded marker is
  only a routing hint, never authority; marked requests do not take ordinary
  public-ingress authentication early returns.
- Marked checkout additionally holds the current epoch in the same native transaction as existing issueService(tx).checkout, with local lock/statement bounds and rollback on failure. Marked checkout takes the fencing record exclusively and locks native issue then run in update mode before invoking the native service, avoiding competing shared-lock upgrades. Other authority reads use the same issue-then-run order. Begin retains its record-first fencing order. Marked callers cannot reopen a closed workspace, do not use stale-adoption authority, receive only a bounded checked-out receipt, and get generic checkout failures rather than raw issue/error details.
- Old/absent epochs cannot gain a newer current epoch. A superseded marked token
  cannot use ordinary native checkout, including same-run supersession.
- Unmarked native agents retain their original authentication and permissions.

The existing native boot UUID and renewable controller lease fence process
restart/reconstruction. A new invocation gets a fresh epoch even if provider
state resumes X→Y→X. Concurrent supersession has one current epoch; a loser can
fail setup rather than receive an obsolete token. A lost begin response reads
back the same immutable invocation without repeating its write. An old finish
cannot retire its successor. Unknown database/ownership state fails closed.

## Source composition, not activation

All components must resolve the SAME native installation/process boot identity.
The bootstrap's default target is this bundle's own local native dependency.
The cloud rehearsal copies the public member source next to its owning local
native installation. Do not mix authority from one native package installation
with heartbeat/auth from another, or route requests to arbitrary owner replicas.

An admitted host would explicitly construct the authority, pass it as
`memberAttemptAuthority` to the opted-in `heartbeatService`, and use the same
object for `createNativeMemberAuthenticator`. `createApp` has optional
`memberAttemptAuthority` and `memberContributionIngress` construction ports; the
latter is the bounded Node handler wrapped as an Express request handler. The
worker/manifest does not register or enable these ports. Keep the ingress enabled
gate false until the separate admission/qualification gates below pass. Merely
patching local qualification dependencies does not activate a production route.

Trusted enrollment remains an external owning-source responsibility: approved
curated input, exact revision/expiry and current lifecycle/provider evidence.
`readCurrent(actor, issueId)` must be checked while constructing enrollment and
again by the existing boundary across awaits. A native active lease row is not
proof that a remote provider still owns its generation. Do not infer provider
truth from successful sync, a run label, an earlier receipt or a provider handle.
Provider unknown/lost/fenced/superseded still deny. The fixture provider evidence
is explicitly synthetic.

## Reproduction

Prepare the existing locked root, native host and PG dependencies as documented
in `scripts/cloud-rehearsal/README.md`, including the PG hydration helper. Use a
writable npm cache on a restricted executor. Then, from repository root:

    npm run build
    node host-composition/paperclip-durable-funding-review/member/bootstrap.mjs \
      scripts/cloud-rehearsal/host/node_modules/@paperclipai/server
    npm test
    npm run typecheck
    npm run build
    node --test scripts/test/*.test.mjs
    npm run test:package
    node scripts/cloud-rehearsal/run.mjs

For a focused ordinary ordering/concurrency regression lane without public-route
or adversarial HTTP probes, use `node scripts/cloud-rehearsal/run.mjs --member-functional`.
This verifies two valid native checkouts, authority/native clearing lock order,
and actual stock-app middleware registration, with native worker/app teardown.
It is not an independent security verdict or full-host HTTP qualification.

The bootstrap changes only that explicitly selected local qualification
installation. The launcher creates and cleans a fresh private loopback/SCRAM
PostgreSQL cluster and refuses external database overrides. It does not deploy
anything or enroll a real user. Preserve final passing receipts and source/
lock/patch hashes; expected cancellation refusal logs are adversarial successes,
not a provider success claim.

## Remaining gates

Real current membership/enrollment administration, actual provider lifecycle
readback and isolation, cancellation/connection-loss qualification on the chosen
runtime, exact host owner routing, full-app security/HTTP qualification and
explicit activation remain required. Sequential reauthorization is not a
linearizable input-release/revocation transaction. Native human review/display
and atomic authoritative completion are separate: reauthorize display and fence
all current bindings/artifact digest/operation identity in an owning native
transaction. Generic privileged issue.update is not that primitive. No second
member live demonstration or R-C05 follow-up creation is claimed here.
