"""Actual synthetic GeneralEnrichment/native-case/stdio review+receipt. No pytest runtime."""
import argparse,json,sys,hashlib
from dataclasses import asdict
from io import BytesIO
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--directory',required=True);p.add_argument('--child-id',required=True);p.add_argument('--verify-only',action='store_true');p.add_argument('--backend',default='/tmp/inertia-delivery-20261028/dfw/government-funding-dfw');a=p.parse_args();directory=Path(a.directory).resolve();backend=Path(a.backend).resolve();sys.path.insert(0,str(backend/'src'))
from dfw_incentives.native_case_preparation import PreparedCaseWorkConfiguration
from dfw_incentives.native_case_source import SourceAssignment
from dfw_incentives.native_case_work import CaseWorkActor
from dfw_incentives.native_case_work_stdio import run
from dfw_incentives.db import Database,make_engine
from dfw_incentives.models import WorkbenchAuditEvent
from dfw_incentives.general_enrichment import _id
meta=json.loads((directory/'metadata.json').read_text());config=PreparedCaseWorkConfiguration.model_validate_json((directory/'config.json').read_text())
if a.verify_only:
 db=Database(make_engine(config.enrichment.database_url))
 with db.session()as session:stored=session.get(WorkbenchAuditEvent,_id(['review',meta['proposalHash']])).event_data
 print(json.dumps({'storedReviewSha256':hashlib.sha256(json.dumps(stored,sort_keys=True,separators=(',',':')).encode()).hexdigest()}));sys.exit(0)
actor=CaseWorkActor(**{**meta['producer'],'issue_id':a.child_id,'agent_id':meta['charlieId'],'principal_id':'charlie','run_id':meta['reviewerRun'],'role':'reviewer'})
proof=SourceAssignment(company_id=meta['companyId'],project_id=meta['Q'],case_binding_id=meta['caseBindingId'],case_issue_id=meta['caseId'],producer_agent_id=meta['betaId'],producer_principal_id='beta',producer_run_id=meta['runId'],reviewer_issue_id=a.child_id,reviewer_agent_id=meta['charlieId'],reviewer_principal_id='charlie',reviewer_run_id=meta['reviewerRun'],parent_issue_id=meta['caseId'],origin_kind='manual',origin_id='paperclip-runner:create-task:'+meta['caseId']+':source-review:'+meta['proposalHash'],hidden=False,status='in_progress',root_hidden=False,root_status='in_progress')
class Duplex(BytesIO):
 def __init__(self,op,params):super().__init__();self.first=True;self.pending=[];self.op=op;self.params=params
 def write(self,body):
  f=json.loads(body)
  if f['type']=='context':reply={'type':'context','id':f['id'],'context':asdict(actor)}
  elif f['type']=='case_task':reply={'type':'case_task','id':f['id'],'task':meta['caseTask']}
  elif f['type']=='source_assignment':reply={'type':'source_assignment','id':f['id'],'assignment':proof.model_dump()}
  else:raise AssertionError(f['type'])
  self.pending.append(json.dumps(reply).encode()+b'\n');return len(body)
 def readline(self,size=-1):
  if self.first:self.first=False;return json.dumps({'version':'dfw-native-case-work-v1','op':self.op,'params':self.params}).encode()+b'\n'
  return self.pending.pop(0)
def call(op,params):
 d=Duplex(op,params);return run(config,d,d)
pending=call('source_receipt',{'proposal_hash':meta['proposalHash']})
assert pending['receipt'] is None and pending['state']=='awaiting_independent_review' and pending['current_admission'] is False and pending['business_complete'] is False
review=call('source_review',{'proposal_hash':meta['proposalHash'],'decision':'accept','findings':[]})
db=Database(make_engine(config.enrichment.database_url));sha=lambda v:hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':')).encode()).hexdigest()
with db.session()as session:before=sha(session.get(WorkbenchAuditEvent,_id(['review',meta['proposalHash']])).event_data)
receipt=call('source_receipt',{'proposal_hash':meta['proposalHash']})
with db.session()as session:after=sha(session.get(WorkbenchAuditEvent,_id(['review',meta['proposalHash']])).event_data)
assert before==after
out={'sourcePendingResult':pending,'sourceReviewResult':review,'sourceReceiptResult':receipt,'immutableStoredReviewSha256Before':before,'immutableStoredReviewSha256After':after,'actualDomain':True,'childId':a.child_id,'reviewerRun':meta['reviewerRun']}
(directory/'actual-terminal.json').write_text(json.dumps(out));print(json.dumps(out))
