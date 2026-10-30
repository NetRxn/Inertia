# Historical source receipt qualification

The canonical DFW review event has no `business_complete` field. The native stdio operation envelope adds `business_complete: false`; the native historical-receipt consumer must validate that envelope before projecting the flag into its own settlement ledger. The domain review and its event hash remain unchanged. Direct review/settlement operations retain their existing validation.

`prepare-native-domain-fixture.py` uses the real DFW synthetic test fixture and services to reserve a case and author a canonical proposal with UUID native identities. Run it using the existing locked DFW Python environment, explicitly supplying an unused absolute `--directory` and reviewed `--backend`. It produces only synthetic SQLite, public synthetic source evidence, configuration and metadata. Its unreviewed SQLite baseline permits serial RED/GREEN runs without rewriting historical immutable review identity.

`native-source-receipt-domain-native.test.mjs` runs in the existing offline native qualification image, with:

- `/qual/source`: this composition (read only).
- `/qual/candidate`: exact compiled native candidate (read only).
- `/qual/current-plugin`: reviewed current plugin `dist` tree (read only).
- `INERTIA_ACTUAL_DOMAIN_FIXTURE`: synthetic directory mounted writable at the **same resolved absolute path** used during preparation.
- `INERTIA_ACTUAL_DOMAIN_BACKEND`: reviewed DFW backend whose `src` is mounted read only at that same resolved absolute path. On macOS, resolve `/tmp` to `/private/tmp` consistently with the generated entrypoint.
- `PYTHONHOME=/opt/dfw-seed/python`: the image's bundled interpreter standard library; the synthetic bounded-process wrapper also sets this explicitly because the plugin SDK worker does not retain arbitrary inherited environment values.

The test resets only its explicitly supplied synthetic SQLite file, creates an ordinary native Charlie child, produces an actual historical DFW accepted review, then invokes real `registerCaseWork`, bounded Python stdio, SDK worker, dispatcher, gateway, assigned tools, native settlement, completion and Beta dependency wake. The historical reviewer run differs from the current native recovery run. It checks immutable stored review hashes before and after the actual handler read. Pending receipts and contradictory/missing flags, foreign case identity and revoked grants remain denied. No provider starts and Docker networking is disabled.

Use separate synthetic directories or serialize runs: each test resets its own synthetic baseline. The deployed predecessor must fail at native `validateSourceReviewReceipt` after the successful actual handler read; the candidate must create one settlement, finish the child and persist exactly one Beta wake. This proves this contract repair, not funding business readiness.
