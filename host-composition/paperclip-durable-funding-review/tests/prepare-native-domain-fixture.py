"""Prepare only disposable synthetic DFW data using its real reviewed fixture/config/services."""
import argparse,json,sys,uuid,shutil
from dataclasses import asdict,replace
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--directory',required=True);p.add_argument('--backend',default='/tmp/inertia-delivery-20261028/dfw/government-funding-dfw');a=p.parse_args();directory=Path(a.directory).resolve();directory.mkdir(parents=True,exist_ok=False);backend=Path(a.backend).resolve();sys.path[:0]=[str(backend/'src'),str(backend/'tests')]
from test_native_case_work import fixture
from test_native_case_source import propose
from dfw_incentives.native_case_preparation import PreparedCaseWorkConfiguration,PreparedCaseWorkService
from dfw_incentives.native_case_work import CaseWorkActor,CaseTask
m,db,e,record,doc,quote,c,oldactor,oldtask,oldservice=fixture(directory)
ids={k:str(uuid.uuid4())for k in ['companyId','P','Q','rootId','caseId','coId','betaId','alphaId','charlieId','runId','reviewerRun']}
enrichment=c.enrichment.model_copy(update={'company_id':ids['companyId'],'project_id':ids['Q'],'root_issue_id':ids['rootId'],'root_project_id':ids['P'],'producer':c.enrichment.producer.model_copy(update={'agent_id':ids['alphaId'],'principal_id':'alpha'}),'reviewer':c.enrichment.reviewer.model_copy(update={'agent_id':ids['betaId'],'principal_id':'beta'})})
config=PreparedCaseWorkConfiguration(**c.model_copy(update={'enrichment':enrichment,'case_project_id':ids['Q'],'producer':c.producer.model_copy(update={'agent_id':ids['betaId'],'principal_id':'beta'}),'reviewer':c.reviewer.model_copy(update={'agent_id':ids['charlieId'],'principal_id':'charlie'})}).model_dump())
actor=[CaseWorkActor(company_id=ids['companyId'],applicant_slug=enrichment.applicant_slug,project_id=ids['Q'],issue_id=str(uuid.uuid4()),root_issue_id=ids['rootId'],root_project_id=ids['P'],agent_id=ids['alphaId'],principal_id='alpha',run_id=str(uuid.uuid4()),role='researcher',case_binding_id=None)];task=[None]
service=PreparedCaseWorkService(db,config,lambda:actor[0],lambda _:task[0])
reserved=service.reserve_case(record_id=record,record_hash=service.enrichment.context(record_id=record)['record_hash'])
actor[0]=replace(actor[0],issue_id=ids['caseId'],agent_id=ids['betaId'],principal_id='beta',run_id=ids['runId'],role='producer',case_binding_id=reserved['case_binding_id'])
task[0]=CaseTask(company_id=ids['companyId'],project_id=ids['Q'],issue_id=ids['caseId'],parent_id=ids['rootId'],assignee_agent_id=ids['betaId'],origin_kind='manual',origin_id='paperclip-runner:create-task:'+ids['rootId']+':case:'+reserved['case_binding_id'],hidden=False,status='in_progress',active_run_id=ids['runId'],root_hidden=False,root_status='in_progress')
service.context();proposal=propose(service,doc,quote)
db.engine.dispose();database=Path(db.engine.url.database).resolve();baseline=directory/'unreviewed-baseline.sqlite';shutil.copyfile(database,baseline)
metadata={**ids,'databasePath':str(database),'baselineDatabasePath':str(baseline),'caseBindingId':reserved['case_binding_id'],'proposalHash':proposal['proposal_hash'],'recordId':record,'applicantSlug':enrichment.applicant_slug,'producer':asdict(actor[0]),'caseTask':asdict(task[0]),'configurationPath':str(directory/'config.json'),'entrypoint':str(directory/'entry.py')}
(directory/'config.json').write_text(config.model_dump_json());(directory/'metadata.json').write_text(json.dumps(metadata))
(directory/'entry.py').write_text('import sys\nsys.path.insert(0,'+repr(str(backend/'src'))+')\nfrom dfw_incentives.native_case_work_stdio import main\nmain()\n')
print(json.dumps({'syntheticOnly':True,'directory':str(directory),'metadataPath':str(directory/'metadata.json'),'realBoundSourceProposal':True}))
