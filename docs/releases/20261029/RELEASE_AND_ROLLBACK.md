# Release and rollback closeout

This procedure freezes qualified source. It does not deploy, change credentials/configuration, approve applications or publish a GitHub Release. Human owns DemoDocs; the designated operator owns any runtime change.

## Candidate and version convention

`release/demo-20261029` starts from qualified Inertia source 09001dc, with DFW main 6203f76 pinned in the source manifest. The docs owner's fresh guide/architecture/user-guide handoff 27bbfef is included, preserving current develop and peer source. Historical docs #139 snapshots cannot stand in for current claims. Review the resulting docs/code diff and merge the accepted release bundle back into canonical develop before selecting an immutable final tag commit. Never tag a moving branch name, failed candidate or unmerged work.

No existing tags or GitHub releases establish a naming convention. Proposed first tags are Inertia `v0.1.0` and DFW `v3.4.1`; package metadata is consistent, and DFW explicitly makes pyproject.toml authoritative. No version bump or production-readiness claim is implied. Resolve any first-convention/scope ambiguity with root before publishing.

## Qualification and publication

1. Record the final canonical commit/tree for each repo and verify every accepted source head is an ancestor. Preserve peer and frozen author history; do not force-push or reset an active checkout.
2. Verify package/lock/runtime/plugin versions match the accepted names, required exact-source checks pass, the technical documentation handoff is verified and human DemoDocs ownership is preserved, and source-inputs.json distinguishes source from deployed manifests. Recheck tag-trigger behavior after any workflow change.
3. Check the proposed remote tags do not already exist. If an existing tag peels to another commit, stop; do not move it.
4. Create an annotated tag at the explicitly accepted full commit SHA, using the reviewed source release notes. Push only that tag ref, without force. Do not publish assets or deploy unless separately authorized.
5. Verify the remote annotated tag and its peeled commit, record tag object/commit/tree and note hashes, and preserve the final manifest. A tag push triggers no current CI/release/deployment workflow, so qualification must predate the tag.

## Source rollback

Preserve tags and release history. Inspect a prior qualified source in a new detached worktree or fresh checkout; do not reset the teammate's active checkout or rewrite a published tag. Select the exact manifest checkpoint rather than guessing HEAD~1. Pre-fresh-docs Inertia checkpoint 09001dc and prior DFW checkpoint 5847675 are recorded; the latter retains the lost-claim fix. They are source references, not independently accepted runtime rollback images.

## Runtime rollback boundary

The designated operator must verify the prior image digest, protected configuration/overrides, schema compatibility and source manifest before any restart or rollback. An application-only cutover preserves stores, queued work and history; do not restore or downgrade a database merely because source is rolled back. Existing protected reader overrides, credentials, grants and holds remain operator-owned. Follow the current qualified operational plan rather than historical repair commands or a Git tag alone.

Runtime/deployed-source parity is unestablished until the redacted operator manifest is compared with the accepted tagged source. Keep that proof separate from tests, package installation, source review and final business/application acceptance.
