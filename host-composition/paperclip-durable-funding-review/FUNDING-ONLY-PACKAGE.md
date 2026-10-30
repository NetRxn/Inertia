# Funding-only native plugin package

The default Inertia package includes the optional member Packet tab. A host
without that feature can build an explicit funding-only artifact through the
native `paperclipPlugin.manifest` package descriptor. This does not change host
capability checks, grants, tool approval, or domain authorization.

Build the normal package in an isolated trusted checkout, then run:

```sh
npm run build
node host-composition/paperclip-durable-funding-review/packaging/compose-funding-only.mjs /absolute/path/to/package-root
npm pack --ignore-scripts
```

Use a separate package root so the default descriptor remains available. The
composition omits exactly `ui.detailTab.register`, the `member-packet` detail tab,
the UI entrypoint and `dist/ui` archive files. Unexpected UI declarations fail
closed. Worker code, tools, jobs, configuration schema, database declaration and
remaining capabilities are preserved. The original source manifest remains in
the archive but is not the selected native manifest. Dormant UI source modules
do not register a UI surface. The generated receipt identifies the composition
and hashes the original and composed descriptors/manifests. Pin the final
archive hash separately. Reapplying the generator verifies the existing result.

Install or upgrade the resulting artifact through the normal native lifecycle.
Compare its entire capability set with the installed ceiling before activation;
this composition does not authorize any other capability difference. Do not edit
the plugin registry or reinstall around native capability admission. A new tool
declaration never substitutes for an assignment or grant. Optional seventh-tool,
member-route and external-connector activation remain separate.

## Pinned native migration compatibility

The pinned 2026.1012.0 SQL splitter treats a trailing comment-only fragment as a
statement. Migration 008 previously ended with such a fragment and failed fresh
native installation. Its existing final comment is moved before the two ALTER
statements; executable SQL is unchanged. Migrations 001–007 are unchanged.

Before upgrading an existing installation, verify migration 008 is not already
applied with another checksum. Never overwrite an applied migration receipt or
disable checksum validation. This correction was qualified against an existing
seven-migration baseline, not a production deployment.

## Qualification evidence

Run the composition regressions with:

```sh
node --test host-composition/paperclip-durable-funding-review/packaging/funding-only.test.mjs
```

The 2026-10-26 disposable qualification used the actual pinned native installer,
lifecycle manager and worker against synthetic PGlite with all 304 host
migrations. It verified the seven-to-eight plugin migration upgrade, unchanged
plugin identity and two nonempty per-agent grant rows containing the exact four
producer/two reviewer selectors. Worker initialization, disabled configuration
validation and health readback passed. The archive omitted UI assets, preserved
all compiled domain files and added no capabilities. No provider, credentials,
live mounts or network were used. This is package/lifecycle evidence, not proof
of autonomous funding completion or production readiness.
