"""Captured public sponsor fixture only; no model, web, or deployed DFW data."""
import json
import os
import sys
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from sqlalchemy import select
from fixture_database import load_database_helper
from dfw_incentives.db import Database, init_db, make_engine
from dfw_incentives.models import ApplicantProfile, ApplicationPacket, Opportunity, OpportunityMatch

_database,fixture_helper=load_database_helper(
    Path(os.environ['QUALIFICATION_PRIVATE_ROOT'])/'tests/test_codex_agents.py',
    {'Database':Database,'init_db':init_db,'make_engine':make_engine,
     'ApplicantProfile':ApplicantProfile,'ApplicationPacket':ApplicationPacket,
     'Opportunity':Opportunity,'OpportunityMatch':OpportunityMatch,
     'UTC':UTC,'datetime':datetime,'Decimal':Decimal,'Path':Path})

root=Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
db,match,packet=_database(root)
with db.session() as session:
    applicant=session.scalar(select(ApplicantProfile))
    row=session.get(ApplicationPacket,packet)
    data=dict(row.packet_data)
    evidence=dict(data['evidence_register'][0])
    evidence.update(audience='public',verification_status='observed')
    applicant.profile_data={'evidence':[evidence]}
    data['operator_inputs']['applicant_fields']=[{'value':'PRIVATE-IDENTIFIER'}]
    data['operator_inputs']['document_evidence']=[{'text':'PRIVATE-DOCUMENT'}]
    data['project']['summary']='PRIVATE-NARRATIVE'
    data['sponsor_requirements'][0]['supported_answer']='PRIVATE-ANSWER'
    data['sponsor_requirements'][0]['ready']=True
    row.packet_data=data
print(json.dumps({'database_url':str(db.engine.url),'applicant_slug':'codex-applicant','match_id':match,'packet_id':packet,'fixture_helper':fixture_helper}))
