/** Synthetic native service and PostgreSQL receipt proof; not live enrollment/provider qualification. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createContributionBoundary} from './plugin/dist/src/contributions/service.js';
import {createNativeContributionReader,nativeTaskRevision} from './plugin/dist/src/contributions/native.js';
import {createContributionJournal} from './plugin/dist/src/contributions/journal.js';
import {contributionHash} from './plugin/dist/src/contributions/artifacts.js';
import {BRIDGE_NAMESPACE} from './plugin/dist/src/store/postgres.js';
export async function checkMemberBoundary({db,sql,companyId,services,issueService,pluginDatabase,pluginId}) {
 const native=issueService(db), journal=createContributionJournal({namespace:BRIDGE_NAMESPACE,query:(s,p)=>pluginDatabase.query(pluginId,s,p),execute:(s,p)=>pluginDatabase.execute(pluginId,s,p)});
 const ctx={issues:{get:(issueId,companyId)=>services.issues.get({issueId,companyId}),summaries:{getOrchestration:p=>services.issues.getOrchestrationSummary(p)}},agents:{get:(agentId,companyId)=>services.agents.get({agentId,companyId})}};
 const projectId=randomUUID();await sql`INSERT INTO projects(id,company_id,name) VALUES (${projectId},${companyId},'Synthetic scoped member project')`;
 const fixtures=[];
 for(let i=0;i<2;i++) {
  const memberId='synthetic-member-'+randomUUID(),agentId=randomUUID(),runId=randomUUID();
  await sql`INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES (${memberId},'Synthetic member',${memberId+'@example.invalid'},false,now(),now())`;
  await sql`INSERT INTO company_memberships(company_id,principal_type,principal_id,status,membership_role) VALUES (${companyId},'user',${memberId},'active','member')`;
  await sql`INSERT INTO agents(id,company_id,name,status,adapter_type,adapter_config,runtime_config) VALUES (${agentId},${companyId},'Synthetic isolated agent','idle','process','{}','{}')`;
  const issue=await native.create(companyId,{title:'Private task title not exported',description:'Other company data not exported',projectId,status:'todo',priority:'medium',responsibleUserId:memberId,createdByUserId:memberId});
  await sql`INSERT INTO heartbeat_runs(id,company_id,agent_id,status,context_snapshot) VALUES (${runId},${companyId},${agentId},'running',${sql.json({issueId:issue.id})}::jsonb)`;
  const checked=await native.checkout(issue.id,agentId,['todo'],runId);
  const enrollment={enabled:true,active:true,memberId,agentId,authorityEpoch:'fixture-attempt-'+i,companyId,projectId,issueId:issue.id,runId,checkoutRunId:runId,taskRevision:nativeTaskRevision(checked),providerLeaseId:'fixture-opaque-lease-'+i,lifecycleDisposition:'active',lifecycleGeneration:'fixture-generation',enrollmentRevision:'fixture-enrollment',expiresAt:Date.now()+600000,dataClass:'approved-public',artifactClass:'text-evidence',input:'Approved public task '+i};
  const loadEnrollment=async(actor,issueId)=>{
   if(actor.memberId!==memberId||actor.agentId!==agentId||actor.authorityEpoch!==enrollment.authorityEpoch||issueId!==issue.id)return null;
   const rows=await sql`SELECT status FROM company_memberships WHERE company_id=${companyId} AND principal_type='user' AND principal_id=${memberId}`;
   return {...enrollment,active:rows[0]?.status==='active'};
  };
  const dependencies={enabled:()=>true,clock:Date.now,loadEnrollment,readNative:createNativeContributionReader(ctx,enrollment),journal};
  const boundary=createContributionBoundary(dependencies),actor={memberId,agentId,authorityEpoch:enrollment.authorityEpoch};
  const observation=await dependencies.readNative(enrollment); assert.ok(observation,'native read projection missing'); assert.equal(observation.taskRevision,enrollment.taskRevision,'native task revision mismatch');
  const input=await boundary.exportInput(actor,issue.id);assert.equal(input.state,'input');assert.equal(input.input,enrollment.input);assert.ok(!JSON.stringify(input).includes('Private task title'));
  fixtures.push({enrollment,boundary,actor,input,dependencies});
 }
 const [a,b]=fixtures;
 assert.equal((await a.boundary.exportInput(b.actor,a.enrollment.issueId)).state,'denied');
 assert.equal((await a.boundary.exportInput(a.actor,b.enrollment.issueId)).state,'denied');
 const text='Synthetic result, never native completion',artifact={name:'evidence.txt',mediaType:'text/plain',text,sha256:contributionHash(text)};
 let lose=true; a.dependencies.journal={...journal,put:async(c)=>{await journal.put(c);if(lose){lose=false;throw Error('Synthetic response lost after committed insert');}}};
 const results=await Promise.all([a.boundary.submit(a.actor,a.input.binding,[artifact]),a.boundary.submit(a.actor,a.input.binding,[artifact])]);
 assert.equal(results[0].state,'candidate-for-review');assert.deepEqual(results[1],results[0]);
 assert.equal((await a.boundary.submit(a.actor,a.input.binding,[{...artifact,text:'conflict',sha256:contributionHash('conflict')}])).state,'conflict');
 assert.equal((await a.boundary.submit(a.actor,a.input.binding,[{...artifact,name:'../host.sh'}])).state,'invalid-artifacts');
 assert.equal(await journal.get(results[0].operationId,randomUUID()),null);
 assert.equal((await b.boundary.submit(b.actor,b.input.binding,[artifact])).state,'candidate-for-review');
 await sql`UPDATE company_memberships SET status='inactive' WHERE principal_id=${a.actor.memberId}`;
 assert.equal((await a.boundary.exportInput(a.actor,a.enrollment.issueId)).state,'denied');
 assert.equal((await a.boundary.submit(a.actor,a.input.binding,[artifact])).state,'denied');
 assert.equal((await native.getById(a.enrollment.issueId)).status,'in_progress');
 const oldActor={...b.actor};b.enrollment.authorityEpoch='fixture-reconstructed-attempt';
 const restarted=createContributionBoundary(b.dependencies);assert.equal((await restarted.exportInput(oldActor,b.enrollment.issueId)).state,'denied');
 b.actor.authorityEpoch=b.enrollment.authorityEpoch;
 const renewed=await restarted.exportInput(b.actor,b.enrollment.issueId);assert.equal(renewed.state,'input');b.input=renewed;
 // A stale owner assertion can adopt a new run. Boundary must not do that itself.
 const nextRun=randomUUID();
 await sql`UPDATE heartbeat_runs SET status='failed',finished_at=now() WHERE id=${b.enrollment.runId}`;
 await sql`INSERT INTO heartbeat_runs(id,company_id,agent_id,status,context_snapshot) VALUES (${nextRun},${companyId},${b.actor.agentId},'running',${sql.json({issueId:b.enrollment.issueId})}::jsonb)`;
 await native.assertCheckoutOwner(b.enrollment.issueId,b.actor.agentId,nextRun);
 assert.equal((await native.getById(b.enrollment.issueId)).checkoutRunId,nextRun);
 assert.equal((await b.boundary.submit(b.actor,b.input.binding,[artifact])).state,'denied');
 const receipts=await sql`SELECT value FROM plugin_netrxn_inertia_e936d62b87.bridge_runtime WHERE company_id=${companyId} AND relay='inertia:member-candidate:v1'`;
 assert.equal(receipts.length,2);assert.ok(receipts.every(r=>r.value.disposition==='untrusted-candidate'));
 console.log('NATIVE_MEMBER_CANDIDATE_BOUNDARY_PASSED',JSON.stringify({syntheticMembers:2,exactNativeSdkProjection:true,immutablePluginReceipts:2,concurrentRetry:true,committedLostResponseReconciled:true,conflictDenied:true,revokedDenied:true,crossMemberDenied:true,crossTaskDenied:true,crossCompanyReceiptDenied:true,hostileArtifactDenied:true,staleNativeAdoptionDemonstrated:true,obsoleteResultDenied:true,reconstructedAttemptDenied:true,completionMutations:0,authenticatedIngress:false,liveEnrollment:false,providerExecution:false,atomicAcceptance:false}));
}
