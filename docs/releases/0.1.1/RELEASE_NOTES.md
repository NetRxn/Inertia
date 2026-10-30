# Inertia 0.1.1 — qualified P0 deployment

[Project README](../../../README.md) · [Documentation index](../../guide/README.md) · [Deployment pin](deployment-pin.json)

This release records the deployed member-app compatibility and organization-profile upgrade. Package, plugin manifest and lock metadata are 0.1.1. The immutable tag binds accepted integration source; the deployment pin binds the actual runtime images and sealed composition. Existing v0.1.0 and DFW v3.4.1 remain unchanged.

## Change and verification

The Integrations settings page now declares its required `instance.settings.register` capability. Supported administrator disable/restart/enable applies migration 009 once before READY, preserves the previous eight migration records and grant contents, and exposes four UI slots with the same 26 tools. PR157 source is b1bf0a1; exact-head CI and actual installed SDK/PostgreSQL/full-server activation checks passed.

P0 Paperclip image `7224a6fa…` was deployed at 23:40 CDT on October 29, 2026. Postboot authentication, Viewer read/write denials, 46 native guards and 33 supersessions,196 original pins, organization search and protected configuration were verified. A real existing funding run then completed its workspace/render/source-context regression at 23:43 CDT; Markdown and DOCX preserved all 18 saved fields. Outputs remain UNREVIEWED and do not establish application or packet approval.

The member image `78b5f89b…` contains the intended app tree `760305c` and remained unchanged during that upgrade. Its original external deployer, exact build commit and historical pre-migration backup receipt remain UNKNOWN. These are explicit provenance limits; functional source and reader compatibility was independently qualified, and the migration journal was observed installed, so no duplicate app deployment is required. A subsequent pre-profile member database and mounted-data backup was catalog-checked; the database dump is transactional, while the mounted-data archive is not claimed transactionally consistent with it.

## Composition and later runtime

Runtime is a selective reviewed composition over the existing custom Paperclip/domain runtime. This tag does not assert that every running file equals the whole `develop` tree. Full image/source/payload/archive/configuration identities are in the [deployment pin](deployment-pin.json).

On October 30 at 06:12 CDT, a later P1 image `f47870c6…` was deployed over P0 with preservation checks. Its actual Charlie business-review acceptance remains PENDING. That later runtime is recorded separately; this P0 release does not certify accepted P1, a completed ranked shortlist, final application approval or external submission.

## Recovery and known limits

P0's prior compatible Paperclip image is `c12cfffc…`; the later P1 rollout retains P0 image `7224…` as its rollback. These are historical exact image identities, not authorization to replay a cutover or downgrade stores. Keep additive migration 009 and existing organization/member data; use the current operator's qualified recovery receipt. See [release and recovery](../../guide/release.md).

Open dependency advisories and historical member-deployment provenance remain follow-up items. No credentials, database backups, protected configuration values or operational private paths are published here.
