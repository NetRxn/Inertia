# Buzz preprod — isolated preparation, not a running deployment

**Phone remains deferred.** An isolated Linux ARM64 official-relay retest passed with repaired Inertia and synthetic native fixtures; all disposable resources were removed. Actual installed `ctx.http.fetch` still rejects private-only DNS, so full installed-host integration is **not qualified**. See [QUALIFICATION.md](QUALIFICATION.md). This package creates no runtime, persistent credentials or public endpoint; existing grant runtime remains outside its scope.

## Scope and layout
- `compose.preprod.yml`: minimally derived from pinned official Compose, not another orchestrator. Same relay/Postgres 17/Redis 7/Silo/mc services and upstream healthchecks.
- `upstream/`: unmodified official deployment evidence; **do not run its run.sh or compose files**, which use production naming/public binds.
- `.env.preprod.example`: unset secrets, origin, identity and unresolved image references. No real `.env.preprod` exists.
- `QUALIFICATION.md`: sanitized actual-relay retest scope and remaining host limitation.
- `images.linux-arm64.lock.json`: qualified ARM64 image references and observed OCI source labels; metadata only, not an automatic Compose override.
- `PROTOCOL.md`: historical pre-repair source compatibility review and plan.
- `validate_scaffold.py`: offline structural checks (Python + PyYAML; not Docker validation).
- `tests/timestamp-contract.mjs`: five offline pinned-client characterization checks, pinned to historical Inertia `8d15eaaa`, including its >15-minute delivery gap; invocation and limits are in `PROTOCOL.md`. Passing means the limitation was reproduced, not repaired.
- `REVIEW.md`: independent scaffold/fixture review and resolution record.
- `evidence/`, `SOURCES.json`: source provenance.

Preparation design: preserve stock dependencies; isolate via Compose project `buzzpreprod`, project-owned named volumes and an internal bridge network; publish relay only on host loopback port 13000. Database/Redis/Silo/health/metrics/admin ports are not published. No Caddy service, pair relay, host bind mount, privileged container, external network/volume, source acquisition or grant-runtime connection. Push is forced off and auth/membership forced on. Internal network blocks ordinary container egress; this is an intentional safety constraint, not yet runtime-tested.

Alternatives deliberately excluded: using the existing grant stack risks shared state; a synthetic HTTP wrapper is unnecessary because the official relay already implements the narrow HTTP protocol; public TLS is not needed for source preparation and phone is deferred.

## Preparation plan and observed validation
1. Read official deployment/API and pinned Inertia source; compare signatures/envelopes before changing transport.
2. Preserve official files, derive the smallest isolated Compose configuration, leave all credentials unset.
3. Validate isolation and negative mutations offline; independently review source/configuration.
4. Hand off runtime gates without deploying or claiming real-relay evidence.

Executed: `python validate_scaffold.py` — 10 tests passed, including public-port, external-volume, volume-driver host bind, shared-network, open-membership and egress rejection. These structural checks do not run Docker. Later isolated ARM64 relay execution is reported separately in QUALIFICATION.md; no phone join or public endpoint was tested.

