# Release and recovery

[Project README](../../README.md) · [Documentation index](README.md)

One designated operator changes the live VPS. This procedure summarizes the reviewed operating contract; it is not a copy-paste command to run an old incident script against a new target. Exact hashes, stage paths, composition and expected current image must be resolved from the current reviewed release receipt.

## Prepare the exact release

1. Integrate the reviewed source onto canonical Inertia `develop` and DFW `main`, preserving peer work and the exact dependency pair. Pass exact-head CI and required configured qualification. Keep source integration separate from the currently running image.
2. Freeze a clean source/payload manifest, domain wheel and full native overlay composition. Build the target image and seal its archive. Independently verify that embedded metadata and actual installed file hashes match the sealed manifests. A metadata-hash mismatch stops qualification; a successful build is not enough.
3. Qualify the actual candidate with installed native/plugin/domain tests, normal full-server bootstrap, current review denials and protected configuration compatibility. Default-off and wrong-scope/actor behavior remain guarded. Do not use fixture I/O as a real reader or business proof.
4. Prepare one compatible rollback image and current protected backup/checkpoint. Record queue/run/wake and native/domain/artifact inventories plus database restore-catalog checks. Keep database backups and credentials protected on the target; source transfer is not database transfer.

## Cut over without losing work

1. Let productive providers finish naturally. Use the supported admission-drain/company controls and prove the authorized quiescent state, including actual active processes and preserved queued intents. Do not cancel work merely to meet an arbitrary timer or remove genuine dependencies to manufacture quiescence.
2. Recheck the expected current image, checkpoint hash, source/payload hashes, boot, composed configuration and rollback identity immediately before the swap. The reviewed helper's plan mode must pass. Stale preconditions mean stop and reconcile.
3. Stop only the old Paperclip app and prove the same container is stopped with PID0 before recreating the app. Preserve database/artifact volumes, credential homes, provider identities, member service and tunnel. No database restore is part of an ordinary app-only cutover.
4. Use the exact reviewed Compose inputs and image ID. Keep the original normal scheduler-enabled boot. Temporary scheduler-disabled maintenance is a separately labeled recovery state, not desired architecture or normal execution proof.
5. Before releasing admission, independently verify health200, plugin READY, expected image/source/payload/config hashes, composed guards, production/authenticated mode, scheduler, persistence and unchanged queue intents. Verify owner access, unauthenticated denial and Viewer read/write denial boundaries. Preserve UID/read-only-root/capability/seccomp/AppArmor/signer-mount protections. Test the actual scoped reader and saved-output behavior separately from health.
6. Resume through supported ordinary APIs with existing responsibility/identity. Observe real native admission, business-tool behavior and saved/readback output. A queued wake or successful PATCH is not execution or business acceptance.

The current design uses Cloudflare Access and tunnel routing to the admitted origins. No Caddy layer is part of this operating model. Preserve all active Compose layers for the member reader on later member deployments; do not replace the peer's configuration or discard its read-route override accidentally.

## Recover a failed release

Keep the company/admission in the supported held state while examining exact outcome and durable effects. Retain histories and outputs; do not patch statuses/holds in SQL, restore a database merely to change an app image, or replay an uncertain mutation blindly. A rollback is permitted only when its image/config/data compatibility and current state are verified.

Stop and prove cessation of the failed app, select the preserved compatible image and reviewed normal boot/configuration, recreate only the app, then repeat the same postboot and queue-inventory checks. A rollback can fail on the same data-triggered startup condition; that happened during the historical review-finalizer incident. Do not promise automatic recovery or keep restarting without diagnosis. Uncertain live work stays quarantined until its owning recovery contract resolves it.

## Publish source and release tags

Once the release owner accepts the exact integrated source and required checks, use the recorded version/tag policy. The first annotated source tags are [Inertia `v0.1.0`](https://github.com/NetRxn/Inertia/tree/v0.1.0) and [DFW `v3.4.1`](https://github.com/NetRxn/DFW-Gov-Fund/tree/v3.4.1), matching package metadata. They preserve the accepted source commits; later documentation can advance without moving the tags. See the [source release inputs and notes](../releases/20261029/RELEASE_NOTES.md). The plugin package version alone does not identify the combined native/domain/runtime deployment. Do not invent a new version number, tag a moving branch or imply that a source tag deploys the VPS.

Release notes must record the Inertia commit/tag, DFW commit/tag, native upstream and composition identity, artifact checksums, target image and deployment status, rollback compatibility, user-visible changes and known limits. State the current scope: useful ranked saved opportunities and readable proposed drafts; deferred Notes, real Buzz and exhaustion/revisit; no final Charlie whole-packet or external-submission claim. Keep secret values, private URLs and protected checkpoint contents out of public release notes.

The Git integration lane owns merge/tag closeout; the live operator owns target proof. Both records must agree before claiming source/runtime parity. This documentation change runs no deployment, rollback or tagging command.

## Known dependency follow-up

The tagged DFW lock contains Mako 1.3.12. GitHub advisory [GHSA-5639-2j2p-m4mx](https://github.com/advisories/GHSA-5639-2j2p-m4mx) describes a Windows TemplateLookup drive-letter path-traversal vulnerability, patched in 1.4.2. The existing [dependency PR #41](https://github.com/NetRxn/DFW-Gov-Fund/pull/41) proposes the update. The release CI dependency audit passed, but the separate GitHub alert remains open; source qualification does not close it or establish runtime exploitability. Review the dependency update through its own checks before deployment.
