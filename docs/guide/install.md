# Install and qualify

This repository is source and qualification machinery, not a one-command production installation. Keep source preparation, package installation, native composition and target activation separate.

## Source checkout

Use Inertia `develop` for integrated plugin/native/member source and DFW-Gov-Fund `main` for the domain dependency. Check the [integration record](../development/source-integration-20261029.md) and the exact reviewed commit pair. The peer may continue member work on its own branch; do not reset or switch another contributor's checkout.

Prerequisite: Node.js 24.11 or newer. From a clean reviewed checkout:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:package
npm pack
```

`npm pack` builds through `prepack`. The private package includes compiled plugin/runtime/UI modules, SQL migrations and selected operating docs. The source guide is maintained in the repository; it is not claimed to be bundled in the tarball.

`npm test` visibly skips cross-repository domain qualification when its fixture paths are unset. To enable that qualification, use the exact reviewed DFW checkout and its locked Python runtime:

```sh
INERTIA_DFW_SOURCE_ROOT=/absolute/path/to/government-funding-dfw \
INERTIA_DFW_PYTHON=/absolute/path/to/python npm test
```

Both paths are required; incomplete/invalid configured paths fail. Public fixture success, configured cross-repository qualification and actual production behavior are different results. `demo`, `demo:transport`, `demo:roundtable` and `demo:workflow` use controlled/synthetic external I/O and do not prove real Buzz or notes integration.

## Native and domain composition

The inspected host/SDK base is Paperclip 2026.1012.0, upstream build `bba6a45…`. This is a pinned compatibility baseline, not a claim to be the newest upstream version. See [native composition](../../host-composition/paperclip-durable-funding-review/README.md) and [upgrade policy](../../host-composition/paperclip-durable-funding-review/UPGRADE.md).

The native bundle's `npm run bootstrap` installs locked official packages and verifies/applies its specified patches. It does not start Paperclip or install every later overlay by implication. Preserve the complete ordered composition and final `verify-composed-native-pins.mjs` result. Drift or a mixed candidate stops installation. Do not copy a stale worker, manifest or patch over the current integrated source.

Build the reviewed DFW wheel from its locked source and install the matched domain/runtime payload. Record plugin, native overlays, DFW wheel, source manifest and payload manifest together. An npm package alone does not contain the complete deployment.

## Target-specific configuration

An operator supplies admitted plugin configuration, scoped grants and protected secret references. Database/signing/provider credentials remain in their protected stores; no config values or credential homes belong in Git, package layers or screenshots. Preserve independent native/domain/member storage and current source/case identity. The organization reader uses its distinct scoped read identity, not a member cookie, ingest writer or reverse Paperclip reader.

Use the [release procedure](release.md) for an authorized target. A successful build does not authorize deployment, new grants, provider execution, Buzz sends, notes imports or submission.