## Source and image pins
Buzz source: [9e8c9fc](https://github.com/block/buzz/tree/9e8c9fc04daf20259cd259dcaec89109587cc7f5).
Historical Inertia baseline: [8d15eaaa](https://github.com/NetRxn/Inertia/tree/8d15eaaa514d5604244fd731982df13e9a54f810).
Official [Compose documentation](https://github.com/block/buzz/blob/9e8c9fc04daf20259cd259dcaec89109587cc7f5/deploy/compose/README.md).
Upstream Silo/mc multi-platform OCI digests are retained exactly. Buzz, Postgres and Redis digest references remain unset rather than inventing pins or treating mutable tags as immutable. The qualified Linux ARM64 references and observed OCI source labels are now recorded in images.linux-arm64.lock.json. Do not apply them as AMD64 qualification. Environment values remain unset; Compose is not silently retargeted. Latest GitHub release observed was **desktop-v0.5.28**; that is not proof of relay image contents or of the user's installed mobile version.

## Local runtime prerequisites
- A separately selected isolated host with Docker and Compose >=2.24.4; adequate disk/resources for the official five-service stack (size after measured smoke test, not invented sizing).
- The isolated synthetic development test is authorized. Use disposable known test identities/storage only; persistent deployment credentials, real accounts and public exposure remain separate. No dependency installation or image pull was performed here.
- Reviewed digest-pinned `BUZZ_IMAGE`, `POSTGRES_IMAGE` (17), `REDIS_IMAGE` (7). No `:main` fallback.
- Isolated stable relay private key, owner public key, HMAC, DB/Redis/S3 credentials provided through an approved secret procedure. Never reuse grant-runtime credentials or expose keys in logs/commits.
- DB/Redis credentials are interpolated into connection URLs by upstream Compose: use independently provisioned strong URL-safe values (for example a sufficiently long base64url alphabet), or review a separate encoded-URL configuration. Raw `@`, `:`, `/`, `?`, `#`, `%` characters must not be blindly inserted. No password is generated here.
- Verify this is a fresh project namespace before any start/migration/stop: inspect containers, volumes and networks with label `com.docker.compose.project=buzzpreprod`, and the expected `buzzpreprod_*` resource names. Existing resources require ownership/data review; do not reuse, migrate, stop or delete them merely because names match. A fixed project name is not proof of freshness.
- Canonical relay origin consistent with NIP-98 Host/URL/tenant checks. Inertia requires HTTPS even for an actual local smoke test; choose a private test TLS endpoint trusted by its client, rather than weakening the adapter or disabling TLS verification. This private TLS path is not included or started.
- A separate preprod Inertia/native host instance or approved fixture host, isolated company/agent/channel mapping, bridge identity and memberships. Do not point this package at the current grant runtime.
- Use the repaired maintained transport and its regression tests. The actual-relay result does not qualify the installed host fetch path; private-only DNS remains rejected without bypass.

Only after those gates, copy the template to a mode-0600 `.env.preprod` and fill the approved values on that host. Validate without dumping interpolated secrets:

```sh
cd /path/to/buzz-preprod-preparation-20261025
python validate_scaffold.py  # Run BEFORE creating .env.preprod; enforces preparation-only state.
docker compose --project-name buzzpreprod --env-file .env.preprod -f compose.preprod.yml config --quiet
docker compose --project-name buzzpreprod --env-file .env.preprod -f compose.preprod.yml pull
docker compose --project-name buzzpreprod --env-file .env.preprod -f compose.preprod.yml up -d --wait
docker compose --project-name buzzpreprod --env-file .env.preprod -f compose.preprod.yml ps
```

These are future operator commands, **not executed**. Use the exact Compose project/files consistently, never upstream `run.sh` or generic default Compose commands. Ensure environment overrides do not redirect image/port/credentials unexpectedly. Existing official `BUZZ_AUTO_MIGRATE=true` is appropriate only for the fresh isolated DB; never attach an existing database.

Read-only namespace checks before those commands:
```sh
docker ps -a --filter label=com.docker.compose.project=buzzpreprod
docker volume ls --filter label=com.docker.compose.project=buzzpreprod
docker network ls --filter label=com.docker.compose.project=buzzpreprod
```
Also inspect collisions with expected resource names even when labels are absent. Stop at any collision until ownership is established. After start, record the newly created resource IDs for scoped rollback.

## Health and rollback (future, isolated only)
All dependency healthchecks are preserved. Relay readiness uses internal port 8080 and bash /dev/tcp; no curl is assumed inside its runtime image. Inspect health without printing environment:

```sh
docker compose --project-name buzzpreprod --env-file .env.preprod -f compose.preprod.yml ps
docker compose --project-name buzzpreprod --env-file .env.preprod -f compose.preprod.yml exec -T relay bash -ec 'exec 3<>/dev/tcp/127.0.0.1/8080; printf "GET /_readiness HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" >&3; grep -q "200 OK" <&3'
```

Do not confuse liveness with readiness or message round-trip. If deployment fails, stop only this project:
```sh
docker compose --project-name buzzpreprod --env-file .env.preprod -f compose.preprod.yml down
```
No `-v`: retain evidence/data pending review. Never `docker system prune` or remove unrelated containers/volumes. After migration, rollback requires a consistent isolated Postgres + Silo/git snapshot, not simply downgrading an image. Since nothing was started here, current rollback is only archiving/removing this preparation directory.

## Phone path — explicitly deferred
Current official mobile source supports community invite join with a fresh phone-local identity and signed `POST /api/invites/claim`. It does not need desktop identity-copy pairing for this path. A real compatible mobile build, owner/admin minted limited-use invite, approved reachable HTTPS/WSS hostname, valid TLS and starter-channel setup would be needed later. Private-IP-literal rejection and version support must be checked at that time. Do not generate a code now; no host question blocks this preparation.

Sources: [mobile join provider](https://github.com/block/buzz/blob/9e8c9fc04daf20259cd259dcaec89109587cc7f5/mobile/lib/features/invites/invite_join_provider.dart), [invite API](https://github.com/block/buzz/blob/9e8c9fc04daf20259cd259dcaec89109587cc7f5/crates/buzz-relay/src/api/invites.rs).

## Disposable test topology for reproduction
On a Docker-capable isolated test host, the smallest real-relay qualification can remain entirely local: use the same official five services with temporary storage, no host-published ports, known public test-only identities/password fixtures (never deployment accounts), and a disposable test runner on that project's internal network. For the actual unchanged Inertia HTTPS adapter, add reviewed local TLS termination using a test-only certificate trusted narrowly by that runner and a matching internal DNS alias/canonical tenant Host; do not disable TLS verification or contact public certificate authorities. This package does not implement or start that disposable override. The qualification lane used a separate no-published-port harness; its result does not claim that this retained loopback-publishing Compose profile was itself executed. No public endpoint or phone is necessary.

Run actual official relay admission/readback with synthetic owner, joining member and separate bridge identities, isolated channel/native actor mappings and no source scans. Record exact image digests, receipts and failure statuses. Test old first-publication, lost-response retry after 901 seconds, exact-ID readback, absent readback, membership loss and restart/replay. An injectable clock in an offline fixture cannot substitute for the real relay's wall clock; use controlled timestamps where possible and a bounded real wait for the lost-response aging case. Confirm the private TLS route preserves Host and the actual host's ctx.http.fetch semantics. Temporary credentials/data stay inside the disposable test namespace, are never used for the later deployment, and are removed only after ownership/evidence checks. This option needs Docker availability and reviewed image digests. Known disposable test fixtures are not permission to create real memberships/accounts or persistent preprod keys.

