// Real pinned native wake builder and prompt renderer, synthetic SQL rows only.
import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';
const root=process.env.QUALIFICATION_PUBLIC_ROOT??'/qual/source';
const {nativeDatabase,nativeIdentityFixture,loadNative,schema,eq}=await import(pathToFileURL(path.join(root,'scripts/drafting-qualification/native-fixture.mjs')));
const {buildPaperclipWakePayload,shouldResetTaskSessionForWake}=await loadNative('@paperclipai/server/dist/services/heartbeat.js');
const {renderPaperclipWakePrompt,selectPaperclipTaskMarkdown}=await loadNative('@paperclipai/adapter-utils/dist/server-utils.js');
async function fixture(){
 const f=await nativeDatabase(),ids=await nativeIdentityFixture(f.db),actionId=randomUUID();
 await f.db.update(schema.issues).set({description:'Call funding_review_context({}) to load the authoritative pending candidate.'}).where(eq(schema.issues.id,ids.reviewer.issueId));
 const [action]=await f.db.insert(schema.issueRecoveryActions).values({id:actionId,companyId:ids.companyId,sourceIssueId:ids.reviewer.issueId,kind:'deliberate_wait_without_target',status:'resolved',ownerType:'board',ownerUserId:'fixture-board',previousOwnerAgentId:ids.reviewer.agentId,returnOwnerAgentId:ids.reviewer.agentId,cause:'deliberate_wait_without_target',fingerprint:randomUUID(),evidence:{sourceIssueId:ids.reviewer.issueId},nextAction:'STALE_REPAIR_INSTRUCTION: repair the disposition and resolve the recovery action.',outcome:'handed_back',resolutionNote:'Operator reconciled the repair and returned the existing funding task.',resolvedAt:new Date()}).returning();
 const context={issueId:ids.reviewer.issueId,taskId:ids.reviewer.issueId,recoveryActionId:actionId,wakeReason:'issue_recovery_action_restored',source:'issue.recovery_action_resolution'};
 const input={db:f.db,companyId:ids.companyId,agentId:ids.reviewer.agentId,runId:ids.reviewer.runId,contextSnapshot:context};
 return {...f,...ids,action,context,input};
}
async function stored(f){return{actions:await f.db.select().from(schema.issueRecoveryActions),issues:await f.db.select().from(schema.issues),runs:await f.db.select().from(schema.heartbeatRuns),wakes:await f.db.select().from(schema.agentWakeupRequests)};}

