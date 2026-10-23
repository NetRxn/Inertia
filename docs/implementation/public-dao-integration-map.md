# Public DAO integration boundaries

Reference revision 1, 2026-10-23. Public source reconnaissance only. This complements the [pinned grant-draft reference](public-dao-grant-grounding.md); it proves neither deployed integration readiness nor operative governance authority.

## Meeting source reuse

[Meeting Mode schema at 0c38b258](https://github.com/FWTX-DAO/meeting-mode/blob/0c38b258bb823cc074073cb0bcf1558307f5c710/src/core/database/schema.ts) defines meeting state, timestamps, transcript text, recording consent, attendees, agendas and motion/source-anchor fields. Its [service](https://github.com/FWTX-DAO/meeting-mode/blob/0c38b258bb823cc074073cb0bcf1558307f5c710/src/app/_services/meetings/services/meetings.service.ts) implements CRUD, start/end and transcript append. Ending a meeting does not itself publish motions or establish voting authority.

The [Phase 5 specification](https://github.com/FWTX-DAO/meeting-mode/blob/0c38b258bb823cc074073cb0bcf1558307f5c710/SPEC.md) describes a Chair-reviewed motion/ballot workflow, not an implemented election adapter. Source presence does not establish deployment or passing tests. Reuse terminology and map existing meeting identifiers before proposing migrations; do not copy a separate task/governance engine. Inertia's immutable revision/CAS semantics remain necessary even when another UI appends transcript text. Establish licensing permission before substantial code reuse.

## Existing governance service versus proposed rules

The [website navigation source](https://github.com/FWTX-DAO/website/blob/2f17cf5bb3477790ed0db66679bdec41edb9bbbc/src/components/navbar/navbar.astro) links Rob's Rules DAO and Aragon separately. [Rob's Rules](https://robsrulesdao.com/) describes a Vocdoni service, and its [participating-organizations page](https://robsrulesdao.com/participating-daos/) lists FWTX. These public links are reuse leads, not proof of a current tenant, election ID, census, authentication method, API or effective final-action path. The participating-page observation may be cached. Read-only tenant/documentation retrieval did not establish those details.

Confirm the existing authorized service contract and a completed example before implementing Inertia's live verifier. An unimplemented Meeting Mode ballot adapter does not mean the organization has no voting workflow. A linked service does not authorize creating a test election. Publication, motion approval, immutable grant packet authority and external funder submission remain separate actions.

Constitutional text and the explicitly proposed governance repository disagree. The [grant-draft reference](public-dao-grant-grounding.md) preserves both immutable sources. Do not choose quorum, approval, vote-calling, timelock or officer authority from repository recency or proposed specifications. Retrieve canonical authenticated holdings and applicable ratification/amendment evidence.

## Applicant facts, document access and reuse leads

Use the existing engine's supported evidence intake for attributed public draft facts. The grant reference adds no seed import, applicant database or parser; public claims must not clear eligibility or reviewer signoffs. Retrieve authorized portal formation/tax/governance evidence before asking the user to reconstruct facts manually. A sign-in page or failed public search is not evidence that holdings are absent.

The [website partner component](https://github.com/FWTX-DAO/website/blob/2f17cf5bb3477790ed0db66679bdec41edb9bbbc/src/components/logos.astro) links Y2. The [Innovation Lab component](https://github.com/FWTX-DAO/website/blob/2f17cf5bb3477790ed0db66679bdec41edb9bbbc/src/components/innovationlab.astro) links the 990 Graph research workbench. Neither establishes workspace access, credentials or a machine API. Y2 remains a required integration with its actual contract pending; 990 enrichment remains stretch. No new account, credential, live mutation or external communication follows from this reference.
