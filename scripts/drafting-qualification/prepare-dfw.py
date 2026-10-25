"""Captured public sponsor fixture only; no model, web, or deployed DFW data."""
import json
import sys
from pathlib import Path
from sqlalchemy import select
from test_codex_agents import _database
from dfw_incentives.models import ApplicantProfile, ApplicationPacket

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
print(json.dumps({'database_url':str(db.engine.url),'applicant_slug':'codex-applicant','match_id':match,'packet_id':packet}))
