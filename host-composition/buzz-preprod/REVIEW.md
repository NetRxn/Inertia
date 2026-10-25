# Independent scaffold review

Reviewed 2026-10-25 UTC: `compose.preprod.yml`, `.env.preprod.example`,
`README.md`, `validate_scaffold.py`, `SOURCES.json`, and the local upstream
Compose comparison. This review did not independently fetch remote source.

## Findings and resolution

- **P2, resolved in runtime prerequisites:** fixed Compose project naming did
  not prove a fresh namespace. README now requires checking labels and expected
  resource names, reviewing ownership/data, and refusing unapproved reuse,
  migration, stop, or deletion of matching existing resources.
- **P2, resolved in runtime prerequisites:** upstream connection URLs interpolate
  raw DB/Redis credentials. README now requires strong URL-safe credentials or
  a separately reviewed encoded-URL configuration.
- **P3, resolved in offline checks:** named-volume driver options could bypass
  the direct host-bind prohibition. Validator now rejects custom volume drivers
  and driver options, explicit network names, and network driver options.
  Negative mutation tests cover host-bind options and shared network names.

Independent rerun: `python validate_scaffold.py` — **9 tests passed**.
No remaining blocking finding in the reviewed source-only scaffold.

## Limits and runtime gates

The derivative retains upstream service structure and healthchecks, forces
authentication/membership on and push off, uses project-scoped storage and an
internal network, and publishes only the relay's host-loopback port. Secrets,
identity, origin and unresolved image references remain unset.

This is structural review, not a comprehensive security audit or runtime
qualification. No Docker parsing, pulls, image inspection, migration, service
startup, TLS routing, network-isolation probe, or real-relay round trip was
performed. Registry digests/source correspondence for unresolved images,
fresh resource ownership, approved credential provisioning, trusted private TLS,
and actual client/relay compatibility still require the documented future gates.
Phone onboarding remains deferred. Protocol/test-fixture review is separate.

Only offline validation and this review document were executed/written by the
reviewer; no credentials, keys, external actions, or existing runtime changes.

## Offline timestamp characterization review

Independently reviewed `tests/timestamp-contract.mjs`, copied Inertia HTTP source,
and the bundled official ingest, HTTP bridge, and NIP-98 source. The modeled
ordinary-event drift limit is 900 seconds; the drift rejection maps to HTTP 400
through `IngestError::Rejected`, not the separate HTTP-200 receipt branch.
NIP-98 timestamps use a separate 60-second window.

The harness imports the copied adapter, injects its fetch implementation and
clock, uses an explicitly public synthetic fixture key, and starts no listener.
It uses existing local esbuild/nostr-tools dependencies, performs no dependency
installation or network fetch, and cleans its temporary bundle. Revised checks
compare raw serialized retry bodies as well as signed event fields.

Independent rerun with
`INERTIA_DEPENDENCY_ROOT=/workspace/shared/inertia-pr62-linux-73b462e node tests/timestamp-contract.mjs`
passed **all 5 characterization checks**. The results establish adapter behavior
under the modeled responses, including the separate-call uncertainty gap; they
do not establish that the product gap is repaired.

`PROTOCOL.md` correctly distinguishes modeled exact-ID queries from real
channel/kind filtering, membership, or read consistency. Native service timestamp
mapping is source-reviewed, not executed here. No official relay, durable worker,
or native host HTTP path was run. Those limitations and actual-relay recovery
gates remain explicit. No blocking fixture-review finding remains.
