# Independent source/configuration review

2026-10-25; reviewed current compose.preprod.yml, README.md, .env.preprod.example, validate_scaffold.py, official upstream diff, and protocol source. This review did not deploy anything.

## Result
No blocking preparation-only isolation defect found. Do NOT interpret as deployable runtime acceptance.

- Compared with pinned official Compose: five original services preserved; no new orchestrator or grant connection.
- Only published port is explicit host loopback relay 13000; PostgreSQL, Redis, Silo and internal health/metrics have no host publication.
- Internal bridge network, project-owned named volumes, no external network/volume, host mount or privileged mode.
- Auth/membership forced true, push false. Credentials/origins and unverified image pins empty; runtime env file absent.
- Existing Silo/mc digest pins preserved. Other image references fail when absent; resolved digest/version verification is an explicit future operator gate (not enforced by this structural validator).
- Official dependency/readiness probes retained. Compose parse, image compatibility and actual reachability are untested because Docker is absent.
- README clearly discloses private TLS/native host prerequisites and phone deferral. It does not claim a complete running integration.
- Reran structural suite: nine tests pass, including negative mutations.
- Offline timestamp-client characterization: five checks pass; scope is accurately limited in PROTOCOL.md. Official drift rejection is HTTP400: ingest returns IngestError::Rejected and bridge maps it through StatusCode::BAD_REQUEST, not a success receipt.

## Explicit remaining runtime review gates
1. Verify approved concrete image digests, platform and version/source association. Static image interpolation alone does not validate a digest.
2. Verify host has no existing buzzpreprod project/resources before starting; do not attach or replace unknown resources.
3. Review fully resolved Compose using `config --quiet`, environment precedence, secret provisioning and actual network isolation. Do not print resolved credentials.
4. Private TLS terminator/path and native test host are intentionally not included; current scaffold alone cannot perform Inertia HTTPS calls.
5. Timestamp recovery incompatibility remains a product qualification blocker, not a reason to add an HTTP shim. Test native service + real relay after a reviewed contract change.

No product source changes, package installations, external communications, invite minting, runtime starts or Git writes were performed by this review.