test('an exact settled hand-back wake resumes the source task without obsolete recovery instructions or state mutation',async()=>{
 const f=await fixture();try{
  const before=await stored(f),wake=await buildPaperclipWakePayload(f.input);assert.equal(wake.recovery,null);
  assert.equal(wake.reason,'issue_recovery_action_restored');assert.equal(wake.issue.id,f.reviewer.issueId);assert.match(wake.issue.description,/funding_review_context/);
  const prompt=renderPaperclipWakePrompt(wake,{resumedSession:false});assert.doesNotMatch(prompt,/RECOVER this task|STALE_REPAIR_INSTRUCTION|resolve call's `resolutionNote`/);assert.match(prompt,/funding_review_context/);
  const full='Authoritative current funding review task: call funding_review_context({}) and independently review the pending candidate.';
  const context={paperclipTaskMarkdownAssignment:full,paperclipTaskMarkdownAssignmentCompact:'COMPACT_WITHOUT_CURRENT_TASK',paperclipWake:wake};
  for(const resumedSession of [false,true])assert.equal(selectPaperclipTaskMarkdown(context,{resumedSession,includeCommunicationGuidance:false}),full);
  assert.deepEqual(await stored(f),before);
 }finally{await f.client.close();}
});

test('active, unsettled, other-cause, other-owner, cross-issue and mismatched wakes retain recovery projection',async()=>{
 const f=await fixture();try{
  const [source]=await f.db.select().from(schema.issues).where(eq(schema.issues.id,f.reviewer.issueId));
  const cases=[
   {action:{status:'active',resolvedAt:null}}, {action:{status:'escalated',resolvedAt:null}}, {action:{status:'cancelled'}},
   {action:{outcome:'restored'}}, {action:{resolvedAt:null}}, {action:{kind:'active_run_watchdog'}}, {action:{cause:'agent_paused'}},
   {action:{returnOwnerAgentId:f.producer.agentId}}, {action:{returnOwnerAgentId:null}}, {action:{sourceIssueId:f.producer.issueId}},
   {issue:{assigneeAgentId:f.producer.agentId}}, {issue:{status:'blocked'}}, {issue:{status:'done'}}, {issue:{status:'cancelled'}},
   {action:{evidence:{automaticRecovery:{replay:'blocked'}}}},
   {context:{source:'manual'}}, {context:{wakeReason:'source_scoped_recovery_action'}}, {context:{taskId:f.producer.issueId}},
   {context:{recoveryCause:'unreconciled_other_cause'}}, {input:{agentId:f.producer.agentId}},
  ];
  for(const c of cases){
   await f.db.update(schema.issueRecoveryActions).set({...f.action,...c.action}).where(eq(schema.issueRecoveryActions.id,f.action.id));
   await f.db.update(schema.issues).set({...source,...c.issue}).where(eq(schema.issues.id,f.reviewer.issueId));
   const input={...f.input,...c.input,contextSnapshot:{...f.context,...c.context}},before=await stored(f),wake=await buildPaperclipWakePayload(input);
   assert(wake.recovery,JSON.stringify(c));assert.deepEqual(await stored(f),before);
  }
 }finally{await f.client.close();}
});

test('a newer active hold prevents suppressing recovery even when the referenced older action was handed back',async()=>{
 const f=await fixture();try{
  await f.db.insert(schema.issueRecoveryActions).values({companyId:f.companyId,sourceIssueId:f.reviewer.issueId,kind:'deliberate_wait_without_target',status:'active',ownerType:'board',returnOwnerAgentId:f.reviewer.agentId,cause:'deliberate_wait_without_target',fingerprint:randomUUID(),evidence:{},nextAction:'Current board hold must remain authoritative.'});
  const before=await stored(f),wake=await buildPaperclipWakePayload(f.input);assert(wake.recovery);assert.deepEqual(await stored(f),before);
 }finally{await f.client.close();}
});

test('fresh assignee scope is authoritative over an optional supplied issue summary',async()=>{
 const f=await fixture();try{
  const [summary]=await f.db.select().from(schema.issues).where(eq(schema.issues.id,f.reviewer.issueId));
  await f.db.update(schema.issues).set({assigneeAgentId:f.producer.agentId}).where(eq(schema.issues.id,f.reviewer.issueId));
  const wake=await buildPaperclipWakePayload({...f.input,issueSummary:summary});assert(wake.recovery);
 }finally{await f.client.close();}
});

test('foreign company action metadata cannot suppress or leak recovery details into this task',async()=>{
 const f=await fixture();try{
  const [foreign]=await f.db.insert(schema.companies).values({name:'Foreign fixture',issuePrefix:'FHB'}).returning();
  await f.db.update(schema.issueRecoveryActions).set({companyId:foreign.id}).where(eq(schema.issueRecoveryActions.id,f.action.id));
  const wake=await buildPaperclipWakePayload({...f.input,contextSnapshot:{...f.context,recoveryCause:'deliberate_wait_without_target'}});assert(wake.recovery);assert.equal(wake.recovery.nextAction,null);assert.doesNotMatch(renderPaperclipWakePrompt(wake),/STALE_REPAIR_INSTRUCTION/);
 }finally{await f.client.close();}
});

test('existing resolved execution-reconciliation projection remains suppressed',async()=>{
 const f=await fixture();try{
  await f.db.update(schema.issueRecoveryActions).set({kind:'active_run_watchdog',evidence:{executionReconciliation:{providerStopped:true}},outcome:'restored'}).where(eq(schema.issueRecoveryActions.id,f.action.id));
  assert.equal((await buildPaperclipWakePayload(f.input)).recovery,null);
 }finally{await f.client.close();}
});

test('restored hand-back wake does not itself request a fresh task session; explicit fresh-session semantics remain supported',()=>{
 const context={wakeReason:'issue_recovery_action_restored',source:'issue.recovery_action_resolution'};
 assert.equal(shouldResetTaskSessionForWake(context),false);assert.equal(shouldResetTaskSessionForWake({...context,forceFreshSession:true}),true);
});
