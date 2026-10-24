from copy import deepcopy
import pytest
from test_opportunity_brief import db as brief_db
from dfw_incentives.models import ApplicantDocumentVersion, OrganizationKnowledge
from domain import apply_authorized_answer


def setup(tmp_path):
    db = brief_db.__wrapped__(tmp_path)
    binding = dict(
        authority="authorized_human",
        actorId="synthetic-human",
        policyId="synthetic-opportunity-triage-v1",
        organizationId="dao",
        scopeKind="opportunity",
        scopeId="fund:1",
        audience="public",
        sourceId="native-question",
        sourceRevision="2026-10-23T12:00:00.000Z",
        sourceHash="a" * 64,
        option="defer",
        question="Defer this opportunity and compare higher-value options against application and delivery effort?",
        adoptedMotion=False,
    )
    return db, binding


def test_admit_exact_answer_and_replay_without_revision_growth(tmp_path):
    db, b = setup(tmp_path)
    first = apply_authorized_answer(db, b, b)
    assert first["revision"] == 2
    assert first["authority"] == "authorized_human" and first["scope_id"] == "fund:1"
    assert apply_authorized_answer(db, b, b) == first
    with db.session() as s:
        assert s.get(OrganizationKnowledge, "meeting-decision").revision == 2


@pytest.mark.parametrize(
    "field,value",
    [
        ("actorId", "other"),
        ("authority", "adopted_decision"),
        ("scopeId", "fund:2"),
        ("sourceRevision", "old"),
        ("sourceHash", "f" * 64),
        ("option", "pursue"),
        ("adoptedMotion", True),
    ],
)
def test_conflicting_or_unauthorized_envelope_never_admitted(tmp_path, field, value):
    db, b = setup(tmp_path)
    changed = deepcopy(b)
    changed[field] = value
    with pytest.raises(ValueError):
        apply_authorized_answer(db, b, changed)
    with db.session() as s:
        assert s.get(OrganizationKnowledge, "meeting-decision") is None


def test_replay_rechecks_current_source_instead_of_returning_cached_admission(tmp_path):
    db, b = setup(tmp_path)
    apply_authorized_answer(db, b, b)
    with db.session() as s:
        s.get(ApplicantDocumentVersion, "meeting-version").content_hash = "f" * 64
    with pytest.raises(ValueError):
        apply_authorized_answer(db, b, b)


def test_changed_current_packet_blocks_admission_before_any_knowledge_write(tmp_path):
    from dfw_incentives.models import ApplicationPacket

    db, b = setup(tmp_path)
    with db.session() as s:
        s.get(ApplicationPacket, "packet").packet_data = {
            "submission_mode": "partner_contribution"
        }
    with pytest.raises(ValueError):
        apply_authorized_answer(db, b, b)
    with db.session() as s:
        assert s.get(OrganizationKnowledge, "meeting-decision") is None


def test_rehearsal_context_never_claims_verified_active_project():
    from domain import brief_context

    text = brief_context()["project_alignment"][0]["text"]
    assert text.startswith("Proposed alignment")
    assert "not verified" in text
