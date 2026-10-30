import {expect,it} from 'vitest';
import {dfwFixture} from '../dfw-fixture.js';
import {mkdtemp,writeFile,readFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {createBoundedContextBridge} from '../../src/bridge/duplex.js';
import {registerCaseWork,type CaseWorkBinding} from '../../src/case-work/host.js';
const {enabled,backend,python}=dfwFixture();
it.skipIf(!enabled)('real Python source facade admits exact Charlie ordinary child and preserves same-case resume receipt',{timeout:60000},async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'case-source-cold-')));
 try{
  const setup=path.join(dir,'fixture.py');
  await writeFile(setup,[
   'import sys,json','from pathlib import Path','sys.path[:0]=['+JSON.stringify(backend+'/src')+','+JSON.stringify(backend+'/tests')+']',
   'from test_native_case_source import source_fixture','from dfw_incentives.native_case_preparation import PreparedCaseWorkConfiguration',
   'm,db,e,record,doc,quote,actor,task,service,assignment,reserved,Model=source_fixture(Path(sys.argv[1]))',
   "root=Path(sys.argv[1])","(root/'config.json').write_text(PreparedCaseWorkConfiguration(**service.config.model_dump()).model_dump_json())",
   "(root/'metadata.json').write_text(json.dumps({'actor':vars(actor[0]),'task':vars(task[0]),'reserved':reserved,'record':record,'document':doc,'quote':quote,'root_project':e.config.root_project_id,'research_project':e.config.project_id,'applicant':e.config.applicant_slug}))"
  ].join('\n'));
  const prepared=spawnSync(python,[setup,dir],{encoding:'utf8'});expect(prepared.status,prepared.stderr).toBe(0);
  const meta=JSON.parse(await readFile(path.join(dir,'metadata.json'),'utf8')),entrypoint=path.join(dir,'entry.py'),configurationPath=path.join(dir,'config.json');
  await writeFile(entrypoint,'import sys\nsys.path.insert(0,'+JSON.stringify(backend+'/src')+')\nfrom dfw_incentives.native_case_work_stdio import main\nmain()\n');
  const pins=await Promise.all([entrypoint,configurationPath].map(async file=>({path:file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')})));
  const bridge=createBoundedContextBridge<any>({executable:python,args:[entrypoint,'--config',configurationPath],entrypoint,configurationPath,cwd:dir,pins,timeoutMs:30000,maxOutputBytes:4194304},'dfw-native-case-work-v1');
  const rows:any[]=[{id:'root',companyId:'company',projectId:meta.root_project,status:'in_progress',assigneeAgentId:'co'},{id:meta.actor.issue_id,companyId:'company',projectId:'public-cases',parentId:'root',status:'in_progress',assigneeAgentId:'beta',executionRunId:meta.actor.run_id,originKind:'manual',originId:meta.task.origin_id}];
  const docs=new Map<string,any>(),tools=new Map<string,any>();
  const ctx:any={tools:{register:(name:string,_d:any,fn:any)=>tools.set(name,fn)},issues:{get:async(id:string)=>rows.find(r=>r.id===id)??null,getSubtree:async(id:string)=>({companyId:'company',rootIssueId:id,issues:rows,issueIds:rows.map(r=>r.id),activeRuns:Object.fromEntries(rows.filter(r=>r.executionRunId).map(r=>[r.id,[{id:r.executionRunId,issueId:r.id,agentId:r.assigneeAgentId,status:'running',finishedAt:null}]])),assignees:{beta:{id:'beta',status:'running'},charlie:{id:'charlie',status:'running'}}}),documents:{list:async(id:string)=>[...docs.values()].filter(v=>v.issueId===id),get:async(id:string,key:string)=>docs.get(id+':'+key)??null,upsert:async(v:any)=>{docs.set(v.issueId+':'+v.key,v);return v;}}}};
  const binding:CaseWorkBinding={companyId:'company',researchProjectId:meta.research_project,projectId:'public-cases',rootIssueId:'root',rootProjectId:meta.root_project,applicantSlug:meta.applicant,researcher:{agentId:'alpha',principalId:'p-alpha'},producer:{agentId:'beta',principalId:'p-beta'},reviewer:{agentId:'charlie',principalId:'p-charlie'},policyRevision:'policy-1',authorize:async()=>true,bridge};
  registerCaseWork(ctx,[binding],{own:async(_s:any,fn:any)=>fn()});
  const call=async(operation:string,parameters:any,reviewer=false)=>{const r=await tools.get('funding_case_work')({operation,parameters},{companyId:'company',projectId:'public-cases',agentId:reviewer?'charlie':'beta',runId:reviewer?'charlie-run':meta.actor.run_id});return r.data;};
  const current=await call('source_context',{});expect(current.record_id).toBe(meta.record);expect(current.business_complete).toBe(false);
  const evidence={source_document_id:meta.document,start:0,end:meta.quote.length,quote:meta.quote};
  const invalid=await call('source_propose',{context_hash:current.context_hash,fields:[{field:'title',value:'PRIVATE-CANARY',evidence:[]}],requirements:[{requirement:{key:'PROGRAM',sponsor_language:meta.quote,owner_role:'dao',answer_key:'SPONSOR.PROGRAM'},evidence}]}).catch(error=>error);
  expect(invalid).toBeInstanceOf(Error);expect(invalid.message).toContain('case_source_validation_failed');expect(invalid.message).not.toContain('PRIVATE-CANARY');
  for(const [requirement,code] of [
   [{key:'PROGRAM',sponsor_language:'PRIVATE-CANARY paraphrase'},'sponsor_language_quote_mismatch'],
   [{key:'PROGRAM',sponsor_language:meta.quote,verification_status:'verified'},'verified_metadata_incomplete']
  ] as const){
   const invalid=await call('source_propose',{context_hash:current.context_hash,fields:[],requirements:[{requirement,evidence}]}).catch(error=>error);
   expect(invalid).toBeInstanceOf(Error);expect(invalid.message).toContain(code);expect(invalid.message).not.toContain('PRIVATE-CANARY');expect(invalid.message).not.toContain(meta.quote);
  }
  const proposed=await call('source_propose',{context_hash:current.context_hash,fields:[{field:'eligible_applicant_types',value:['nonprofit_501c3'],evidence:[evidence]}],requirements:[{requirement:{key:'PROGRAM',sponsor_language:meta.quote,owner_role:'dao',answer_key:'SPONSOR.PROGRAM'},evidence}]});
  expect(proposed.queued).toBe(false);expect(docs.size).toBe(1);
  rows[1].status='blocked';rows[1].executionRunId='new-owner-run';rows.push({id:'source-review',companyId:'company',projectId:'public-cases',parentId:meta.actor.issue_id,status:'in_progress',assigneeAgentId:'charlie',executionRunId:'charlie-run',originKind:'manual',originId:'paperclip-runner:create-task:'+meta.actor.issue_id+':source-review:'+proposed.proposal_hash});
  const inspected=await call('source_context',{view:'proposal',proposal_hash:proposed.proposal_hash},true);expect(inspected.proposal.actor.run_id).toBe(meta.actor.run_id);
  const accepted=await call('source_review',{proposal_hash:proposed.proposal_hash,decision:'accept',findings:[]},true);expect(accepted.state).toBe('accepted');
  const receipt=await call('source_receipt',{proposal_hash:proposed.proposal_hash},true);expect(receipt.current_admission).toBe(true);expect(receipt.receipt.state).toBe('accepted');
  expect(receipt.case_binding_id).toBe(meta.reserved.case_binding_id);expect(receipt.business_complete).toBe(false);expect(rows[1].status).toBe('blocked');
  const drift=path.join(dir,'drift.py');await writeFile(drift,[
   'import sys,json','sys.path.insert(0,'+JSON.stringify(backend+'/src')+')','from dfw_incentives.db import Database,make_engine','from dfw_incentives.models import SourceRecordCurrent','from dfw_incentives.repository import Repository','from dfw_incentives.schemas import SourceRecord',
   "config=json.load(open(sys.argv[1]))","db=Database(make_engine(config['enrichment']['database_url']))",
   'with db.session() as session:'," row=session.get(SourceRecordCurrent,sys.argv[2])"," source=row.source_id;run=row.last_seen_run_id;record=SourceRecord('opportunity',row.external_id,{**row.data,'title':'Changed current official form'},row.source_document_id)",
   'Repository(db).upsert_source_record(source,record,run_id=run)'
  ].join('\n'));
  const changed=spawnSync(python,[drift,configurationPath,meta.record],{encoding:'utf8'});expect(changed.status,changed.stderr).toBe(0);
  const historical=await call('source_receipt',{proposal_hash:proposed.proposal_hash},true);expect(historical.receipt.state).toBe('accepted');expect(historical.current_admission).toBe(false);expect(historical.currentness).toBe('source_drift');

 }finally{await rm(dir,{recursive:true,force:true});}
});
it.skipIf(!enabled)('real candidate reservation protocol preserves original captured identity and useful preliminary drafting',{timeout:60000},async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'case-candidate-cold-')));
 try{
  const setup=path.join(dir,'fixture.py');await writeFile(setup,[
   'import sys,json','from pathlib import Path','from dataclasses import asdict','sys.path[:0]=['+JSON.stringify(backend+'/src')+','+JSON.stringify(backend+'/tests')+']',
   'from test_native_case_oneoff import candidate_fixture','m,db,service,actor,task,record,record_hash,doc,text=candidate_fixture(Path(sys.argv[1]))',
   "root=Path(sys.argv[1]);(root/'config.json').write_text(service.config.model_dump_json())",
   "(root/'metadata.json').write_text(json.dumps({'actor':asdict(actor[0]),'record':record,'record_hash':record_hash}))"
  ].join('\n'));
  const prepared=spawnSync(python,[setup,dir],{encoding:'utf8'});expect(prepared.status,prepared.stderr).toBe(0);
  const meta=JSON.parse(await readFile(path.join(dir,'metadata.json'),'utf8')),entrypoint=path.join(dir,'entry.py'),configurationPath=path.join(dir,'config.json');
  await writeFile(entrypoint,'import sys\nsys.path.insert(0,'+JSON.stringify(backend+'/src')+')\nfrom dfw_incentives.native_case_work_stdio import main\nmain()\n');
  const pins=await Promise.all([entrypoint,configurationPath].map(async path=>({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')})));
  const bridge=createBoundedContextBridge<any>({executable:python,args:[entrypoint,'--config',configurationPath],entrypoint,configurationPath,cwd:dir,pins,timeoutMs:30000,maxOutputBytes:1048576},'dfw-native-case-work-v1');
  let actor=meta.actor;
  const context=async()=>actor,caseTask=async(request:any)=>({company_id:actor.company_id,project_id:actor.project_id,issue_id:actor.issue_id,parent_id:actor.root_issue_id,assignee_agent_id:actor.agent_id,origin_kind:'manual',origin_id:'paperclip-runner:create-task:'+actor.root_issue_id+':case:'+request.case_binding_id,hidden:false,status:'in_progress',active_run_id:actor.run_id,root_hidden:false,root_status:'in_progress'});
  const params={record_id:meta.record,record_hash:meta.record_hash},reserved:any=await bridge.call('reserve_candidate',params,{context});
  expect(reserved.preliminary).toBe(true);expect(reserved.source_candidate_record_id).toBe(meta.record);expect(reserved.one_off_source_id).toMatch(/^ONEOFF_/);
  const replay:any=await bridge.call('reserve_candidate',params,{context});expect(replay.case_binding_id).toBe(reserved.case_binding_id);
  actor={...actor,project_id:'public-cases',issue_id:'case-one',agent_id:'beta',principal_id:'p-beta',run_id:'beta-one',role:'producer',case_binding_id:reserved.case_binding_id};
  const current:any=await bridge.call('context',{}, {context,caseTask});expect(current.source.agent_ready).toBe(false);
  const saved:any=await bridge.call('checkpoint',{revision_hash:current.revision_hash,previous_checkpoint_hash:null,phase:'draft',artifact_refs:[],note:'Prepare the proposed educational program while validating the exact sponsor form and preserving unknown finance facts.',unresolved:['Actual applicant commitments remain unknown.']},{context,caseTask});
  expect(saved.checkpoint.note).toContain('educational program');expect(saved.business_complete).toBe(false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
