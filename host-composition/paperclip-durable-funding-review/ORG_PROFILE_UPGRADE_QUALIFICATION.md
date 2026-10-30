# Org-profile package activation

This patch declares `instance.settings.register`, required by the existing Integrations `companySettingsPage`. It does not change the host capability guard, agent grants, provider identity, source/packet rules, DFW code or native overlays. Patch-version metadata is 0.1.1; the existing v0.1.0 tag is unchanged.

The old-install fixture uses the actual installed SDK, PostgreSQL and full `startServer` with heartbeat scheduling enabled and a paused synthetic company. Its normal administrator HTTP sequence is: install/configure the old 78bd package; verify READY and 26 tools; DISABLE; stage the reviewed new local package; full restart must remain DISABLED with the old manifest; explicit administrator ENABLE refreshes the package, applies migration009 and starts the worker. No separate `approveCapabilities` argument exists. `POST upgrade` is not used because the current loader rejects new capabilities after stopping the worker.

The current local-image path is outside the distribution catalog. The real application path/activation guard remains unchanged. An operator must explicitly approve the two new named UI capabilities (`ui.page.register` and `instance.settings.register`) and the exact qualified package before enabling it. Never edit registry rows or relax activation/capability guards. If a deployment's actual distribution catalog rejects this package/capability change, stop and use that platform's approved promotion path.

The fixture first supplies invalid migration009 and proves ERROR, no UI contributions and unavailable worker action. Correcting only that disposable file and explicitly enabling applies009 once, preserves migration001–008 checksums, plugin ID/path, company configuration and named permission rows, and exposes all four UI slots and unchanged 26 tools. A second enable and full restart preserve the same result. Rollback retains additive009 tables, ledger and any org data; no DROP/down migration/uninstall/reset is part of the rollout.

Exact offline command (existing locally qualified image; only public fixture/source mounts):

    docker run --rm --network none -e PROFILE_FULL_UPGRADE=1 \
      -v PACKAGE_ROOT:/qual/plugin:ro \
      -v CURRENT_C12_PLUGIN_ROOT:/qual/base-plugin:ro \
      -v CURRENT_FED4_NATIVE_CANDIDATE:/qual/native:ro \
      -v SOURCE/host-composition/paperclip-durable-funding-review/tests:/qual/tests:ro \
      --entrypoint node inertia-native-review:candidate-20261028 \
      --test /qual/tests/native-org-profile-upgrade.test.mjs

The synthetic scoped configuration is deliberately disabled and contains no operational provider credentials. This establishes the normal loader/migration/UI path, not startup of real protected subprocesses, real-user browser acceptance or immutable production image qualification. Operator postboot checks must separately verify actual current configuration/reference/grant preservation, the custom native46/33 composition, DFW renderer/source/currentness guards, named reader/tool roles and default denials. The package includes coherent approved org-profile source; it does not include the isolated P1 editorial work.

For qualification of the actual built image, use `PROFILE_INSTALLED_IMAGE=1`, `PROFILE_PLUGIN_ROOT=/opt/inertia-reviewed`, `PROFILE_EXPECTED_PACKAGE_VERSION=0.1.1` and the sealed `PROFILE_EXPECTED_MANIFEST_SHA`. Do not mount `/qual/plugin` or `/qual/native`: installed mode rejects alternate plugin/host paths and copies only the image's actual runtime into its disposable writable fixture. Mount the public old c12 package at `/qual/base-plugin` and this test directory at `/qual/tests`. This installed proof supplements the immutable image/payload/hash checks; it does not replace them.
