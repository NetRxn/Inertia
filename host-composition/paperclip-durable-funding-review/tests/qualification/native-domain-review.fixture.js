/** Synthetic actual native/PostgreSQL qualification. No provider, credentials,
 * HTTP, private funding database, live mounts or external actions are exercised.
 * Domain ports below are immutable fixture receipts, not a two-database proof.
 */
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import {eq} from 'drizzle-orm';
import {companies,agents,projects,issues,heartbeatRuns,issueThreadInteractions,completionContracts,nativeRunResults,workAssessments,statusDecisions,nativeRunFinalizations,createDb} from '@paperclipai/db';
import {startEmbeddedPostgresTestDatabase} from '../../__tests__/helpers/embedded-postgres.js';
import {issueThreadInteractionService} from '../issue-thread-interactions.js';
import {PaperclipRunnerToolAuthority} from './paperclip-runner-tool-authority.js';
import {nativeDomainReviewComposition} from './native-domain-review-composition.mjs';
import {commitNativeStatusDecision} from './status-decision-committer.js';
import {NATIVE_STATUS_ARBITER_POLICY_VERSION} from './status-arbiter.js';

const names=['missing','admitted','rejected','staleactor','stalerun','stalecard','nested','releasefailure','wrongreceipt','humanonly','unbound','directdone','directunbound'];
const cases=Object.fromEntries(names.map(name=>[name,{name,issue:randomUUID(),producerRun:randomUUID(),reviewerRun:randomUUID(),contract:randomUUID(),result:randomUUID(),assessment:randomUUID(),decision:randomUUID(),card:randomUUID(),candidate:randomUUID(),review:randomUUID(),hash:'a'.repeat(64),acquired:0,alive:0,released:0,observedAtRelease:[]}]))
let temporary,db,observer,co,project,producer,reviewer;
const binding=f=>({company_id:co,issue_id:f.issue,interaction_id:f.card,decision_id:f.decision,producer_principal_id:'synthetic-domain-producer',producer_run_id:f.producerRun,reviewer_principal_id:'synthetic-domain-reviewer',reviewer_run_id:f.reviewerRun,candidate_hash:f.hash});
const actor=f=>({agentId:reviewer,runId:f.reviewerRun});
const current=async f=>(await db.select().from(issues).where(eq(issues.id,f.issue)))[0];
const card=async f=>(await db.select().from(issueThreadInteractions).where(eq(issueThreadInteractions.id,f.card)))[0];
const scope=f=>({companyId:co,projectId:project,issueId:f.issue,producerAgentId:producer,reviewerAgentId:reviewer,producerPrincipalId:'synthetic-domain-producer',reviewerPrincipalId:'synthetic-domain-reviewer'});
async function seed(f){
 await db.insert(issues).values({id:f.issue,companyId:co,projectId:project,title:'Synthetic native domain '+f.name,status:'in_review',statusVersion:3,assigneeAgentId:producer,reviewPolicy:'anyone'});
 await db.insert(completionContracts).values({id:f.contract,companyId:co,issueId:f.issue,revision:1,schemaVersion:'paperclip.completion-contract.v1',policyVersion:'synthetic-domain-v1',risk:'standard',completionAuthority:'server_arbiter',incompleteCriteriaPolicy:'preserve_non_terminal',contractJson:{},canonicalSha256:f.contract,createdByActorType:'system',createdByActorId:'synthetic'});
 await db.insert(heartbeatRuns).values([{id:f.producerRun,companyId:co,agentId:producer,nativeIssueId:f.issue,status:'succeeded',runtimeMode:'native',completionContractId:f.contract},{id:f.reviewerRun,companyId:co,agentId:reviewer,nativeIssueId:f.issue,status:'running',runtimeMode:'native',contextSnapshot:{issueId:f.issue,nativeReviewInteractionId:f.card,nativeReviewDecisionId:f.decision,sourceRunId:f.producerRun,revisionId:f.decision}}]);
 await db.insert(nativeRunResults).values({id:f.result,companyId:co,issueId:f.issue,runId:f.producerRun,completionContractId:f.contract,serverFingerprint:f.result,schemaStatus:'valid',resultJson:{},canonicalSha256:f.result});
 await db.insert(workAssessments).values({id:f.assessment,companyId:co,issueId:f.issue,runId:f.producerRun,contractId:f.contract,resultId:f.result,triggerKind:'native_result',triggerActorCompanyId:co,priorIssueStatus:'in_progress',priorStatusVersion:2,policyVersion:'synthetic-domain-v1',assessmentJson:{},inputDigest:f.assessment});
 await db.insert(statusDecisions).values({id:f.decision,companyId:co,issueId:f.issue,runId:f.producerRun,assessmentId:f.assessment,decisionVersion:1,policyVersion:'synthetic-domain-v1',fromStatus:'in_progress',toStatus:'in_review',reasonCode:'synthetic',decisionJson:{projectedStatusVersion:3},decisionDigest:f.decision,applicationState:'applied'});
 await db.insert(issueThreadInteractions).values({id:f.card,companyId:co,issueId:f.issue,kind:'request_confirmation',status:'pending',sourceRunId:f.producerRun,addresseeAgentId:reviewer,requestedResolverPolicy:'anyone',effectiveResolverPolicy:'anyone',resolverPolicyProvenance:'explicit',continuationPolicy:'wake_assignee',payload:{version:1,prompt:'Review exact synthetic candidate',rejectRequiresReason:true,target:{type:'custom',key:'native_completion_review',revisionId:f.decision}}});
 await db.update(issues).set({executionRunId:f.reviewerRun,lastStatusDecisionId:f.decision}).where(eq(issues.id,f.issue));
}


