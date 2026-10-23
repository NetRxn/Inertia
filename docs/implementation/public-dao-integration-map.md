# Public DAO integration boundaries

Reference revision 3, 2026-10-23. Scope: pinned public sources. Deployment and operative governance verification are pending. See [grant-draft evidence](public-dao-grant-grounding.md).

## Shared storage boundary

Target one existing DAO managed PostgreSQL database for funding and meeting records, isolated by owned schemas and least-privilege roles; keep Paperclip native persistence independent. Existing Meeting Mode/website tables require read-only inventory and identifier mapping, not assumed duplication or automatic migration. Drizzle owns website/meeting changes; funding Alembic owns its own schema. Helix is the core indexed partner graph under implementation, fed by query-first research writeback and the DAO PostgreSQL evidence/history outbox. Queries revalidate source/access/version, with bounded PG fallback during outages. Broader 990 and optional semantic/vector enrichment follow later; review and governance retain their domain owners. See [source compatibility and migration gates](../development/dao-data-consolidation.md). This changes design, not deployed storage.

## Meeting source reuse

[Meeting Mode schema at 0c38b258](https://github.com/FWTX-DAO/meeting-mode/blob/0c38b258bb823cc074073cb0bcf1558307f5c710/src/core/database/schema.ts) defines meeting state, timestamps, transcript text, recording consent, attendees, agendas and motion/source-anchor fields. Its [service](https://github.com/FWTX-DAO/meeting-mode/blob/0c38b258bb823cc074073cb0bcf1558307f5c710/src/app/_services/meetings/services/meetings.service.ts) implements CRUD, start/end and transcript append. Motion publication and voting authority require separate workflows.

The [Phase 5 specification](https://github.com/FWTX-DAO/meeting-mode/blob/0c38b258bb823cc074073cb0bcf1558307f5c710/SPEC.md) proposes a Chair-reviewed motion/ballot workflow. Election adapter implementation and deployment are unverified. Reuse terminology and map existing meeting identifiers before proposing migrations; retain Paperclip work ownership and verified DAO governance. Inertia's immutable revision/CAS semantics remain necessary even when another UI appends transcript text. Establish licensing permission before substantial code reuse.

## Existing governance service versus proposed rules

The [website navigation source](https://github.com/FWTX-DAO/website/blob/2f17cf5bb3477790ed0db66679bdec41edb9bbbc/src/components/navbar/navbar.astro) links Rob's Rules DAO and Aragon separately. [Rob's Rules](https://robsrulesdao.com/) describes a Vocdoni service, and its [participating-organizations page](https://robsrulesdao.com/participating-daos/) lists FWTX. Pending verification: current tenant, election ID, census, authentication, API and effective final-action path. The participating-page observation may be cached.

Confirm the existing authorized service contract and a completed example before implementing Inertia's live verifier. Verify the existing workflow before proposing a ballot adapter. Test elections require authorization. Publication, motion approval, immutable grant packet authority and external funder submission remain separate actions.

Constitutional text and the explicitly proposed governance repository disagree. The [grant-draft reference](public-dao-grant-grounding.md) preserves both immutable sources. Resolve quorum, approval, vote-calling, timelock and officer authority from canonical authenticated holdings and ratification/amendment evidence.

## Applicant facts, document access and reuse leads

Use the existing engine's supported evidence intake for attributed public draft facts. Retain existing engine intake, eligibility checks and reviewer signoffs. Retrieve authorized portal formation/tax/governance evidence before asking the user to reconstruct facts manually. Authenticated retrieval is required to establish a holdings gap.

The [website partner component](https://github.com/FWTX-DAO/website/blob/2f17cf5bb3477790ed0db66679bdec41edb9bbbc/src/components/logos.astro) links Y2. The [Innovation Lab component](https://github.com/FWTX-DAO/website/blob/2f17cf5bb3477790ed0db66679bdec41edb9bbbc/src/components/innovationlab.astro) links the 990 Graph research workbench. Neither establishes workspace access, credentials or a machine API. Y2 remains a required integration with its actual contract pending; 990 enrichment remains stretch. No new account, credential, live mutation or external communication follows from this reference.
