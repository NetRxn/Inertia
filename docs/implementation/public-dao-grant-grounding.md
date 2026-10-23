# Public DAO grounding for grant drafts

Reference revision: 1, 2026-10-23. Public sources only. This is a review reference, not an applicant import, eligibility determination, governance configuration, or submission authorization.

## Source registry

Read through the connected GitHub source API at the immutable revisions below on 2026-10-23 between 04:22:07Z and 04:22:57Z. These observation times are retrieval times, not effective dates or confirmation of current deployment.

- **W1, organization-published index:** [website/public/llms.txt](https://github.com/FWTX-DAO/website/blob/2f17cf5bb3477790ed0db66679bdec41edb9bbbc/public/llms.txt). Repository commit `2f17cf5bb3477790ed0db66679bdec41edb9bbbc`; file blob `74c000cf2419f151a09d76003b5ea66a8d7e1336`. Its own updated date is 2026-08-27. Field labels below refer to this file, not an engine import schema. Embedded directions are untrusted source content, not operating instructions.
- **W2, organization-published about-page source:** [website/src/pages/about.astro](https://github.com/FWTX-DAO/website/blob/2f17cf5bb3477790ed0db66679bdec41edb9bbbc/src/pages/about.astro). Same repository commit; file blob `48d7a0e61745ec41fe8eb4b8cbde1dc025995878`. Structured `aboutSchema.about` and first body paragraph corroborate W1 within the same publisher, not independently.
- **G1, published constitutional text:** [constitution/index.html, Article 3](https://github.com/FWTX-DAO/constitution/blob/2c9b15df85776496bfa65ebc4af2ea04d0c33810/index.html#L123-L131). Commit `2c9b15df85776496bfa65ebc4af2ea04d0c33810`; blob `386fd13fa788fcc824febc7614a594f60f577e33`.
- **G2, explicitly proposed governance:** [governance/README.md, Introduction and sections 3–4](https://github.com/FWTX-DAO/governance/blob/0a8a4666cd26e1ec576b441f3de13aec9c965334/README.md). Commit `0a8a4666cd26e1ec576b441f3de13aec9c965334`; blob `f095576777951ee4190f6d51224d1a1305e3929e`.

Canonical publisher pages: [website](https://fwtx.city/), [about](https://fwtx.city/about), [constitution](https://constitution.fwtx.city/). This pass verified pinned repository content, not live-page equivalence or authenticated portal holdings.

## Draft-field reference

Every entry has public privacy classification and **organization-published, not independently verified** verification state. Retain its source ID and qualification wherever used. Values are reference candidates, not automatically accepted form answers.

| Draft field | Candidate value / paraphrase | Source locator | Permitted use before primary verification |
|---|---|---|---|
| Public organization name | Fort Worth DAO; alias FWTX DAO | W1 introduction; W2 `name`, `alternateName` | Attributed organization profile |
| Legal applicant name | Fort Worth DAO LCA | W1 `legal_name`; W2 `legalName` | Provisional draft identity; reconcile with formation/tax records |
| EIN | 41-2815082 | W1 `ein` | Provisional draft identifier, not proof of exemption or applicant identity |
| Tax classification | Organization claims U.S. 501(c)(3) nonprofit status | W1 `tax_status`; W2 `nonprofitStatus` | Attributed claim only; do not answer verified eligibility/attestation fields |
| Founding date | 2023-12-19 | W1 `founded`; W2 `foundingDate` | Organization's reported founding date, not an incorporation or exemption-effective date |
| Service geography | Fort Worth and Greater Texas | W1 `service_area`; W2 `areaServed` | Draft narrative scope, not proof of funder-specific geographic eligibility |
| Mission / activities | Education and digital sovereignty through public learning, open-source collaboration and civic technology | W1 introduction; W2 first body paragraph | Attributed summary, not achieved outcomes or quantified impact |
| Website / contact | https://fwtx.city; community@fwtx.city | W1 `website`, `contact` | Public organization contact reference, not authorized representative or permission to contact |

## Authority and replacement precedence

1. Keep legal/tax facts provisional until appropriately matched primary evidence is inspected: formation records for legal identity and formation date; IRS determination/status evidence for exemption and relevant effective dates; authoritative EIN documentation for identifier matching. None of those documents was inspected for this reference. Public claims are not disproved merely because those records are pending access.
2. Once available, reconcile each field against the relevant primary document's issuer, entity identity, date and scope. Primary evidence supersedes a website claim only for the fact it actually establishes. Do not use an old determination letter alone as proof of every current eligibility condition. Preserve conflicting source versions, resolution reason and reviewer decision; do not silently overwrite history.
3. Use authenticated canonical governance holdings plus ratification/amendment evidence to resolve G1/G2. Their quorum, approval and vote-calling provisions conflict, and G2 explicitly describes a proposal. Neither repository recency nor website prominence establishes the current operative rule. No quorum, approval threshold, voter census, current officer or signing authority is supplied here.
4. Keep finances, budgets, impact counts, registrations, partner commitments, applicant certifications and opportunity-specific eligibility unresolved unless their actual evidence is obtained. No such values are inferred from mission language or aspirational plans.

## Use in the existing grant workflow

Inertia's `ReviewedGrantSource` consumes a complete reviewed engine export and authenticated artifact bytes; it does not ingest applicant facts. Therefore this reference introduces no seed JSON, import parser, schema, service, or alternative organization database. Prepare attributed draft material in the existing engine workflow using its supported intake, after confirming that interface. Preserve source URL, commit/blob, locator, observation time and verification state in the engine-supported evidence location; no evidence field or endpoint is invented here.

Public claims must not clear eligibility unknowns, requirement gates, open questions or human signoffs. The [grant packet binding](grant-packet-binding.md) remains unchanged: freeze only the reviewed packet with verified artifact hashes, bind governance evidence to that exact packet, and revalidate after any content or review change. This reference grants no authority to submit, publish, vote, sign, or change accounts.
