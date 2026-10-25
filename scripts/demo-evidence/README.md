# Demo-evidence receipt validator

Opt-in, provider-neutral check for demo-run evidence receipts ([#54](https://github.com/NetRxn/Inertia/issues/54)), coordinated with the existing-agent rehearsal in [#48](https://github.com/NetRxn/Inertia/issues/48). It is not a runtime, telemetry service or task ledger, and it needs no credentials, network or provider access.

A valid receipt is provenance and measurement evidence only. It is not security signoff, grant acceptance, application-quality approval or live qualification. The validator checks a receipt's internal consistency. It cannot prove that the referenced run happened: actual system-produced receipts depend on run, tool and source bindings from [#45](https://github.com/NetRxn/Inertia/issues/45), [#48](https://github.com/NetRxn/Inertia/issues/48) and [#49](https://github.com/NetRxn/Inertia/issues/49).

## Run

Node.js 24.11.0+ and no dependencies.

```sh
node --test scripts/demo-evidence/validate-receipt.test.mjs
node scripts/demo-evidence/validate-receipt.mjs scripts/demo-evidence/fixtures/valid-synthetic.json
```

The command prints a JSON array with one report per file. Exit codes: `0` if every receipt is valid, `1` if any is invalid, `2` for a usage, read, size or JSON parse error. Each report has `valid`, `receiptFormat`, `evidenceClass`, `claimScope`, `qualificationClaimed`, `qualificationEligible`, `errors[]` and `warnings[]` (each `{code, path, message}`) and the fixed `nonClaims`.


**Direct API.** `validateReceipt()` returns a report for any JSON-like input and never throws. Malformed enum or reference objects (for example `{toString: null}`) are rejected with `SHAPE` errors, never raised as exceptions.

`qualificationEligible` is true only for a valid `system-produced`, `complete-application-outcome` receipt. It means the receipt is structurally ready for qualification review, not that qualification happened. Whether a run covers the #54/#48 demonstration (run, tool, source, artifact and member-event evidence, plus useful incorporated output) is tracked in those issues, not by this flag.

**Diagnostics never echo receipt content.** Messages are fixed text. Paths name schema keys and array indexes only; any other key appears as `<unrecognized>`. Report metadata (`receiptFormat`, `evidenceClass`, `claimScope`) is returned only when it is an allowed value, otherwise `null`. CLI read and parse errors are fixed messages without parser snippets or stack traces.

**Limits.** The CLI accepts at most 64 files of 1 MiB each. A receipt may nest at most 16 levels, hold at most 10,000 values and use strings of at most 4,096 characters; beyond that it is rejected with `RESOURCE_LIMIT` rather than partially checked. A report keeps at most 200 errors and 200 warnings, de-duplicated by code and path; a final `RESOURCE_LIMIT` entry marks a truncated list. The values are exported as `LIMITS`.

## Receipt format `inertia-demo-evidence/v0`

[`fixtures/valid-synthetic.json`](fixtures/valid-synthetic.json) is the sanitized sample receipt.

| Field | Meaning |
|---|---|
| `receiptFormat` | `inertia-demo-evidence/v0` |
| `receiptId` | Opaque reference |
| `evidenceClass` | `synthetic-fixture`, `historical-human-submitted` or `system-produced` |
| `claimScope` | `partial-contribution` or `complete-application-outcome` |
| `qualificationClaimed` | Boolean. Only a `system-produced` complete outcome may claim it |
| `source` | `{repo, head, tree}` with exact git object ids |
| `runs[]` | `{runRef, role: system\|collaborator, agentRef, runtimeRef, sourceHead}`. Exactly one `system` run; collaborator runs are optional, so a single-agent receipt is valid. `sourceHead` must equal `source.head` |
| `contributions[]` | `{contributionRef, runRef, bounded, invocationRefs[], artifactRefs[{artifactRef, version}]}`. Collaborator contributions are `bounded: true`. Every invocation that produced a claimed artifact must be listed in that contribution's `invocationRefs` |
| `toolInvocations[]` | `{invocationRef, runRef, tool, argumentsSha256, resultSha256, admittedSourceRefs[]}`. Digests only, never arguments or results |
| `admittedSources[]` | `{sourceRef, admissionRef, version}` |
| `artifacts[]` | `{artifactRef, version, contentSha256, origin, producedBy: {runRef, invocationRefs[]}}`. `origin` is `synthetic`, `system-produced`, `historical-human` or `manual-reference` |

Every required digest (`argumentsSha256`, `resultSha256`, `contentSha256`) must be a 64-lowercase-hex string; `null`, booleans and other types are rejected. `source.head` and `source.tree` must be git object id strings.

**One implementation build per receipt.** Every run's `sourceHead` equals `source.head`, so a v0 receipt describes runs of a single implementation build. Runs that span repositories or runtimes need a mapping agreed in #48, #45 and #49; the map that resolves those references stays protected.
| `outcome` | `{artifactRef, version}` produced by the system run. Required for a complete outcome, otherwise `null` |
| `measurements` | See below |
| `nonClaims` | Optional free text. The validator always reports its own fixed non-claims |

Historical human-submitted receipts omit `runs`, `contributions`, `toolInvocations` and `producedBy`.

**References.** Use `<prefix>:<opaque-id>` (for example `agent:…`, `ntf05:…`, `src:ntf12-…`). Run references are digests: `run:sha256:<64 hex>`. Never put raw native ids, names, emails, URLs, private source, packets, schemas, financial or member records in a receipt.

### Measurements

- `wallClock` and `activeHumanTime` are separate, each with a `boundary` saying what was measured.
  - Measured wall-clock time needs `startedAt` and `endedAt` (UTC ISO), and `seconds` must match them.
  - Measured active human time needs `seconds` and a `method` (for example `timer`, `self-report`).
- `usage[]` entries need `metric` and `unit`. Measured entries also need `value`, `source` and `coverage` (`complete` or `partial`).
- `cost[]` measured entries need `amount`, an ISO 4217 `currency`, `basis` and `coverage`.
- `usage` and `cost` each need at least one entry. If a figure is not known, record it explicitly.
- Unknown values use `status: unknown` or `not-measured` with a `reason` and no `seconds`/`value`/`amount`. Unknown is never zero.
- `totals` is `null` unless every usage and cost entry is measured with complete coverage. A total must equal the sum of its components. `totals.usage`, when present, is an array of `{metric, unit, value}`.
- `corrections` is required: a measured `count` with a `boundary` and `source`, or an explicit unknown.
- `asks` is optional (secondary measures from the [PR59 answer](https://github.com/NetRxn/Inertia/pull/59#issuecomment-6388561995)). When measured, `offered`, `accepted`, `declined`, `noResponse`, `pending`, `withdrawn` and `completed` are non-negative integers.
  - Every offered ask has exactly one state: `accepted + declined + noResponse + pending + withdrawn = offered`.
  - `completed` cannot exceed `accepted`.
  - `noResponse` is required, because silence is never counted as a rejection.
  - `withdrawn` is required ([PR61 answer](https://github.com/NetRxn/Inertia/pull/61#issuecomment-6388867070)). It counts asks ended by a native terminal withdrawal, which is neither a decline nor no response. A completed ask stays `accepted` and `completed`; a later withdrawal never erases it. The native withdrawal and the original events stay in Paperclip history; the receipt only counts them.
  - An optional `responseTime` (`statistic`: `median`, `mean` or `max`, plus `seconds` and `boundary`) times responded asks only, and needs at least one response.
- A `savings` field is always rejected.

## Error codes

| Code | Raised when |
|---|---|
| `FORMAT` | Not an object, or the wrong `receiptFormat` |
| `SHAPE` | A required field is missing or a value is outside its enum |
| `REF_FORMAT`, `DIGEST_FORMAT` | A reference, version or digest has the wrong shape |
| `DUPLICATE_REF` | The same reference is recorded twice |
| `LINK_UNRESOLVED` | A reference points at nothing in the receipt |
| `LINK_MISSING` | A contribution or artifact has no invocation or artifact |
| `LINK_MISMATCH` | A link crosses runs, or a contribution claims an artifact produced by invocations it does not list |
| `VERSION_CONFLICT` | A run head differs from `source.head`, an artifact version is not recorded, or the same artifact version has two digests |
| `CLASS_MISMATCH` | An artifact origin does not fit `evidenceClass` (for example a manual reference packet in a system-produced receipt), or historical evidence carries runs |
| `SCOPE_OVERCLAIM` | A partial contribution claims qualification, a collaborator contribution is unbounded, or a complete outcome is not produced by the system run |
| `QUALIFICATION_OVERCLAIM` | Qualification is claimed for non-system evidence |
| `UNKNOWN_COERCED` | An unknown carries a value, or a measured figure has no coverage |
| `TOTAL_INCOMPLETE` | A total is given over incomplete components |
| `NO_RESPONSE_COERCED` | Measured asks omit `noResponse`, so silence cannot be told apart from a decline |
| `WITHDRAWAL_COERCED` | Measured asks omit `withdrawn`, so a withdrawal cannot be told apart from a decline or no response |
| `RESOURCE_LIMIT` | The receipt or CLI input exceeds a limit, or the report was truncated |
| `MEASUREMENT_FIELD`, `MEASUREMENT_INCONSISTENT` | A measurement field is missing, or values do not add up |
| `SAVINGS_INFERRED` | A `savings` field is present |
| `PRIVATE_FIELD`, `PRIVATE_VALUE` | A raw/private key (`arguments`, `result`, `content`, `packet`, …), or an email-, URL- or secret-shaped value |

The private checks are a guard rail, not a security scanner. Warnings (`NOT_SYSTEM_OUTPUT`, `MEASUREMENT_UNKNOWN`, `COVERAGE_PARTIAL`) never make a receipt invalid.

## Fixtures

All fixtures are synthetic and contain no real run, member or source data.

| Fixture | Expected result |
|---|---|
| `valid-synthetic` | Valid. The sanitized sample |
| `missing-link` | `LINK_UNRESOLVED`: an unadmitted source and a missing invocation |
| `conflicting-version` | `VERSION_CONFLICT`: contribution version, run head and duplicate artifact digest |
| `unknown-measurement` | Valid with warnings. Unknowns are stated explicitly and there is no total |
| `unknown-as-zero` | `UNKNOWN_COERCED` and `TOTAL_INCOMPLETE` |
| `silence-as-rejection` | `NO_RESPONSE_COERCED`: unanswered asks folded into `declined` |
| `manual-packet-as-system` | `CLASS_MISMATCH` |
| `partial-as-complete` | `SCOPE_OVERCLAIM` |
| `private-field-leak` | `PRIVATE_FIELD` and `PRIVATE_VALUE` |

## Not done here

- No actual system-produced receipt exists yet. Its run, agent, runtime, tool and source references come from #45, #48 and #49, and v0 field names may change to match them.
- Argument, result and run-id digests must be computed by the owning host or runtime, so raw values never reach this repository.
- Which measurements are realistically available (provider usage or billing exports, how human time is captured) is only known after a real rehearsal.
