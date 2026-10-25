/** Exercises the real native heartbeat -> process adapter -> HTTP auth path. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import express from 'express';
import {issueRoutes} from './node_modules/@paperclipai/server/dist/routes/issues.js';
import {actorMiddleware,memberAttemptPreparseGuard} from './node_modules/@paperclipai/server/dist/middleware/auth.js';
import {heartbeatService} from './node_modules/@paperclipai/server/dist/services/heartbeat.js';
import {createMemberAttemptAuthority} from './member/attempt-authority.mjs';
import {createNativeMemberAuthenticator} from './member/native-auth.mjs';
import {createContributionIngress} from './plugin/dist/src/contributions/ingress.js';
import {createContributionBoundary} from './plugin/dist/src/contributions/service.js';
import {createNativeContributionReader,nativeTaskRevision} from './plugin/dist/src/contributions/native.js';
export async function checkMemberHook({db,sql,companyId,services,issueService,journal}) {
 const native=issueService(db),projectId=randomUUID();await sql`INSERT INTO projects(id,company_id,name) VALUES (${projectId},${companyId},'Synthetic actual heartbeat hook')`;
 const ctx={issues:{get:(issueId,companyId)=>services.issues.get({issueId,companyId}),summaries:{getOrchestration:p=>services.issues.getOrchestrationSummary(p)}},agents:{get:(agentId,companyId)=>services.agents.get({agentId,companyId})}};
 const outcomes=[];
 for(const mode of ['opted-in','default','cancel-before-dispatch']) {
  const memberId='synthetic-spawn-'+randomUUID(),agentId=randomUUID();
  await sql`INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES (${memberId},'Synthetic native process member',${memberId+'@example.invalid'},false,now(),now())`;
  await sql`INSERT INTO company_memberships(company_id,principal_type,principal_id,status,membership_role) VALUES (${companyId},'user',${memberId},'active','member')`;
  const marker=process.cwd()+'/member-spawn-'+mode+'.json',script=process.cwd()+'/member-spawn-'+mode+'.mjs';
  const issue=await native.create(companyId,{title:'Synthetic heartbeat member task',projectId,status:'todo',priority:'medium',responsibleUserId:memberId,createdByUserId:memberId});
  const scope={companyId,projectId,issueId:issue.id,agentId,memberId},authority=createMemberAttemptAuthority({db,scopes:[scope]});let enrollment=null,beginCalls=0,assertCalls=0;
  const hooks={
   async begin(input){beginCalls++;const attempt=await authority.begin(input);if(attempt){enrollment={...scope,...attempt,enabled:true,active:true,taskRevision:null,checkoutRunId:input.runId,providerLeaseId:'synthetic-process-provider',lifecycleGeneration:'synthetic-process-generation',lifecycleDisposition:'active',enrollmentRevision:'synthetic-enrollment',expiresAt:Date.now()+600000,dataClass:'approved-public',artifactClass:'text-evidence',input:'Approved native process task'};}return attempt;},
   async assertCurrent(attempt){assertCalls++;if(mode==='cancel-before-dispatch')await sql`UPDATE heartbeat_runs SET result_json=${sql.json({executionCancellation:{state:'requested'}})}::jsonb WHERE id=${attempt.runId}`;await authority.assertCurrent(attempt);},
   finish:authority.finish,
  };
  const boundary=createContributionBoundary({enabled:()=>true,clock:Date.now,loadEnrollment:async(actor,issueId)=>{
   const current=await authority.readCurrent(actor,issueId);if(current&&enrollment&&enrollment.taskRevision===null)enrollment.taskRevision=nativeTaskRevision(await native.getById(issueId));return current&&enrollment?structuredClone(enrollment):null;
  },readNative:createNativeContributionReader(ctx,scope),journal});
  const app=express();
  const ingress=createContributionIngress({enabled:()=>true,boundary,authenticate:createNativeMemberAuthenticator({db,authority})});app.use('/api/member-contributions',(req,res)=>void ingress(req,res));
  app.use(memberAttemptPreparseGuard(db,{deploymentMode:'authenticated',memberAttemptAuthority:authority}));
  app.use(express.json({limit:4096}));
  app.use((req,res,next)=>{const send=res.json.bind(res);res.json=value=>{if(enrollment&&req.originalUrl===`/api/issues/${issue.id}/checkout`&&value?.id===issue.id)enrollment.taskRevision=nativeTaskRevision(value);return send(value);};next();});
  app.use('/api',actorMiddleware(db,{deploymentMode:'authenticated',memberAttemptAuthority:authority}),issueRoutes(db,undefined,{memberAttemptAuthority:authority}));
  app.use((error,_req,res,_next)=>res.status(error.status??500).json({error:'native_request_rejected'}));
  const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const endpoint=`http://127.0.0.1:${server.address().port}/api/member-contributions/export`;
  await writeFile(script,`import {writeFile} from 'node:fs/promises';const token=process.env.PAPERCLIP_API_KEY;const claims=token?JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()):{};const checkout=await fetch(${JSON.stringify(endpoint.replace('/api/member-contributions/export','/api/issues/'+issue.id+'/checkout'))},{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({agentId:${JSON.stringify(agentId)},expectedStatuses:['todo','in_progress']})});if(checkout.status!==200)throw Error('Synthetic native checkout failed');const checkoutResult=await checkout.json();const checkoutReceiptOnly=Object.keys(checkoutResult).join(',')==='state'&&checkoutResult.state==='checked-out';if(checkoutReceiptOnly!==${mode==='default'?false:true})throw Error('Synthetic checkout response boundary failed');const response=await fetch(${JSON.stringify(endpoint)},{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({issueId:${JSON.stringify(issue.id)}})});const result=await response.json();await writeFile(${JSON.stringify(marker)},JSON.stringify({status:response.status,state:result.state??null,hasJti:typeof claims.jti==='string',checkoutReceiptOnly}));if(response.status!==${mode==='default'?403:200})process.exitCode=1;`);
  await sql`INSERT INTO agents(id,company_id,name,status,adapter_type,adapter_config,runtime_config) VALUES (${agentId},${companyId},'Synthetic actual process adapter','idle','process',${sql.json({command:process.execPath,args:[script],cwd:process.cwd(),timeoutSec:30})}::jsonb,'{}')`;
  await sql`UPDATE issues SET assignee_agent_id=${agentId} WHERE id=${issue.id}`;
  const heartbeat=heartbeatService(db,mode==='default'?{}:{memberAttemptAuthority:hooks});
  try {
   const run=await heartbeat.invoke(agentId,'on_demand',{issueId:issue.id},'manual',{actorType:'user',actorId:memberId});assert.ok(run,'native heartbeat creates a run');
   await heartbeat.drainActiveRunExecutions(); // Native owning-service drain includes queued setup and finalization, not only a spawned process.
   const [saved]=await sql`SELECT status,error_code,error FROM heartbeat_runs WHERE id=${run.id}`;
   if(mode==='cancel-before-dispatch'){
    assert.equal(await readFile(marker,'utf8').catch(()=>null),null,'cancelled attempt never enters actual process adapter');assert.ok(beginCalls>=1);assert.equal(assertCalls,beginCalls);
   }else {
    assert.equal(saved.status,'succeeded',JSON.stringify(saved));const result=JSON.parse(await readFile(marker,'utf8'));assert.deepEqual(result,mode==='default'?{status:403,state:null,hasJti:false,checkoutReceiptOnly:false}:{status:200,state:'input',hasJti:true,checkoutReceiptOnly:true});
    assert.ok(mode==='default'?beginCalls===0:beginCalls>=1);assert.equal(assertCalls,beginCalls);
   }
   assert.equal((await native.getById(issue.id)).status,mode==='cancel-before-dispatch'?'todo':'in_progress','native task is not completed: '+mode);outcomes.push(mode);
  }finally{await new Promise(r=>{server.closeAllConnections();server.close(r);});}
 }
 console.log('NATIVE_MEMBER_HEARTBEAT_HOOK_PASSED',JSON.stringify({actualNativeProcessAdapter:true,modes:outcomes,liveProvider:false,taskCompletion:false}));
}
