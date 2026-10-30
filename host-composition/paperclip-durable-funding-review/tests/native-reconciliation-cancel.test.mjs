import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import{pathToFileURL}from'node:url';import{randomUUID}from'node:crypto';
const publicRoot=process.env.QUALIFICATION_PUBLIC_ROOT??'/opt/inertia-reviewed';const{nativeDatabase,nativeIdentityFixture,loadNative,schema,eq}=await import(pathToFileURL(path.join(publicRoot,'scripts/drafting-qualification/native-fixture.mjs')));
const{issueRoutes}=await loadNative('@paperclipai/server/dist/routes/issues.js');const{default:express}=await loadNative('express/index.js');
const note='Withdraw obsolete undelivered synthetic continuation; later work is separately preserved.';
const request=f=>({actionId:f.actionId,withdrawPendingDelivery:true,outcome:'cancelled',sourceIssueStatus:'todo',resolutionNote:note});
async function post(f,body=request(f)){const response=await fetch(f.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return{status:response.status,body:await response.json()};}
async function rows(f){return {issue:(await f.db.select().from(schema.issues).where(eq(schema.issues.id,f.producer.issueId)))[0],action:(await f.db.select().from(schema.issueRecoveryActions).where(eq(schema.issueRecoveryActions.id,f.actionId)))[0],wakes:await f.db.select().from(schema.agentWakeupRequests),runs:await f.db.select().from(schema.heartbeatRuns)};}
async function fixture(actorOverride){const f=await nativeDatabase(),ids=await nativeIdentityFixture(f.db),actionId=randomUUID();await f.db.update(schema.agents).set({status:'paused'});await f.db.update(schema.heartbeatRuns).set({status:'cancelled',startedAt:null,finishedAt:new Date(),errorCode:'agent_paused'}).where(eq(schema.heartbeatRuns.id,ids.producer.runId));await f.db.update(schema.issues).set({status:'todo',executionRunId:null,checkoutRunId:null}).where(eq(schema.issues.id,ids.producer.issueId));const originalEvidence={runId:ids.producer.runId,executionReconciliation:{runId:ids.producer.runId,providerStopped:true,actionOutcome:'not_performed',outcomeEvidence:'Synthetic queued admission never dispatched.'},continuationDelivery:'pending'};await f.db.insert(schema.issueRecoveryActions).values({id:actionId,companyId:ids.companyId,sourceIssueId:ids.producer.issueId,kind:'active_run_watchdog',status:'resolved',ownerType:'board',returnOwnerAgentId:ids.producer.agentId,cause:'legacy_execution_requires_reconciliation',fingerprint:randomUUID(),evidence:originalEvidence,nextAction:'Synthetic restored task',outcome:'handed_back',resolutionNote:'Prior verified recovery',resolvedAt:new Date()});const app=express();app.use(express.json());app.use((req,_res,next)=>{req.actor=actorOverride?actorOverride(ids):{type:'board',userId:'local-board',source:'local_implicit',isInstanceAdmin:true,companyIds:[ids.companyId]};next();});app.use('/api',issueRoutes(f.db,{}, {recoveryActionEnqueueWakeup:()=>{throw Error('Cancellation must not wake');}}));app.use((error,_req,res,_next)=>res.status(error.status??(error.name==='ZodError'?400:500)).json({error:error.message}));const listener=app.listen(0,'127.0.0.1');await new Promise(r=>listener.once('listening',r));return{...f,...ids,actionId,originalEvidence,url:'http://127.0.0.1:'+listener.address().port+'/api/issues/'+ids.producer.issueId+'/recovery-actions/resolve',listener,async close(){listener.closeAllConnections();await new Promise(r=>listener.close(r));await f.client.close();}};}
test('board cancellation withdraws only an undelivered settled reconciliation while preserving the task and original evidence',async()=>{const f=await fixture();try{const before=(await f.db.select().from(schema.issues).where(eq(schema.issues.id,f.producer.issueId)))[0];const r=await fetch(f.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({actionId:f.actionId,withdrawPendingDelivery:true,outcome:'cancelled',sourceIssueStatus:'todo',resolutionNote:'Withdraw obsolete undelivered synthetic continuation; later work is separately preserved.'})});const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));assert.equal(body.recoveryAction.status,'cancelled');assert.equal(body.recoveryAction.evidence.continuationDelivery,'cancelled');assert.deepEqual(body.recoveryAction.evidence.executionReconciliation,f.originalEvidence.executionReconciliation);const after=(await f.db.select().from(schema.issues).where(eq(schema.issues.id,f.producer.issueId)))[0];assert.deepEqual(after,before);assert.equal((await f.db.select().from(schema.agentWakeupRequests)).length,0);assert.equal((await f.db.select().from(schema.heartbeatRuns)).length,2);}finally{await f.close();}});

