# Public DAO integration boundaries

Reference revision 6, 2026-10-24. Scope: pinned public sources. Deployment and operative governance verification are pending. See [grant-draft evidence](public-dao-grant-grounding.md).

## Shared storage boundary

Target one existing DAO managed PostgreSQL database for funding and meeting records, isolated by owned schemas and least-privilege roles; keep Paperclip native persistence independent. Existing Meeting Mode/website tables require read-only inventory and identifier mapping, not assumed duplication or automatic migration. Drizzle owns website/meeting changes; funding Alembic owns its own schema. Helix is the core indexed partner graph, with query-first research writeback and the evidence/history outbox merged and independently reviewed. Real PostgreSQL, native-service and embedded-Helix cloud rehearsal passed. Production source/host/service integration, admitted inventory/backfill and qualification remain pending. Queries revalidate source/access/version, with bounded PG fallback during outages. Broader 990 and optional semantic/vector enrichment follow later; review and governance retain their domain owners. See [source compatibility and migration gates](../development/dao-data-consolidation.md). Deployment qualification remains pending.

Durable native acceptance is implemented and independently reviewed, with DFW PR50 and Inertia host PR31 merged. Native verdict/receipt and DFW effect/audit use their own atomic transactions. Production transport, lifecycle-compatible retention/archive, real roles/bindings/source access and writer qualification remain gates; native acceptance does not confer governance or submission authority.

## Meeting source reuse

[Meeting Mode schema at 0c38b258](https://github.com/FWTX-DAO/meeting-mode/blob/0c38b258bb823cc074073cb0bcf1558307f5c710/src/core/database/schema.ts) defines meeting state, timestamps, transcript text, recording consent, attendees, agendas and motion/source-anchor fields. Its [service](https://github.com/FWTX-DAO/meeting-mode/blob/0c38b258bb823cc074073cb0bcf1558307f5c710/src/app/_services/meetings/services/meetings.service.ts) implements CRUD, start/end and transcript append. Motion publication and voting authority require separate workflows.

The [Phase 5 specification](https://github.com/FWTX-DAO/meeting-mode/blob/0c38b258bb823cc074073cb0bcf1558307f5c710/SPEC.md) proposes a Chair-reviewed motion/ballot workflow. Election adapter implementation and deployment are unverified. Reuse terminology and map existing meeting identifiers before proposing migrations; retain Paperclip work ownership and verified DAO governance. Inertia's immutable revision/CAS semantics remain necessary even when another UI appends transcript text. Establish licensing permission before substantial code reuse.

[Meeting source/native composition](../development/meeting-source-native-composition.md) is merged in Inertia PR34 and independently qualified against actual native PostgreSQL/WAL with synthetic external sources. It remains default-disabled pending real source/website admission; summary-only missing-transcript work is implemented, while R-M02 notes-only website output still needs a server contract.

The [discovery foundation](../development/funding-enhancement/discovery-host-composition.md) is merged in Inertia PR35/DFW PR51, default-disabled. It supports known-source preliminary briefs, independently corroborated new-source identity and existing signed Buzz transport. PR36/DFW PR52 add exact-source conditional deadline/benefit assessment without a site-specific adapter; eligibility remains separate. Actual research/model quality, active responsible-member wake mapping and human delivery remain pending.

## Existing governance service versus proposed rules

The [website navigation source](https://github.com/FWTX-DAO/website/blob/2f17cf5bb3477790ed0db66679bdec41edb9bbbc/src/components/navbar/navbar.astro) links Rob's Rules DAO and Aragon separately. [Rob's Rules](https://robsrulesdao.com/) describes a Vocdoni service, and its [participating-organizations page](https://robsrulesdao.com/participating-daos/) lists FWTX. Pending verification: current tenant, election ID, census, authentication, API and effective final-action path. The participating-page observation may be cached.

Confirm the existing authorized service contract and a completed example before implementing Inertia's live verifier. Verify the existing workflow before proposing a ballot adapter. Test elections require authorization. Publication, motion approval, immutable grant packet authority and external funder submission remain separate actions.

Constitutional text and the explicitly proposed governance repository disagree. The [grant-draft reference](public-dao-grant-grounding.md) preserves both immutable sources. Resolve quorum, approval, vote-calling, timelock and officer authority from canonical authenticated holdings and ratification/amendment evidence.

## Applicant facts, document access and reuse leads

Use the existing engine's supported evidence intake for attributed public draft facts. Retain existing engine intake, eligibility checks and reviewer signoffs. Retrieve authorized portal formation/tax/governance evidence before asking the user to reconstruct facts manually. Authenticated retrieval is required to establish a holdings gap.

The [website partner component](https://github.com/FWTX-DAO/website/blob/2f17cf5bb3477790ed0db66679bdec41edb9bbbc/src/components/logos.astro) links Y2. The [Innovation Lab component](https://github.com/FWTX-DAO/website/blob/2f17cf5bb3477790ed0db66679bdec41edb9bbbc/src/components/innovationlab.astro) links the 990 Graph research workbench. Neither establishes workspace access, credentials or a machine API. Y2 remains a required integration with its actual contract pending; 990 enrichment remains stretch. No new account, credential, live mutation or external communication follows from this reference.