async function directCompletion(f){
 // A separate fresh assessment avoids the native unique(company,assessment)
 // constraint while retaining an actual persisted result/contract/run chain.
 const assessment=randomUUID();
 await db.delete(issueThreadInteractions).where(eq(issueThreadInteractions.id,f.card));
 await db.update(issues).set({status:'in_progress',executionRunId:f.producerRun}).where(eq(issues.id,f.issue));
 // The installed native database trigger increments statusVersion on status
 // changes; use the authoritative post-transition snapshot, never a hardcoded3.
 const prior=await current(f);
 await db.insert(workAssessments).values({id:assessment,companyId:co,issueId:f.issue,runId:f.producerRun,contractId:f.contract,resultId:f.result,triggerKind:'native_result',triggerActorCompanyId:co,priorIssueStatus:prior.status,priorStatusVersion:Number(prior.statusVersion),policyVersion:NATIVE_STATUS_ARBITER_POLICY_VERSION,assessmentJson:{},inputDigest:assessment});
 await db.insert(nativeRunFinalizations).values({runId:f.producerRun,companyId:co,issueId:f.issue,phase:'observed',resultId:f.result,assessmentId:assessment});
 return commitNativeStatusDecision({db,companyId:co,issueId:f.issue,runId:f.producerRun,assessmentId:assessment,priorStatus:prior.status,priorStatusVersion:Number(prior.statusVersion),priorDecisionId:prior.lastStatusDecisionId,decision:{policyVersion:NATIVE_STATUS_ARBITER_POLICY_VERSION,statusAction:'done',toStatus:'done',reasonCode:'completion_claim_policy_accepted',unblockDescriptor:null,effects:[]}});
}

// Every configured scope is fixed before any test; there is no per-request
// registration, model-selected binding, reset, or live tenant metadata.
beforeAll(async()=>{
 temporary=await startEmbeddedPostgresTestDatabase('native-domain-gate-');db=createDb(temporary.connectionString);observer=createDb(temporary.connectionString);
 [co,project,producer,reviewer]=Array.from({length:4},()=>randomUUID());
 await db.insert(companies).values({id:co,name:'Synthetic native domain gate',issuePrefix:'NDG'});
 await db.insert(projects).values({id:project,companyId:co,name:'Synthetic bound scope'});
 await db.insert(agents).values([{id:producer,companyId:co,name:'Synthetic producer',role:'general',status:'idle',adapterType:'paperclip_runner'},{id:reviewer,companyId:co,name:'Synthetic independent reviewer',role:'general',status:'idle',adapterType:'paperclip_runner'}]);
 for(const f of Object.values(cases))await seed(f);
 nativeDomainReviewComposition.install({scopes:Object.values(cases).filter(f=>!['unbound','directunbound'].includes(f.name)).map(scope),
  // Immutable source-fixture ports only. Actual grants/private PostgreSQL are
  // qualified separately by the combined application/tool fixture.
  authorize:async(s,input,tool)=>{if(!['netrxn.inertia:funding_review_context','netrxn.inertia:review_funding_candidate'].includes(tool)||s.issueId!==input.issue.id)throw Error('synthetic_unexpected_authority_scope');return true;},
  readReviewContext:async()=>{throw Error('synthetic_unexpected_context_port');},
  admitReview:async()=>{throw Error('synthetic_unexpected_admit_port');},
  readReviewReceipt:async()=>{throw Error('synthetic_unexpected_receipt_port');},
  acquireFence:async(s,input)=>{
  const f=Object.values(cases).find(f=>f.issue===s.issueId);f.acquired++;
  return {assertAlive:async()=>{f.alive++;},readCandidate:async()=>({candidate_hash:f.hash,producer_principal_id:'synthetic-domain-producer',producer_run_id:f.producerRun}),readAdmission:async()=>f.name==='missing'?null:{binding:{...binding(f),...(f.name==='wrongreceipt'?{interaction_id:randomUUID()}: {})},review_id:f.review,candidate_id:f.candidate,artifact_hash:'b'.repeat(64),state:'supported'},release:async()=>{
   f.released++;const [seen]=await observer.select().from(issueThreadInteractions).where(eq(issueThreadInteractions.id,f.card));f.observedAtRelease.push(seen.status);
   if(f.name==='releasefailure')throw Error('synthetic_after_commit_release_failure');
  }};
 }});
},180000);
afterAll(async()=>temporary?.cleanup());