test('withdrawal preserves original disposition and evidence, replays one receipt and audits once',async()=>{const f=await fixture();try{
 const before=await rows(f),first=await post(f);assert.equal(first.status,200,JSON.stringify(first.body));assert.equal(first.body.replayed,false);
 const withdrawal=first.body.recoveryAction.evidence.continuationDeliveryWithdrawal;
 assert.equal(withdrawal.version,1);assert.equal(withdrawal.actionId,f.actionId);assert.equal(withdrawal.companyId,f.companyId);assert.equal(withdrawal.issueId,f.producer.issueId);assert.equal(withdrawal.actorId,'local-board');assert.equal(withdrawal.resolutionNote,note);assert(!Number.isNaN(Date.parse(withdrawal.recordedAt)));
 assert.deepEqual(withdrawal.prior,{status:before.action.status,outcome:before.action.outcome,resolutionNote:before.action.resolutionNote,resolvedAt:before.action.resolvedAt.toISOString(),evidence:f.originalEvidence});
 const second=await post(f);assert.equal(second.status,200,JSON.stringify(second.body));assert.equal(second.body.replayed,true);assert.deepEqual(second.body.recoveryAction,first.body.recoveryAction);
 const after=await rows(f);assert.deepEqual(after.issue,before.issue);assert.deepEqual(after.runs,before.runs);assert.deepEqual(after.wakes,before.wakes);
 const audit=await f.db.select().from(schema.activityLog).where(eq(schema.activityLog.action,'issue.recovery_action_resolved'));assert.equal(audit.length,1);
}finally{await f.close();}});

