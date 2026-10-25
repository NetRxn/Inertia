# Read-only member funding catalog: source handoff

This is an optional **owning-host source extension**, not a plugin SDK read API
or a deployed member adapter. It does not change `apps/member`, grants, native
authentication, the Packet action route, persistence, or runtime configuration.

## Available source interface

After explicit trusted host composition, the existing member mount serves:

```
GET /api/member-packet-actions/companies/:companyId/funding/opportunities?limit=50&cursor=...
GET /api/member-packet-actions/companies/:companyId/funding/applications
```

The catalog requires a current native authenticated human, active company and
active user membership. Native company access is reused; Viewer reads are valid.
No `issue:mutate`, packet-action policy, review permission or action retention
port is required to read already-published catalog metadata. The trusted owner
selects one existing company database and source allowlist; the browser cannot
select a database, source scope, user, applicant, role or action.

Applications return `503 {"error":"application_reads_unavailable"}` in this
slice. No current general application-read binding has been established. Do not
interpret that as an authorized empty list, query private packets as fallback,
or infer application visibility from public opportunity visibility. A later
application projection must reuse current native issue read **and** the owning
source's actual application audience; it must not require action permission just
to show a legitimately readable summary.

## Catalog wire and adapter mapping

`src/member-funding/contracts.ts` exports `FundingOpportunityPage`,
`FundingOpportunity`, `parseFundingPageRequest` and `parseFundingOpportunityPage`.

```json
{
  "schema": "inertia.member-funding-opportunities.v1",
  "opportunities": [{
    "id": "synthetic-opportunity",
    "sponsor": null,
    "program": "Synthetic public opportunity",
    "route": null,
    "summary": null,
    "deadline": "2026-11-20",
    "benefit": null,
    "effort": null,
    "nextStep": null,
    "sourceUrl": "https://example.org/fund",
    "observedAt": "2026-10-25T12:00:00Z",
    "initiativeId": null
  }],
  "nextCursor": null
}
```

- `id` is the existing published opportunity identity; `program` is its title.
- Sponsor/summary are nullable, scope-checked published program metadata only.
- Date-only deadlines stay `YYYY-MM-DD`. Rolling/unknown deadlines stay null;
  no guessed midnight, cutoff or timezone. The codec also represents an exact
  zoned instant if a separately qualified source actually supplies one.
- `observedAt` is a current source observation, never adapter `now` or a generic
  row update timestamp. Source URL is the allowlisted public primary URL, not an
  artifact/packet URL or an arbitrary research citation.
- The initial catalog has **no applicant-specific assessment**: `route`, benefit,
  effort, next step and native initiative mapping remain null. Rolling,
  evergreen, restricted access and in-kind terms do not imply `standing-benefit`.
  Route enum support in a DTO does not mean a source has established that route.
- The current published open-call subset recomputes current-cycle/availability
  and active-source guards. It is not a complete all-status discovery feed.
- All keys are allowlisted; private extras, invalid dates/URLs, duplicate IDs,
  nonadvancing cursors and oversized replies fail closed. There are no private
  total counts. An empty bounded scan may still have `nextCursor`; stop only at
  null. Member adapters should cap total pages/time rather than drain indefinitely.

`limit` is 1–100 (default 50), with stable existing-ID keyset pagination. Each
source scan inspects at most 500 canonical rows and emits at most 256 KiB. These
are row/result bounds, not a pre-materialization SQL-driver memory bound: stored
text columns are read before field validation. The process deadline/output cap
is a separate transport bound. Large valid metadata can require a smaller page. GET bodies, encoded bodies, other
methods, duplicate controls and extra query fields are rejected. Replies/errors
are `no-store`; failures do not expose source diagnostics.

## Trusted composition, no activation

`src/member-funding/stdio.ts::createMemberFundingReadBridge` reuses the existing
bounded pinned process protocol (`dfw-member-funding-read-v1`, operation
`opportunities`). Its only callback is fresh `{company_id,user_id}` native read
context. There is no producer/reviewer identity and no review/write callback.
Use administrator-pinned executable, package/entrypoint and configuration files;
the configuration and database locations never enter browser or tool arguments.
The bridge caps its process deadline at 5 seconds and output at 512 KiB.

`host-composition/paperclip-durable-funding-review/transport/native/member-funding-read.mjs`
exports `createMemberFundingReadRouter({enabled,db,companyId,contracts,
readOpportunities,existingMount?})`. Bind `contracts.parseRequest` to
`parseFundingPageRequest`, `contracts.parsePage` to `parseFundingOpportunityPage`,
and `readOpportunities` to the read bridge. If Packet actions are already composed,
pass their `appOptions.memberPacketActions` as `existingMount`; apply the returned
`appOptions` once. This preserves the existing route and parser under the same
native mount. With `enabled` absent/false, nothing is mounted.

The host checks current native membership before and after the bounded source
read, and on its context callbacks. Native transactions are read-only with a
statement timeout; no transaction spans the subprocess. This is not a claim of
atomic authorization across two databases. Runtime pinning, the correct company
database/source binding and the member-app-to-native authenticated identity
integration remain deployment qualification gates, not capabilities fabricated
by the projection. Do not capture one request's member in a process singleton.

## Deliberately unavailable

There is no claim, approve, submit, mark-ready or member decision mutation. There
is no application stage inferred from machine review, no conversion of native
acceptance into applied submission, and no stable exact-version Packet browser
URL. Keep application readiness unknown and `packetUrl: null` in fixtures until
their separate real contracts are qualified. A generic issue link is not an
exact-version Packet link. No new permission framework or parallel store is added.
