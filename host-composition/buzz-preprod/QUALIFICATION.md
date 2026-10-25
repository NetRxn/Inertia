# Isolated Buzz relay qualification

## Result and scope

The isolated Linux ARM64 retest passed on Inertia commit [`5f2f903`](https://github.com/NetRxn/Inertia/commit/5f2f903274715ae194390fe2fa9845301586d90c). The repair was merged through [PR #82](https://github.com/NetRxn/Inertia/pull/82) at [`8d065454`](https://github.com/NetRxn/Inertia/commit/8d0654546fa905511b2d52a710a7e6ca4ddf51d0). This is a sanitized summary of the local qualification receipt, not a claim that this source-preparation task reran the relay.

The test used the official Buzz relay and disposable synthetic identities, storage and native-side fixtures. No published ports, real operational data, provider accounts, host trust-store changes or TLS bypass were used. The disposable qualification harness published no host ports; it was not the unchanged loopback-publishing profile in `compose.preprod.yml`. All disposable resources were removed. No persistent deployment keys or phone/community onboarding are established by this test.

Verified behavior:
- Older business timestamps receive fresh transport timestamps on first publication while preserving original business time.
- Accepted events whose responses were lost reconciled by exact ID, signature and signed bytes after **903–904 real seconds**, without replacement signatures or duplicate effects.
- A different signature, empty readback or denied readback remains unknown; none authorizes replacement publication.
- Recovery after verified worker exit resolves accepted claims. Aged, never-sent claims remain pending/unknown instead of being silently re-signed.

**Full installed-host integration is not qualified.** The native side was synthetic. The actual installed `ctx.http.fetch` continues to reject private-only DNS; that policy was not changed or bypassed. Successful direct test transport does not establish that the installed host can reach this relay. Phone use and public endpoints remain deferred. No AMD64 runtime qualification is claimed.

## Images and provenance

[`images.linux-arm64.lock.json`](images.linux-arm64.lock.json) records the five Linux ARM64 image references used and their observed OCI source revisions. These are verified metadata observations from the qualification lane, **not independent reproducible-build attestations**. The source label for Buzz identifies `9e8c9fc04daf20259cd259dcaec89109587cc7f5`; Postgres and Redis labels identify their image recipes, not upstream application commits.

The lock is metadata only. It does not fill credentials or hostnames, change the scaffold's platform, or override its retained upstream Silo/mc multi-platform references. A future runtime must deliberately select the correct platform and configuration. Registry metadata resolution can be done without deployment credentials; pulling images changes the executor's image cache but creates no deployment identity.

## Maintained tests and historical evidence

Use the maintained root regression suites in the repaired source: [`test/buzz.test.ts`](https://github.com/NetRxn/Inertia/blob/8d0654546fa905511b2d52a710a7e6ca4ddf51d0/test/buzz.test.ts), [`test/e2e/outbound-comments.test.ts`](https://github.com/NetRxn/Inertia/blob/8d0654546fa905511b2d52a710a7e6ca4ddf51d0/test/e2e/outbound-comments.test.ts), [`test/e2e/connected-loop.test.ts`](https://github.com/NetRxn/Inertia/blob/8d0654546fa905511b2d52a710a7e6ca4ddf51d0/test/e2e/connected-loop.test.ts), and [`test/store/postgres.test.ts`](https://github.com/NetRxn/Inertia/blob/8d0654546fa905511b2d52a710a7e6ca4ddf51d0/test/store/postgres.test.ts). See the maintained [transport contract](https://github.com/NetRxn/Inertia/blob/8d0654546fa905511b2d52a710a7e6ca4ddf51d0/docs/development/buzz-transport.md) for recovery semantics. Run those tests from a checkout containing the repair, not from the historical snapshots in this package.

`tests/timestamp-contract.mjs`, `evidence/inertia/` and `PROTOCOL.md` deliberately retain the original failing baseline at `8d15eaaa514d5604244fd731982df13e9a54f810`. That modeled fixture is historical characterization, not a repaired-code regression test or the evidence for the actual-relay pass. Do not substitute current source into it and interpret its expected old behavior as a new failure. No second maintained regression suite is added here.