describe('central native domain-review guard on actual PostgreSQL service',()=>{
 it('default service constructor cannot accept configured review without domain admission',async()=>{
  const f=cases.missing;await expect(issueThreadInteractionService(db).acceptInteraction(await current(f),f.card,{},actor(f))).rejects.toThrow(/native_domain_review_admission_required/);
  expect((await card(f)).status).toBe('pending');expect((await current(f)).status).toBe('in_review');expect(f.acquired).toBe(1);expect(f.released).toBe(1);
 });
 it('admitted exact review completes the same native task and releases only after commit',async()=>{
  const f=cases.admitted;const result=await issueThreadInteractionService(db).acceptInteraction(await current(f),f.card,{},actor(f));
  expect(result.interaction.status).toBe('accepted');const task=await current(f);expect(task.status).toBe('done');expect(task.assigneeAgentId).toBe(producer);
  expect(f.acquired).toBe(1);expect(f.alive).toBe(1);expect(f.released).toBe(1);expect(f.observedAtRelease).toEqual(['accepted']);
 });
 it('native conservative rejection returns work to original executor without positive domain evidence',async()=>{
  const f=cases.rejected;const result=await issueThreadInteractionService(db).rejectInteraction(await current(f),f.card,{reason:'The submitted evidence needs correction'},actor(f));
  expect(result.status).toBe('rejected');const task=await current(f);expect(task.status).toBe('todo');expect(task.assigneeAgentId).toBe(producer);expect(f.acquired).toBe(0);
 });
 it('wrong receipt card cannot resolve or complete the native task',async()=>{
  const f=cases.wrongreceipt;await expect(issueThreadInteractionService(db).acceptInteraction(await current(f),f.card,{},actor(f))).rejects.toThrow(/native_domain_review_receipt_mismatch/);expect((await card(f)).status).toBe('pending');expect(f.released).toBe(1);
 });
 it('native participant and current run validation still reject stale callers before private ports',async()=>{
  const f=cases.staleactor;await expect(issueThreadInteractionService(db).acceptInteraction(await current(f),f.card,{}, {agentId:producer,runId:f.producerRun})).rejects.toThrow();expect((await card(f)).status).toBe('pending');expect(f.acquired).toBe(0);
  const r=cases.stalerun;await db.update(heartbeatRuns).set({status:'succeeded'}).where(eq(heartbeatRuns.id,r.reviewerRun));await expect(issueThreadInteractionService(db).acceptInteraction(await current(r),r.card,{},actor(r))).rejects.toThrow();expect((await card(r)).status).toBe('pending');expect(r.acquired).toBe(0);
 });
 it('stale native decision and human-only policy remain authoritative',async()=>{
  const f=cases.stalecard;await db.update(issues).set({statusVersion:4}).where(eq(issues.id,f.issue));await expect(issueThreadInteractionService(db).acceptInteraction(await current(f),f.card,{},actor(f))).rejects.toThrow();expect(f.acquired).toBe(0);
  const h=cases.humanonly;await db.update(issueThreadInteractions).set({requestedResolverPolicy:'human_only',effectiveResolverPolicy:'human_only'}).where(eq(issueThreadInteractions.id,h.card));await expect(issueThreadInteractionService(db).acceptInteraction(await current(h),h.card,{},actor(h))).rejects.toThrow();expect((await card(h)).status).toBe('pending');expect(h.acquired).toBe(0);
 });
 it('unowned outer transaction cannot release a bound acceptance fence before root commit',async()=>{
  const f=cases.nested;await expect(db.transaction(async tx=>issueThreadInteractionService(tx).acceptInteraction(await current(f),f.card,{},actor(f)))).rejects.toThrow(/native_domain_review_nested_transaction_unsupported/);expect((await card(f)).status).toBe('pending');expect(f.acquired).toBe(0);
 });
 it('postcommit release error leaves immutable acceptance that native resolve_review deduplicates',async()=>{
  const f=cases.releasefailure;await expect(issueThreadInteractionService(db).acceptInteraction(await current(f),f.card,{},actor(f))).rejects.toThrow(/synthetic_after_commit_release_failure/);
  expect((await card(f)).status).toBe('accepted');expect((await current(f)).status).toBe('done');expect(f.observedAtRelease).toEqual(['accepted']);
  const authority=new PaperclipRunnerToolAuthority(db,{companyId:co,issueId:f.issue,agentId:reviewer,runId:f.reviewerRun,nativeReview:{nativeReviewInteractionId:f.card,nativeReviewDecisionId:f.decision}});
  const replay=await authority.execute({tool:'resolve_review',arguments:{decision:'accept'},callId:randomUUID()});expect(replay).toEqual({interactionId:f.card,status:'accepted',deduplicated:true});expect(f.acquired).toBe(1);expect(f.released).toBe(1);
 });
 it('bound native status committer cannot complete without an admitted review card',async()=>{
  const f=cases.directdone;await expect(directCompletion(f)).rejects.toThrow(/native_domain_review_required_before_completion/);expect((await current(f)).status).toBe('in_progress');
  const persisted=await db.select().from(statusDecisions).where(eq(statusDecisions.issueId,f.issue));expect(persisted).toHaveLength(1);expect(f.acquired).toBe(0);
 });
 it('unbound direct completion fixture remains valid under stock native commit semantics',async()=>{
  const f=cases.directunbound;const committed=await directCompletion(f);expect(committed.issue.status).toBe('done');expect((await current(f)).status).toBe('done');expect(f.acquired).toBe(0);
 });
 it('unbound stock review keeps native service behavior without private port access',async()=>{
  const f=cases.unbound;const result=await issueThreadInteractionService(db).acceptInteraction(await current(f),f.card,{},actor(f));expect(result.interaction.status).toBe('accepted');expect((await current(f)).status).toBe('done');expect(f.acquired).toBe(0);
 });
});