test('withdrawal strictly validates its explicit opt-in without relaxing ordinary cancellation',async()=>{const f=await fixture();try{
 for(const change of [{withdrawPendingDelivery:false},{withdrawPendingDelivery:'true'},{actionId:undefined},{outcome:'restored'},{resolutionNote:'short'},{resolutionNote:null},{executionReconciliation:f.originalEvidence.executionReconciliation},{withdrawPendingDelivery:undefined}]){
  const before=await rows(f),r=await post(f,{...request(f),...change});assert.equal(r.status,400,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
 }
 const before=await rows(f),r=await post(f,{...request(f),sourceIssueStatus:'in_review'});assert.equal(r.status,409,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
}finally{await f.close();}});

test('active, non-pending, unrelated, missing-evidence and replay-blocked actions cannot be withdrawn',async()=>{const f=await fixture();try{
 const initial=(await rows(f)).action;
 for(const change of [{status:'active'},{status:'cancelled'},{kind:'deliberate_wait_without_target'},{cause:'agent_paused'},{evidence:{...f.originalEvidence,executionReconciliation:undefined}},{evidence:{...f.originalEvidence,continuationDelivery:'delivered'}},{evidence:{...f.originalEvidence,continuationDelivery:'delegated'}},{evidence:{...f.originalEvidence,automaticRecovery:{replay:'blocked'}}}]){
  await f.db.update(schema.issueRecoveryActions).set({status:initial.status,kind:initial.kind,cause:initial.cause,evidence:f.originalEvidence,...change}).where(eq(schema.issueRecoveryActions.id,f.actionId));
  const before=await rows(f),r=await post(f);assert.equal(r.status,409,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
 }
}finally{await f.close();}});

test('any exact non-skipped or linked wake prevents withdrawal, while skipped-only unlinked delivery can be withdrawn',async()=>{const f=await fixture();try{
 for(const [status,runId]of [['queued',null],['coalesced',null],['skipped',f.reviewer.runId],['skipped',null]]){
  const [wake]=await f.db.insert(schema.agentWakeupRequests).values({companyId:f.companyId,agentId:f.producer.agentId,source:'automation',triggerDetail:'system',reason:'issue_recovery_action_restored',status,runId,idempotencyKey:'execution-reconciliation:'+f.actionId,payload:{issueId:f.producer.issueId,recoveryActionId:f.actionId}}).returning();
  const before=await rows(f),r=await post(f);assert.equal(r.status,status==='skipped'&&!runId?200:409,JSON.stringify(r.body));
  if(r.status!==200)assert.deepEqual(await rows(f),before);
  await f.db.delete(schema.agentWakeupRequests).where(eq(schema.agentWakeupRequests.id,wake.id));
 }
}finally{await f.close();}});

test('a directly bound historical heartbeat run is uncertain delivery even without an exact wake',async()=>{const f=await fixture();try{
 await f.db.update(schema.heartbeatRuns).set({contextSnapshot:{issueId:f.reviewer.issueId,recoveryActionId:f.actionId}}).where(eq(schema.heartbeatRuns.id,f.reviewer.runId));
 const before=await rows(f),r=await post(f);assert.equal(r.status,409,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
}finally{await f.close();}});

test('an action ID from another company cannot be withdrawn through this issue',async()=>{const f=await fixture();try{
 await f.db.update(schema.companies).set({issuePrefix:'QDP'}).where(eq(schema.companies.id,f.companyId));const other=await nativeIdentityFixture(f.db),id=randomUUID();await f.db.insert(schema.issueRecoveryActions).values({id,companyId:other.companyId,sourceIssueId:other.producer.issueId,kind:'active_run_watchdog',status:'resolved',ownerType:'board',cause:'legacy_execution_requires_reconciliation',fingerprint:randomUUID(),evidence:f.originalEvidence,nextAction:'Synthetic',outcome:'handed_back',resolvedAt:new Date()});
 const before=await rows(f),foreign=await f.db.select().from(schema.issueRecoveryActions).where(eq(schema.issueRecoveryActions.id,id));const r=await post(f,{...request(f),actionId:id});assert.equal(r.status,404,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);assert.deepEqual(await f.db.select().from(schema.issueRecoveryActions).where(eq(schema.issueRecoveryActions.id,id)),foreign);
}finally{await f.close();}});

test('an agent cannot use the board-only withdrawal branch',async()=>{const f=await fixture(ids=>({type:'agent',agentId:ids.producer.agentId,companyId:ids.companyId,runId:ids.producer.runId,source:'agent_jwt'}));try{
 const before=await rows(f),r=await post(f);assert.equal(r.status,403,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
}finally{await f.close();}});

test('withdrawing old delivery preserves a newer active recovery hold in storage and response',async()=>{const f=await fixture();try{
 const [hold]=await f.db.insert(schema.issueRecoveryActions).values({id:randomUUID(),companyId:f.companyId,sourceIssueId:f.producer.issueId,kind:'active_run_watchdog',status:'active',ownerType:'board',cause:'legacy_execution_requires_reconciliation',fingerprint:randomUUID(),evidence:{automaticRecovery:{replay:'blocked'}},nextAction:'Do not clear synthetic uncertainty hold'}).returning();
 const r=await post(f);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.issue.activeRecoveryAction.id,hold.id);
 assert.deepEqual((await f.db.select().from(schema.issueRecoveryActions).where(eq(schema.issueRecoveryActions.id,hold.id)))[0],hold);
 const replay=await post(f);assert.equal(replay.status,200);assert.equal(replay.body.replayed,true);assert.equal(replay.body.issue.activeRecoveryAction.id,hold.id);
}finally{await f.close();}});

test('malformed foreign-company delivery references neither block nor mutate the authoritative company withdrawal',async()=>{const f=await fixture();try{
 await f.db.update(schema.companies).set({issuePrefix:'QDP'}).where(eq(schema.companies.id,f.companyId));
 const other=await nativeIdentityFixture(f.db);
 const [wake]=await f.db.insert(schema.agentWakeupRequests).values({companyId:other.companyId,agentId:other.producer.agentId,source:'automation',triggerDetail:'system',reason:'issue_recovery_action_restored',status:'queued',runId:other.producer.runId,idempotencyKey:'execution-reconciliation:'+f.actionId,payload:{issueId:other.producer.issueId,recoveryActionId:f.actionId}}).returning();
 const [run]=await f.db.update(schema.heartbeatRuns).set({contextSnapshot:{issueId:other.producer.issueId,recoveryActionId:f.actionId}}).where(eq(schema.heartbeatRuns.id,other.producer.runId)).returning();
 const before=await rows(f),r=await post(f);assert.equal(r.status,200,JSON.stringify(r.body));
 assert.deepEqual((await f.db.select().from(schema.agentWakeupRequests).where(eq(schema.agentWakeupRequests.id,wake.id)))[0],wake);
 assert.deepEqual((await f.db.select().from(schema.heartbeatRuns).where(eq(schema.heartbeatRuns.id,run.id)))[0],run);
 const after=await rows(f);assert.deepEqual(after.issue,before.issue);assert.deepEqual(after.wakes,before.wakes);assert.deepEqual(after.runs,before.runs);
}finally{await f.close();}});

test('concurrent duplicate HTTP withdrawals serialize to one receipt and one audit without changing the task',async()=>{const f=await fixture();try{
 const before=await rows(f),responses=await Promise.all([post(f),post(f)]);
 for(const r of responses)assert.equal(r.status,200,JSON.stringify(r.body));
 assert.deepEqual(responses.map(r=>r.body.replayed).sort(),[false,true]);
 assert.deepEqual(responses[0].body.recoveryAction,responses[1].body.recoveryAction);
 const audit=await f.db.select().from(schema.activityLog).where(eq(schema.activityLog.action,'issue.recovery_action_resolved'));assert.equal(audit.length,1);
 const after=await rows(f);assert.deepEqual(after.issue,before.issue);assert.deepEqual(after.runs,before.runs);assert.deepEqual(after.wakes,before.wakes);
}finally{await f.close();}});
