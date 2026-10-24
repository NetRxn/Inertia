"""Local rehearsal domain bridge. Not exposed to members or accepted as live authority."""

from datetime import UTC, datetime
from dfw_incentives.hashing import canonical_json_bytes, content_hash
from dfw_incentives.models import (
    ApplicantDocument,
    ApplicantDocumentVersion,
    ApplicantDocumentFact,
    OrganizationKnowledge,
)
from dfw_incentives.organization_knowledge import (
    KnowledgeRecord,
    KnowledgePrincipal,
    KnowledgeQuery,
    TrustedKnowledgeAdmission,
    knowledge_evidence_hash,
    propose_knowledge,
    admit_knowledge,
    select_knowledge,
)


def apply_authorized_answer(db, binding, verified):
    # Both are internal host inputs: binding is configured once after actual native
    # readback; verified is produced under current native source/membership locks.
    # No member-facing API accepts this envelope or TrustedKnowledgeAdmission.
    if (
        verified != binding
        or binding.get("authority") != "authorized_human"
        or binding.get("scopeKind") != "opportunity"
        or binding.get("scopeId") != "fund:1"
        or binding.get("organizationId") != "dao"
        or binding.get("audience") != "public"
        or binding.get("option") != "defer"
        or binding.get("adoptedMotion") is not False
    ):
        raise ValueError("Exact configured synthetic meeting authority required")
    now = datetime.now(UTC)
    principal = KnowledgePrincipal(
        "synthetic-reader", "dao", ("public",), ("project-1",), ("fund:1",)
    )
    query = KnowledgeQuery("dao", ("public",), now, principal, opportunity_id="fund:1")
    locator = {
        "native_interaction_id": binding["sourceId"],
        "question_id": "pursuit",
        "question": binding["question"],
        "option_id": "defer",
    }
    quote = binding["question"] + "\nAnswer: Defer and compare"
    record = KnowledgeRecord(
        organization_id="dao",
        record_id="meeting-decision",
        kind="decision",
        claim_key="opportunity.pursuit",
        scope_kind="opportunity",
        scope_id="fund:1",
        value=quote,
        source_id=binding["sourceId"],
        source_revision=binding["sourceRevision"],
        source_locator=locator,
        source_hash=binding["sourceHash"],
        source_version_id="meeting-version",
        source_fact_id="meeting-fact",
        observed_at=datetime.fromisoformat(
            binding["sourceRevision"].replace("Z", "+00:00")
        ),
        audience="public",
    )
    with db.session() as s:
        # Fixed synthetic expected context; existing actual builder checks packet,
        # opportunity, artifact and admitted source before any new knowledge write.
        from dfw_incentives.opportunity_brief import build_opportunity_brief

        build_opportunity_brief(
            brief_context(), session=s, principal=principal, as_of=now
        )
        existing = s.get(OrganizationKnowledge, "meeting-decision")
        if existing is not None:
            if existing.evidence_hash != knowledge_evidence_hash(record):
                raise ValueError("Conflicting meeting replay")
            current = next(
                (
                    r
                    for r in select_knowledge(s, query)
                    if r.record_id == "meeting-decision"
                ),
                None,
            )
            if current is None:
                raise ValueError("Meeting source no longer current or accessible")
        else:
            s.add(
                ApplicantDocument(
                    id="meeting-doc",
                    applicant_id="dao",
                    title="Synthetic native scoped triage answer",
                    classification="formation_governance",
                    sensitivity="public",
                    status="available",
                    current_version=1,
                    created_at=now,
                    updated_at=now,
                )
            )
            s.flush()
            s.add(
                ApplicantDocumentVersion(
                    id="meeting-version",
                    document_id="meeting-doc",
                    version=1,
                    provider="meeting",
                    provider_reference=binding["sourceId"],
                    provider_reference_hash=content_hash(binding["sourceId"]),
                    content_hash=binding["sourceHash"],
                    scan_status="clean",
                    extraction_status="review_required",
                    redaction_status="not_required",
                    created_at=now,
                )
            )
            s.flush()
            s.add(
                ApplicantDocumentFact(
                    id="meeting-fact",
                    document_version_id="meeting-version",
                    fact_key="opportunity.pursuit",
                    label="Opportunity-only triage response",
                    value={
                        "source_id": binding["sourceId"],
                        "source_revision": binding["sourceRevision"],
                    },
                    evidence_excerpt=quote,
                    source_locator=canonical_json_bytes(locator).decode(),
                    status="suggested",
                    created_at=now,
                    updated_at=now,
                )
            )
            s.flush()
            rid = propose_knowledge(s, record)
            if rid != record.record_id:
                raise ValueError("Unexpected canonical meeting record")
            admission = TrustedKnowledgeAdmission(
                organization_id="dao",
                actor_id=binding["actorId"],
                policy_id=binding["policyId"],
                authority="authorized_human",
                evidence_hash=knowledge_evidence_hash(record),
                kind=record.kind,
                claim_key=record.claim_key,
                scope_kind=record.scope_kind,
                scope_id=record.scope_id,
                audience=record.audience,
            )
            current = admit_knowledge(s, rid, 1, admission)
        return {
            "id": current.record_id,
            "revision": current.revision,
            "source_hash": current.source_hash,
            "scope_id": current.scope_id,
            "authority": "authorized_human",
            "adopted_motion": False,
        }


def brief_context():
    from test_opportunity_brief import context

    value = context()
    value["project_alignment"][0]["text"] = (
        "Proposed alignment with the synthetic learning objective; active project status is not verified"
    )
    return value
