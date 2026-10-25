# Attribution

Files under `upstream/` (except this package's manifests) and `evidence/block-buzz/` are copied from Block, Inc.'s [Buzz](https://github.com/block/buzz) at commit `9e8c9fc04daf20259cd259dcaec89109587cc7f5`. Copyright 2026 Block, Inc. Licensed under Apache License 2.0; full license retained in `upstream/LICENSE`. The pinned repository has no root NOTICE file; unrelated component notices are not incorporated. Original file notices remain intact.

`compose.preprod.yml` is a modified derivative of the upstream Compose file: project naming, internal network, loopback binding, unset required image references, explicit auth/membership/push and credential gates. `.env.preprod.example` adapts upstream environment names with all operational identity/origin/secret values unset. The original upstream copies remain unchanged.

`evidence/inertia/` contains unchanged source snapshots from this repository at `8d15eaaa514d5604244fd731982df13e9a54f810` solely for reproducible offline characterization; existing repository licensing applies. These snapshots do not replace active product source.
