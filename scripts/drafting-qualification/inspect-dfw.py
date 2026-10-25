"""Read durable domain effects, not callback counts or synthetic receipts."""
import json
import sys
from pathlib import Path
from sqlalchemy import select
from dfw_incentives.db import Database,make_engine
from dfw_incentives.models import DraftCandidateRecord,CandidateReviewRecord,CodexSuggestion,ApplicantFieldValue,WorkbenchAuditEvent,ApplicationOutcomeEvent

config=json.loads(Path(sys.argv[1]).read_text())
database=Database(make_engine(config['database_url']))
with database.session() as session:
    candidates=session.scalars(select(DraftCandidateRecord)).all()
    reviews=session.scalars(select(CandidateReviewRecord)).all()
    suggestions=session.scalars(select(CodexSuggestion)).all()
    gaps=session.scalars(select(WorkbenchAuditEvent).where(WorkbenchAuditEvent.entity_type=='funding_gap_progress')).all()
    print(json.dumps({
        'candidates':[{'id':r.id,'hash':r.candidate_hash,'principal':r.producer_id,'run':r.producer_run_id} for r in candidates],
        'reviews':[{'id':r.id,'candidate':r.candidate_id,'principal':r.reviewer_id,'run':r.reviewer_run_id} for r in reviews],
        'suggestions':[{'id':r.id,'status':r.status} for r in suggestions],
        'gap_events':[{'id':r.id,'principal':r.actor,'run':r.event_data['run_id'],'hash':r.event_data['progress_hash']} for r in gaps],
        'applicant_field_count':len(session.scalars(select(ApplicantFieldValue)).all()),
        'outcome_count':len(session.scalars(select(ApplicationOutcomeEvent)).all())
    }))
