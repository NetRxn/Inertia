// Real pinned recovery service and SQL; synthetic identities, no provider or live state.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
if(process.env.QUALIFY_DISPOSABLE!=='1'){
 test('requires disposable embedded PostgreSQL',{skip:'Set QUALIFY_DISPOSABLE=1 only in the offline fixture'},()=>{});
}else{
const root=process.env.QUALIFICATION_PUBLIC_ROOT ?? '/qual/source';
const native=process.env.QUALIFICATION_NATIVE_ROOT ?? path.join(root,'host-composition/paperclip-durable-funding-review/node_modules');
const load=rel=>import(pathToFileURL(path.join(native,rel)));
const schema=await load('@paperclipai/db/dist/schema/index.js');
const {eq}=await load('drizzle-orm/index.js');
const {recoveryService}=await load('@paperclipai/server/dist/services/recovery/service.js');
const {startEmbeddedPostgresTestDatabase,createDb}=await load('@paperclipai/db/dist/index.js');
let temporary,db;
before(async()=>{temporary=await startEmbeddedPostgresTestDatabase('native-dependency-backstop-');db=createDb(temporary.connectionString);});
after(async()=>{await temporary?.cleanup();});
async function database(){return {db,close:async()=>{}};}
async function fixture(options={}){
 const f=await database(),{db}=f;
 const companyId=randomUUID(),agentId=randomUUID(),issueId=randomUUID(),blockerId=randomUUID(),runId=randomUUID();
 await db.insert(schema.companies).values({id:companyId,name:'Synthetic backstop qualification',issuePrefix:'B'+companyId.slice(0,6)});
 await db.insert(schema.agents).values({id:agentId,companyId,name:'Synthetic blocked agent',status:'idle',adapterType:'process',adapterConfig:{}});
 await db.insert(schema.issues).values([
  {id:issueId,companyId,title:'Synthetic dependent',status:'blocked',statusVersion:3,assigneeAgentId:agentId,blockedTransitionAt:new Date('2026-10-28T00:00:00Z')},
  {id:blockerId,companyId,title:'Historical dependency',status:options.unresolved?'blocked':'done'},
 ]);
 await db.insert(schema.issueRelations).values({companyId,issueId:blockerId,relatedIssueId:issueId,type:'blocks'});
 if(options.reason){
  const contractId=randomUUID(),resultId=randomUUID(),assessmentId=randomUUID(),decisionId=randomUUID();
  await db.insert(schema.completionContracts).values({id:contractId,companyId,issueId,revision:1,schemaVersion:'fixture',policyVersion:'fixture',risk:'low',completionAuthority:'agent',incompleteCriteriaPolicy:'block',contractJson:{},canonicalSha256:contractId,createdByActorType:'system',createdByActorId:'fixture'});
  await db.insert(schema.heartbeatRuns).values({id:runId,companyId,agentId,status:'succeeded',runtimeMode:'native',nativeIssueId:issueId,completionContractId:contractId,completionContractSha256:contractId});
  await db.insert(schema.nativeRunResults).values({id:resultId,companyId,issueId,runId,completionContractId:contractId,serverFingerprint:resultId,schemaStatus:'accepted',resultJson:{},canonicalSha256:resultId});
  await db.insert(schema.workAssessments).values({id:assessmentId,companyId,issueId,runId,contractId,resultId,triggerKind:'native_result',triggerActorCompanyId:companyId,priorIssueStatus:'in_progress',priorStatusVersion:2,policyVersion:'fixture',assessmentJson:{},inputDigest:assessmentId});
  await db.insert(schema.statusDecisions).values({id:decisionId,companyId,issueId,runId,assessmentId,decisionVersion:1,policyVersion:'fixture',fromStatus:'in_progress',toStatus:options.toStatus??'blocked',reasonCode:options.reason,decisionJson:{projectedStatusVersion:Object.hasOwn(options,'version')?options.version:3,unblockDescriptor:{owner:'board',action:'Synthetic Board decision'}},decisionDigest:decisionId,applicationState:options.applicationState??'applied'});
  if(options.linked!==false)await db.update(schema.issues).set({lastStatusDecisionId:decisionId}).where(eq(schema.issues.id,issueId));
 }
 const calls=[];
 // The real reconciler owns candidate/readiness/dedup/hold checks; only final delivery is stubbed.
 const service=recoveryService(db,{enqueueWakeup:async(agentId,input)=>{
  calls.push({agentId,input});
  const [wake]=await db.insert(schema.agentWakeupRequests).values({companyId,agentId,source:input.source,reason:input.reason,payload:input.payload,idempotencyKey:input.idempotencyKey,status:'completed'}).returning();
  return wake;
 }});
 return {...f,companyId,issueId,blockerId,calls,service};
}
for(const reason of ['current_track_blocker_waiting','task_wide_blocker_bound']){
 for(const targeted of [false,true])test(`current ${reason} prevents historical dependency replay (${targeted?'targeted':'scan'})`,async()=>{
  const f=await fixture({reason});try{
   for(let cycle=0;cycle<3;cycle++){
    // A newly recorded blocked transition must not mint another delivery key.
    await f.db.update(schema.issues).set({blockedTransitionAt:new Date(Date.UTC(2026,9,28,0,cycle))}).where(eq(schema.issues.id,f.issueId));
    const result=await f.service.reconcileResolvedDependencyWakeBackstop({companyId:f.companyId,...(targeted?{blockerIssueId:f.blockerId}:{})});
    assert.equal(result.healed,0);assert.equal(f.calls.length,0);
   }
  }finally{await f.close();}
 });
}
for(const options of [
 {},{reason:'durable_dependency_blocker_bound'},
 {reason:'current_track_blocker_waiting',version:2},
 {reason:'current_track_blocker_waiting',version:4},
 {reason:'current_track_blocker_waiting',version:null},
 {reason:'current_track_blocker_waiting',version:'3'},
 {reason:'current_track_blocker_waiting',linked:false},
 {reason:'current_track_blocker_waiting',applicationState:'proposed'},
 {reason:'current_track_blocker_waiting',toStatus:'in_progress'},
])test('genuine/legacy dependency wake remains eligible: '+JSON.stringify(options),async()=>{
 const f=await fixture(options);try{
  const result=await f.service.reconcileResolvedDependencyWakeBackstop({companyId:f.companyId});
  assert.equal(result.healed,1);assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].input.reason,'issue_blockers_resolved');
  assert.equal(f.calls[0].input.payload.issueId,f.issueId);
  const again=await f.service.reconcileResolvedDependencyWakeBackstop({companyId:f.companyId});
  assert.equal(again.healed,0);assert.equal(again.existingWakeSkipped,1);assert.equal(f.calls.length,1);
 }finally{await f.close();}
});
test('unresolved dependencies remain ineligible',async()=>{
 const f=await fixture({unresolved:true});try{
  const result=await f.service.reconcileResolvedDependencyWakeBackstop({companyId:f.companyId});
  assert.equal(result.healed,0);assert.equal(f.calls.length,0);assert.equal(result.notReadySkipped,1);
 }finally{await f.close();}
});

}
