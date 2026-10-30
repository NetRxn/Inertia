# Clean application renderer — verified deployment, bounded business status

[Project README](../../../README.md) · [Documentation index](../../guide/README.md) · [Exact deployment pin](deployment-pin.json) · [Renderer contract](https://github.com/NetRxn/DFW-Gov-Fund/blob/d5cbfdf10c50ac08dac67c87151d12b4bb00cb43/government-funding-dfw/docs/CLEAN_APPLICATION_DRAFTS.md)

This record closes source integration and the deployed standard renderer/publisher mechanism. **It does not declare the application sponsor-ready.** At the October 30, 2026 08:00 CDT snapshot, the latest primary was rejected for reintroducing internal gates; a final content-only pass was in progress. The preserved clean fallback remains draft/unapproved.

## Standard functionality

The producer saves its complete sponsor-facing text in `sponsor_ready_application_draft`. The existing render operation uses that exact value for primary Markdown and Word, without appending worksheet labels, editing history, evidence metadata or internal decisions. `private_owner_decision_list` remains in the case workspace and internal handoff. This is presentation separation, not a new access-control boundary. Cases without an explicit primary retain the legacy renderer; invalid explicit content fails without a silent fallback. No one-off operator extraction is required for this code path.

## Source and runtime proof

DFW source `237955af` is preserved on canonical main `d5cbfdf`. Pinned Python 3.14.6 CI passed locked audit, compile, lint, types, full tests, build and migration: **2,309 passed / 6 skipped**. All 722 distribution hashes and the prior lost-claim/current-receipt/progression sources were verified.

Live image `59d0bfd8…` contains the selective renderer module and a 3.4.1 wheel whose only changed members are that module and RECORD. The other 171 Python modules retain their prior live bytes; canonical main's `native_cycle` difference is deliberately not promoted. Native 47 guards / 42 supersessions, the P0 plugin at 0.1.1, editorial publisher and member image remain preserved. Installed SDK, startup, actual PostGIS renderer/legacy/denial checks and live postboot/bridge controls passed. Exact image, module, wheel, fingerprint, source, payload and configuration hashes are in the pin. This is not whole-main runtime parity or a 3.4.2 package claim.

## Output and editorial evidence

- Initial live native output: 6,651 bytes, SHA `3ef0ba5c…`, exactly equal to Beta's saved primary. Word text matched; internal owner material was excluded.
- Charlie's actual verdict on that body was `changes_requested`, with one legal-applicant signature-placeholder consistency finding. It was not approval unchanged.
- Beta resumed automatically; the signature-corrected native body `029bd22f…` (6,667 bytes) is preserved as a clean, unapproved fallback.
- A later primary `0c6fdb12…` (10,472 bytes) reintroduced internal gates and was rejected for consumer readiness. Its later review interpretation is disputed by root; existing verdicts remain immutable.

The Word/readback proof for the initial body is not presented as proof for a later revision. Any final content-pass result must be read and identified separately; this deployment record does not manufacture approval. Raw applicant text and the internal owner sheet are not published in GitHub.

## Release scope and stability

`deployment/clean-application-20261030.1` binds this deployment/publisher evidence and its explicit business status. Component metadata stays 0.1.1 / 3.4.1; earlier software and P2 evidence tags remain immutable. The Git closeout lane performs no runtime, deployment or configuration changes. This record does not authorize a replay of the historical cutover or use of a full canonical wheel.

Editorial outcomes do not grant eligibility, applicant-fact acceptance, expenditure, commitments, signatures, final packet or submission authority. Full funding-portfolio acceptance and sponsor-ready business output are not claimed.
