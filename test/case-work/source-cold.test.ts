import {expect,it} from 'vitest';
import {mkdtemp,writeFile,readFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {createBoundedContextBridge} from '../../src/bridge/duplex.js';
import {registerCaseWork,type CaseWorkBinding} from '../../src/case-work/host.js';
const backend=process.env.INERTIA_DFW_SOURCE_ROOT??'/tmp/inertia-delivery-20261028/dfw/government-funding-dfw';
const python=process.env.INERTIA_DFW_PYTHON??'/Users/johnroehm/Programming/PythonEnvironments/DFW-Gov-Fund/DFW-Gov-Fund/government-funding-dfw/.venv/bin/python';
it('real Python source facade admits exact Charlie ordinary child and preserves same-case resume receipt',{timeout:60000},async()=>{
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
  const proposed=await call('source_propose',{context_hash:current.context_hash,fields:[{field:'eligible_applicant_types',value:['nonprofit_501c3'],evidence:[evidence]}],requirements:[{requirement:{key:'PROGRAM',sponsor_language:meta.quote,owner_role:'dao',answer_key:'SPONSOR.PROGRAM'},evidence}]});
  expect(proposed.queued).toBe(false);expect(docs.size).toBe(1);
  rows[1].status='blocked';rows[1].executionRunId='new-owner-run';rows.push({id:'source-review',companyId:'company',projectId:'public-cases',parentId:meta.actor.issue_id,status:'in_progress',assigneeAgentId:'charlie',executionRunId:'charlie-run',originKind:'manual',originId:'paperclip-runner:create-task:'+meta.actor.issue_id+':source-review:'+proposed.proposal_hash});
  const inspected=await call('source_context',{view:'proposal',proposal_hash:proposed.proposal_hash},true);expect(inspected.proposal.actor.run_id).toBe(meta.actor.run_id);
  const accepted=await call('source_review',{proposal_hash:proposed.proposal_hash,decision:'accept',findings:[]},true);expect(accepted.state).toBe('accepted');
  const receipt=await call('source_receipt',{proposal_hash:proposed.proposal_hash},true);expect(receipt.current_admission).toBe(true);expect(receipt.receipt.state).toBe('accepted');
  expect(receipt.case_binding_id).toBe(meta.reserved.case_binding_id);expect(receipt.business_complete).toBe(false);expect(rows[1].status).toBe('blocked');
 }finally{await rm(dir,{recursive:true,force:true});}
});
