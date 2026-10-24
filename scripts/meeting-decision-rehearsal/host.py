"""Disposable stdin bridge to real DFW domain operations; no HTTP or member endpoint."""

import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from sqlalchemy import select, func
from test_opportunity_brief import db as seed_brief
from dfw_incentives.db import Database, make_engine
from dfw_incentives.models import (
    OrganizationKnowledge,
    PartnerDeltaReceipt,
    PartnerQueryReceipt,
    ApplicationPacket,
    ApplicationArtifact,
    ApplicantDocument,
    ApplicantDocumentVersion,
    Opportunity,
    WorkbenchAuditEvent,
)
from dfw_incentives.organization_knowledge import (
    KnowledgePrincipal,
    KnowledgeQuery,
    select_knowledge,
)
from dfw_incentives.partner_graph import (
    GraphPrincipal,
    GraphQuery,
    begin_research,
    commit_research_delta,
)
from dfw_incentives.opportunity_brief import build_opportunity_brief
from domain import apply_authorized_answer, brief_context

mode, root = sys.argv[1], Path(sys.argv[2])
root.mkdir(parents=True, exist_ok=True)
principal = GraphPrincipal(
    "synthetic-reader", "dao", ("public",), ("project-1",), ("fund:1",), can_write=True
)
now = datetime.now(UTC)
request = json.load(sys.stdin) if mode != "init" else {}
if mode == "init":
    db = seed_brief.__wrapped__(root)
    (root / "db.json").write_text(json.dumps({"url": str(db.engine.url)}))
else:
    db = Database(make_engine(json.loads((root / "db.json").read_text())["url"]))


def saved(s, opportunity="fund:1"):
    return select_knowledge(
        s,
        KnowledgeQuery("dao", ("public",), now, principal, opportunity_id=opportunity),
    )


def brief(s):
    c = brief_context()
    # Once the decision has been admitted, its exact expected revision remains a
    # required binding. A revoked/stale decision cannot silently revert to an old brief.
    if s.get(OrganizationKnowledge, "meeting-decision") is not None:
        binding = json.loads((root / "binding.json").read_text())
        c["source_bindings"].append(
            {
                "id": "meeting-decision",
                "revision": 2,
                "source_hash": binding["sourceHash"],
            }
        )
        c["recommendation"] = (
            "Defer this opportunity, as confirmed by the scoped synthetic human response; compare higher-value options against both application and delivery effort. This is not a DAO motion or spending approval."
        )
        links = (
            json.loads((root / "native-links.json").read_text())
            if (root / "native-links.json").exists()
            else {}
        )
        c["next_action"] = (
            "Compare higher-value opportunities against application, delivery and reporting effort in the same native goal and parent"
            + (" via native task " + links["followupId"] if links else "")
            + ". No hard dollar cutoff; no application preparation."
        )
        c["decisions"] = [
            {
                "id": "comparison",
                "question": "Which higher-value opportunities merit further investigation after comparing application and delivery effort?",
                "owner": None,
                "scope": "fund:1",
                "options": ["review comparison", "revise comparison"],
                "blocks": ["Future preparation decisions"],
            }
        ]
    return build_opportunity_brief(
        c, session=s, principal=principal, as_of=now
    ).model_dump(mode="json")


if mode == "init":
    result = {
        "initialized": True,
        "seed": "unmodified Task8 actual-domain fixture",
        "knowledge_before": 1,
    }
elif mode == "admit":
    result = apply_authorized_answer(
        db, json.loads((root / "binding.json").read_text()), request
    )
elif mode == "begin":
    if request["query"] != {"capabilities": [], "opportunity_id": "fund:1"}:
        raise ValueError("Unexpected synthetic research scope")
    with db.session() as s:
        result = begin_research(
            s,
            GraphQuery(principal, now, opportunity_id="fund:1"),
            run_id=request["run_id"],
            capabilities=[],
        )
        result["saved_knowledge"] = [r.model_dump(mode="json") for r in saved(s)]
elif mode == "commit":
    if request["candidates"] or request.get("expected_revisions"):
        raise ValueError("This rehearsal admits no new partner assertions")
    with db.session() as s:
        result = commit_research_delta(
            s,
            principal,
            run_id=request["run_id"],
            idempotency_key=request["idempotency_key"],
            query_receipt_id=request["query_receipt_id"],
            candidates=[],
            admissions=[],
            no_change_reason=request["no_change_reason"],
            opportunity_outcome=request["opportunity_outcome"],
        )
elif mode == "brief":
    with db.session() as s:
        result = brief(s)
elif mode == "counts":
    with db.session() as s:
        result = {
            name: s.scalar(select(func.count()).select_from(model))
            for name, model in [
                ("knowledge", OrganizationKnowledge),
                ("query_receipts", PartnerQueryReceipt),
                ("delta_receipts", PartnerDeltaReceipt),
                ("audits", WorkbenchAuditEvent),
            ]
        }
        result["decision_revision"] = s.get(
            OrganizationKnowledge, "meeting-decision"
        ).revision
        result["decision_authority"] = [
            e.event_data
            for e in s.scalars(
                select(WorkbenchAuditEvent).where(
                    WorkbenchAuditEvent.entity_id == "meeting-decision"
                )
            )
        ]
elif mode == "guard_checks":
    checks = {}

    def check_change(name, model, ident, field, value):
        with db.session() as s:
            row = s.get(model, ident)
            original = getattr(row, field)
            setattr(row, field, value)
        try:
            with db.session() as s:
                brief(s)
        except ValueError:
            checks[name] = "blocked"
        else:
            raise AssertionError(name + " was not blocked")
        finally:
            with db.session() as s:
                setattr(s.get(model, ident), field, original)

    check_change(
        "revoked_source", ApplicantDocument, "meeting-doc", "sensitivity", "restricted"
    )
    check_change(
        "stale_source_digest",
        ApplicantDocumentVersion,
        "meeting-version",
        "content_hash",
        "f" * 64,
    )
    check_change(
        "changed_packet",
        ApplicationPacket,
        "packet",
        "packet_data",
        {"submission_mode": "partner_contribution"},
    )
    check_change("changed_opportunity", Opportunity, "opp", "current_hash", "f" * 64)
    with db.session() as s:
        artifact = s.scalar(
            select(ApplicationArtifact).where(
                ApplicationArtifact.artifact_key == "outline"
            )
        ).id
    check_change(
        "changed_artifact", ApplicationArtifact, artifact, "content_hash", "f" * 64
    )
    with db.session() as s:
        p = KnowledgePrincipal(
            "unauthorized-reader", "dao", ("public",), ("project-1",), ("fund:2",)
        )
        assert not any(
            r.record_id == "meeting-decision"
            for r in select_knowledge(
                s, KnowledgeQuery("dao", ("public",), now, p, opportunity_id="fund:2")
            )
        )
    checks["other_opportunity"] = "withheld"
    result = checks
else:
    raise ValueError("Unknown mode")
print(json.dumps(result))