describe('required composition startup ordering',()=>{
 it('refuses missing protected registry before config, database, sweep or listener effects',async()=>{
  const home=await fs.mkdtemp('/tmp/native-domain-startup-');
  try{
   const script=`
    import fs from 'node:fs';import net from 'node:net';import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
    let blocked=0;
    const deny=()=>{blocked++;throw Error('synthetic_startup_effect_before_guard');};
    net.Server.prototype.listen=deny;net.Socket.prototype.connect=deny;
    for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[key]=deny;
    for(const key of ['mkdirSync','writeFileSync','appendFileSync','unlinkSync','rmSync','renameSync'])fs[key]=deny;
    for(const key of ['mkdir','writeFile','appendFile','unlink','rm','rename'])fs.promises[key]=async()=>deny();
    syncBuiltinESMExports();
    try{const {startServer}=await import(${JSON.stringify(new URL('../../index.js',import.meta.url).href)});await startServer();console.log(JSON.stringify({error:'unexpected_startup_success',blocked}));}
    catch(error){console.log(JSON.stringify({error:error.message,blocked}));}
    process.exit(0);
   `;
   const child=spawnSync(process.execPath,['--input-type=module','-e',script],{env:{PATH:process.env.PATH,HOME:home,TMPDIR:home,NODE_ENV:'test',PAPERCLIP_HOME:home,PAPERCLIP_NATIVE_DOMAIN_REVIEW_REQUIRED:'1'},encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
   expect(child.error?.message,child.stderr).toBeUndefined();expect(child.status,child.stderr).toBe(0);
   const lines=child.stdout.trim().split('\n'),last=lines.at(-1);let report;try{report=JSON.parse(last);}catch{throw Error('Startup child did not return its bounded report: '+child.stdout.slice(-2000)+' '+child.stderr.slice(-2000));}
   expect(report).toEqual({error:'native_domain_review_application_configuration_invalid',blocked:0});
  }finally{await fs.rm(home,{recursive:true,force:true});}
 },20000);
 it('accepts exact protected registry bytes without startup effects and rejects mode or hash drift',async()=>{
  const home=await fs.mkdtemp('/tmp/native-domain-protected-preflight-');
  try{
   const processConfig=async name=>{
    const entry=home+'/'+name+'.mjs',configurationPath=home+'/'+name+'.json';
    await fs.writeFile(entry,'// Synthetic metadata-only preflight; never executed.\n',{mode:0o600});await fs.writeFile(configurationPath,'{}',{mode:0o600});
    const {createHash}=await import('node:crypto');const pins=await Promise.all([entry,configurationPath].map(async path=>({path,sha256:createHash('sha256').update(await fs.readFile(path)).digest('hex')})));
    return {executable:process.execPath,args:[entry,'--config',configurationPath],cwd:home,entrypoint:entry,configurationPath,pins,timeoutMs:1000,maxOutputBytes:4096};
   };
   const reviewerProcess=await processConfig('reviewer'),producerProcess=await processConfig('producer'),s=scope(cases.admitted);
   const raw={enabled:true,nativeAttention:true,projectId:s.projectId,applicantSlug:'synthetic-preflight',matchId:'synthetic-match',producer:{issueId:s.issueId,agentId:s.producerAgentId,principalId:s.producerPrincipalId},reviewer:{issueId:s.issueId,agentId:s.reviewerAgentId,principalId:s.reviewerPrincipalId},process:producerProcess};
   const registry={version:1,bindings:[{scope:s,reviewerPolicy:{version:1,role:'reviewer',projectIds:[s.projectId],issueIds:[s.issueId]},process:reviewerProcess,host:{expectedPluginId:randomUUID(),publicDrafting:raw}}]};
   const file=home+'/registry.json',bytes=JSON.stringify(registry);await fs.writeFile(file,bytes,{mode:0o600});
   const {createHash}=await import('node:crypto');const pin=createHash('sha256').update(bytes).digest('hex');
   const script=`
    import fs from 'node:fs';import net from 'node:net';import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
    let blocked=0;const deny=()=>{blocked++;throw Error('synthetic_preflight_side_effect');};
    net.Server.prototype.listen=deny;net.Socket.prototype.connect=deny;
    for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[key]=deny;
    for(const key of ['mkdirSync','writeFileSync','appendFileSync','unlinkSync','rmSync','renameSync'])fs[key]=deny;
    for(const key of ['mkdir','writeFile','appendFile','unlink','rm','rename'])fs.promises[key]=async()=>deny();syncBuiltinESMExports();
    try{const {preflightNativeReviewApplication}=await import(${JSON.stringify(new URL('./native-review-application.mjs',import.meta.url).href)});const registry=await preflightNativeReviewApplication();console.log(JSON.stringify({ok:true,bindings:registry.bindings.length,frozen:Object.isFrozen(registry)&&Object.isFrozen(registry.bindings[0]),blocked}));}
    catch(error){console.log(JSON.stringify({error:error.message,blocked}));}process.exit(0);
   `;
   const invoke=hash=>{
    const child=spawnSync(process.execPath,['--input-type=module','-e',script],{env:{PATH:process.env.PATH,HOME:home,TMPDIR:home,NODE_ENV:'test',PAPERCLIP_HOME:home,PAPERCLIP_NATIVE_DOMAIN_REVIEW_REQUIRED:'1',PAPERCLIP_NATIVE_DOMAIN_REVIEW_CONFIG:file,PAPERCLIP_NATIVE_DOMAIN_REVIEW_CONFIG_SHA256:hash},encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
    expect(child.error?.message,child.stderr).toBeUndefined();expect(child.status,child.stderr).toBe(0);return JSON.parse(child.stdout.trim().split('\n').at(-1));
   };
   expect(invoke(pin)).toEqual({ok:true,bindings:1,frozen:true,blocked:0});
   await fs.chmod(file,0o644);expect(invoke(pin)).toEqual({error:'native_domain_review_application_configuration_invalid',blocked:0});
   await fs.chmod(file,0o600);expect(invoke('0'.repeat(64))).toEqual({error:'native_domain_review_application_configuration_invalid',blocked:0});
  }finally{await fs.rm(home,{recursive:true,force:true});}
 },45000);

});
