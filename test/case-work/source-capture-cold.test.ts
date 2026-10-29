import {expect,it} from 'vitest';
import {mkdtemp,writeFile,readFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {createBoundedContextBridge} from '../../src/bridge/duplex.js';
import {registerCaseWork,type CaseWorkBinding} from '../../src/case-work/host.js';
const backend=process.env.INERTIA_DFW_SOURCE_ROOT;
if(!backend)throw Error('Explicit reviewed INERTIA_DFW_SOURCE_ROOT required for capture boundary qualification');
const python=process.env.INERTIA_DFW_PYTHON??'/Users/johnroehm/Programming/PythonEnvironments/DFW-Gov-Fund/DFW-Gov-Fund/government-funding-dfw/.venv/bin/python';
it('actual HTTP403 through case handler, real stdio and bridge preserves finite feedback without retrying intent',{timeout:60000},async()=>{
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
  await writeFile(entrypoint,[
   'import sys,httpx','from pathlib import Path','sys.path[:0]=['+JSON.stringify(backend+'/src')+','+JSON.stringify(backend+'/tests')+']',
   'from test_general_enrichment_capture import Peer,allow_public','from dfw_incentives import fetcher',
   'real_client=httpx.AsyncClient','def respond(request):',
   ' with Path('+JSON.stringify(path.join('FIXTURE_PATH','requests.txt'))+').open("a") as f:f.write("request\\n")',
   ' return httpx.Response(403,text="PRIVATE-CANARY source body https://private.invalid/secret",headers={"content-type":"text/html"},extensions={"network_stream":Peer()})',
   'httpx.AsyncClient=lambda **kwargs:real_client(transport=httpx.MockTransport(respond))',
   'fetcher.validate_public_http_url=allow_public','from dfw_incentives.native_case_work_stdio import main','main()'
  ].join('\n').replaceAll('FIXTURE_PATH',dir));
  const pins=await Promise.all([entrypoint,configurationPath].map(async file=>({path:file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')})));
  const bridge=createBoundedContextBridge<any>({executable:python,args:[entrypoint,'--config',configurationPath],entrypoint,configurationPath,cwd:dir,pins,timeoutMs:30000,maxOutputBytes:4194304},'dfw-native-case-work-v1');
  const rows:any[]=[{id:'root',companyId:'company',projectId:meta.root_project,status:'in_progress',assigneeAgentId:'co'},{id:meta.actor.issue_id,companyId:'company',projectId:'public-cases',parentId:'root',status:'in_progress',assigneeAgentId:'beta',executionRunId:meta.actor.run_id,originKind:'manual',originId:meta.task.origin_id}];
  const docs=new Map<string,any>(),tools=new Map<string,any>();
  const ctx:any={tools:{register:(name:string,_d:any,fn:any)=>tools.set(name,fn)},issues:{get:async(id:string)=>rows.find(r=>r.id===id)??null,getSubtree:async(id:string)=>({companyId:'company',rootIssueId:id,issues:rows,issueIds:rows.map(r=>r.id),activeRuns:Object.fromEntries(rows.filter(r=>r.executionRunId).map(r=>[r.id,[{id:r.executionRunId,issueId:r.id,agentId:r.assigneeAgentId,status:'running',finishedAt:null}]])),assignees:{beta:{id:'beta',status:'running'},charlie:{id:'charlie',status:'running'}}}),documents:{list:async(id:string)=>[...docs.values()].filter(v=>v.issueId===id),get:async(id:string,key:string)=>docs.get(id+':'+key)??null,upsert:async(v:any)=>{docs.set(v.issueId+':'+v.key,v);return v;}}}};
  const binding:CaseWorkBinding={companyId:'company',researchProjectId:meta.research_project,projectId:'public-cases',rootIssueId:'root',rootProjectId:meta.root_project,applicantSlug:meta.applicant,researcher:{agentId:'alpha',principalId:'p-alpha'},producer:{agentId:'beta',principalId:'p-beta'},reviewer:{agentId:'charlie',principalId:'p-charlie'},policyRevision:'policy-1',authorize:async()=>true,bridge};
  registerCaseWork(ctx,[binding],{own:async(_s:any,fn:any)=>fn()});
  const call=async(operation:string,parameters:any,reviewer=false)=>{const r=await tools.get('funding_case_work')({operation,parameters},{companyId:'company',projectId:'public-cases',agentId:reviewer?'charlie':'beta',runId:reviewer?'charlie-run':meta.actor.run_id});return r.data;};
  const first=await call('source_capture',{url:'https://sponsor.example/notice'}).catch(error=>error);
  expect(first).toBeInstanceOf(Error);expect(first.message).toBe('DFW drafting rejected request: {"code":"capture_failed","details":{"code":"http_status","http_status":403}}');expect(first.message).not.toContain('PRIVATE-CANARY');expect(first.message).not.toContain('https://');
  const retry=await call('source_capture',{url:'https://sponsor.example/notice'}).catch(error=>error);expect(retry.message).toBe('DFW drafting rejected request');
  const policy=await call('source_capture',{url:'https://sponsor.example/not-linked'}).catch(error=>error);expect(policy.message).toBe('DFW drafting rejected request');
  expect(await readFile(path.join(dir,'requests.txt'),'utf8')).toBe('request\n');
 }finally{await rm(dir,{recursive:true,force:true});}
});
