/** Owning-service synthetic fixture; native admissions are explicit fixture transitions. */
import {expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createPublicDraftingBridge} from '../../src/drafting/stdio.js';
import {registerPublicDrafting} from '../../src/drafting/host.js';
import {fixture} from './fixture.js';
const home=process.env.NATIVE_DEPENDENCY_DFW_HOME,python=process.env.NATIVE_DEPENDENCY_PYTHON;
it.skipIf(!home||!python)('reconciles a real cold preparation committed before timeout and reuses its exact selection without duplicate packets',async()=>{
 const root=mkdtempSync(join(tmpdir(),'deadline-cold-'));
 try{
 const metadata=JSON.parse(execFileSync(python!,[join(home!,'tests/native_cycle_transport_fixture.py'),root,'--dependency-handoff'],{env:{...process.env,PYTHONPATH:join(home!,'src')+':'+join(home!,'tests')},encoding:'utf8'}));
 const snapshot=()=>JSON.parse(execFileSync(python!,['-c',`import json,sqlite3,sys
c=json.load(open(sys.argv[1])); p=c['database_url'].split(':///',1)[1]
db=sqlite3.connect('file:'+p+'?mode=ro',uri=True)
rows=db.execute("select id,status,summary from agent_runs where workflow_name='native-initial-packet' order by id").fetchall()
print(json.dumps(dict(selections=[dict(id=r[0],status=r[1]) for r in rows],packets=db.execute('select count(*) from application_packets').fetchone()[0],bindings=db.execute("select count(*) from agent_runs where workflow_name='native-case-run-binding'").fetchone()[0])))`,metadata.configuration_path],{encoding:'utf8',maxBuffer:1024*1024}));
 const baseline=snapshot(),entrypoint=join(home!,'src/dfw_incentives/native_cycle_stdio.py'),configurationPath=metadata.configuration_path,pins=[entrypoint,configurationPath,...['native_cycle.py','public_drafting.py','public_drafting_stdio.py'].map(p=>join(home!,'src/dfw_incentives',p))];
 const bridge=createPublicDraftingBridge({executable:python!,args:[entrypoint,'--config',configurationPath],entrypoint,configurationPath,cwd:home!,timeoutMs:10000,maxOutputBytes:1048576,pins:pins.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))});
 const f=fixture();f.binding.applicantSlug='codex-applicant';f.binding.matchId='initial-packet';f.binding.nativeCaseProgression=true;f.binding.nativeDependencyHandoff=true;f.bridge.call=bridge.call.bind(bridge);f.rows.producer.status='in_progress';f.rows.reviewer.status='done';f.runs.reviewer=[];
 const subtree=f.ctx.issues.getSubtree;f.ctx.issues.getSubtree=async(...args:any[])=>({...await subtree(...args),relations:{[args[0]]:{blockedBy:args[0]==='producer'?[{id:'reviewer',status:f.rows.reviewer.status}]:[],blocks:[]}}});
 let held=false;registerPublicDrafting(f.ctx,[f.binding],{own:async(_:any,work:any)=>{held=true;try{return await work();}finally{held=false;}}} as any);
 const deadline=Date.now()+10000,startedAt=deadline-120000,execution={version:1,role:'producer',companyId:f.producer.companyId,projectId:f.producer.projectId,agentId:f.producer.agentId,runId:f.producer.runId,issueId:'producer',toolName:'netrxn.inertia:funding_drafting_workspace',invocationId:randomUUID(),startedAt,operationDeadlineAt:deadline,rpcDeadlineAt:startedAt+160000,gatewayDeadlineAt:startedAt+170000};
 let release!:()=>void,entered!:()=>void,settled=false;const gate=new Promise<void>(r=>{release=r;}),writing=new Promise<void>(r=>{entered=r;});
 const realCall=f.bridge.call;f.bridge.call=async(...args:any[])=>{const result=await realCall(...args);entered();await gate;return result;};
 const pending=f.tools.get('funding_drafting_workspace')({},{...f.producer,fundingExecution:execution}).then(()=>{settled=true;return null;},(error:any)=>{settled=true;return error;});
 await Promise.race([writing,pending.then((error:any)=>{throw error??Error('No delayed private response');})]);const committed=snapshot();expect(committed.selections).toHaveLength(1);expect(committed.selections[0].status).toBe('success');expect(committed.packets).toBe(baseline.packets);
 await new Promise(r=>setTimeout(r,Math.max(0,deadline-Date.now())+50));try{expect(held).toBe(true);expect(settled).toBe(false);}finally{release();}
 expect((await pending).message).toMatch(/outcome unconfirmed/);expect(held).toBe(false);expect(f.wakeups.size).toBe(0);
 f.bridge.call=realCall;const runId='run-author-reconciled';f.rows.producer.status='in_progress';f.runs.producer=[{id:runId,issueId:'producer',agentId:'author',status:'running',finishedAt:null}];
 const next=await f.tools.get('funding_drafting_workspace')({},{...f.producer,runId});expect(next.data.workspace_hash).toBeTruthy();const replay=snapshot();expect(replay.selections).toEqual(committed.selections);expect(replay.packets).toBe(committed.packets);expect(replay.bindings).toBe(committed.bindings+1);
 }finally{rmSync(root,{recursive:true,force:true});}
},30000);
