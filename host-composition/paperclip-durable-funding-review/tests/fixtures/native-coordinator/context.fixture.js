import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {companies,agents,projects,issues,heartbeatRuns,issueThreadInteractions,completionContracts,nativeRunResults,workAssessments,statusDecisions,createDb} from '@paperclipai/db';
import {startEmbeddedPostgresTestDatabase} from '../../__tests__/helpers/embedded-postgres.js';
import {documentService} from '../documents.js';
import {PaperclipRunnerToolAuthority} from './paperclip-runner-tool-authority.js';

describe('restricted coordinator native context provenance',()=>{
 let temporary,db,co,actor,project,excluded,root,run;
 const config=()=>({provider:'codex',nativeCoordinator:{version:1,projectIds:[project]},disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never'});
 const authority=(restricted=true)=>new PaperclipRunnerToolAuthority(db,{companyId:co,agentId:actor,issueId:root,runId:run,...(restricted?{nativeCoordinatorPolicy:{version:1,companyId:co,agentId:actor,projectIds:[project]}}:{})});
 const context=(targetTaskId)=>authority().execute({tool:'get_task_context',arguments:targetTaskId?{targetTaskId}:{}});
 async function task(fields={}){const id=randomUUID();await db.insert(issues).values({id,companyId:co,projectId:project,title:'Synthetic native context',status:'done',...fields});return id;}
 async function plan(issueId,body='Accepted synthetic plan',accepted=true){
  const {document:doc}=await documentService(db).upsertIssueDocument({issueId,key:'plan',title:'Plan',format:'markdown',body,baseRevisionId:null,createdByAgentId:actor});
  const id=randomUUID();if(accepted)await db.insert(issueThreadInteractions).values({id,companyId:co,issueId,kind:'request_confirmation',status:'accepted',payload:{version:1,prompt:'Approve synthetic plan',target:{type:'issue_document',issueId,key:'plan',revisionId:doc.latestRevisionId}},resolvedAt:new Date('2026-01-01T00:00:00Z')});
  return{id,documentId:doc.id,revisionId:doc.latestRevisionId,body};
 }
 async function source(fields={}){
  const id=await task({conversationAgentId:actor,conversationUserId:'synthetic-'+randomUUID(),conversationState:'waiting',assigneeAgentId:actor,status:'in_progress',...fields}),sourceRun=randomUUID(),p=await plan(id,'Approved source scope');
  await db.insert(heartbeatRuns).values({id:sourceRun,companyId:co,agentId:actor,nativeIssueId:id,status:'succeeded',runtimeMode:'native',contextSnapshot:{issueId:id}});
  const target=await task({originRunId:sourceRun});return{target,source:id,plan:p};
 }
 async function reviewedChild(parentId,fields={},applied=true){
  const id=await task({parentId,...fields}),r=randomUUID(),contract=randomUUID(),result=randomUUID(),assessment=randomUUID(),decision=randomUUID(),interaction=randomUUID();
  await db.insert(completionContracts).values({id:contract,companyId:co,issueId:id,revision:1,schemaVersion:'paperclip.completion-contract.v1',policyVersion:'synthetic-v1',risk:'standard',completionAuthority:'server_arbiter',incompleteCriteriaPolicy:'preserve_non_terminal',contractJson:{},canonicalSha256:contract,createdByActorType:'system',createdByActorId:'synthetic'});
  await db.insert(heartbeatRuns).values({id:r,companyId:co,agentId:actor,nativeIssueId:id,status:'succeeded',runtimeMode:'native',completionContractId:contract});
  await db.insert(nativeRunResults).values({id:result,companyId:co,issueId:id,runId:r,completionContractId:contract,serverFingerprint:result,schemaStatus:'valid',resultJson:{},canonicalSha256:result});
  await db.insert(workAssessments).values({id:assessment,companyId:co,issueId:id,runId:r,contractId:contract,resultId:result,triggerKind:'native_result',triggerActorCompanyId:co,priorIssueStatus:'in_progress',priorStatusVersion:0,policyVersion:'synthetic-v1',assessmentJson:{},inputDigest:assessment});
  await db.insert(statusDecisions).values({id:decision,companyId:co,issueId:id,runId:r,assessmentId:assessment,decisionVersion:1,policyVersion:'synthetic-v1',fromStatus:'in_progress',toStatus:'done',reasonCode:'synthetic',decisionJson:{},decisionDigest:decision,applicationState:applied?'applied':'proposed'});
  await db.insert(issueThreadInteractions).values({id:interaction,companyId:co,issueId:id,kind:'request_confirmation',status:'accepted',sourceRunId:r,resolvedByAgentId:actor,resolvedByRunId:r,payload:{version:1,prompt:'Review synthetic result',target:{type:'custom',key:'native_completion_review',revisionId:decision}},resolvedAt:new Date()});
  return{id,interaction,decision,run:r};
 }
 beforeAll(async()=>{
  temporary=await startEmbeddedPostgresTestDatabase('coordinator-context-');db=createDb(temporary.connectionString);
  [co,actor,project,excluded,root,run]=Array.from({length:6},()=>randomUUID());
  await db.insert(companies).values({id:co,name:'Synthetic context',issuePrefix:'CTX'});
  await db.insert(projects).values([{id:project,companyId:co,name:'Allowed context'},{id:excluded,companyId:co,name:'Excluded context'}]);
  await db.insert(agents).values({id:actor,companyId:co,name:'Synthetic coordinator',role:'ceo',status:'idle',adapterType:'paperclip_runner',adapterConfig:config()});
  await db.insert(issues).values({id:root,companyId:co,projectId:project,title:'Context root',status:'in_progress',assigneeAgentId:actor});
  await db.insert(heartbeatRuns).values({id:run,companyId:co,agentId:actor,nativeIssueId:root,status:'running',runtimeMode:'native',contextSnapshot:{issueId:root}});
  await db.update(issues).set({executionRunId:run}).where(eq(issues.id,root));
 });
 afterAll(async()=>temporary?.cleanup());
 it('returns exact accepted native revision instead of a newer unaccepted plan',async()=>{
  const target=await task(),p=await plan(target);
  await documentService(db).upsertIssueDocument({issueId:target,key:'plan',title:'Plan',format:'markdown',body:'Unaccepted later draft',baseRevisionId:p.revisionId,createdByAgentId:actor});
  expect((await context(target)).acceptedPlan).toMatchObject({documentId:p.documentId,revisionId:p.revisionId,markdown:'Accepted synthetic plan'});
 });
 it('target context uses its own approval rather than the bound run snapshot',async()=>{
  const p=await plan(root,'Bound root plan'),target=await task(),targetPlan=await plan(target,'Target approved plan');
  await db.update(heartbeatRuns).set({contextSnapshot:{issueId:root,planReviewInteraction:{acceptedTargetRevision:{revisionId:p.revisionId}}}}).where(eq(heartbeatRuns.id,run));
  expect((await context(target)).acceptedPlan).toMatchObject({revisionId:targetPlan.revisionId,markdown:'Target approved plan'});
 });
 it('does not fabricate accepted context from prose or an unconfirmed snapshot',async()=>{
  const target=await task(),p=await plan(target,'Prose is not native acceptance',false);
  await db.update(heartbeatRuns).set({contextSnapshot:{issueId:root,planReviewInteraction:{acceptedTargetRevision:{revisionId:p.revisionId}}}}).where(eq(heartbeatRuns.id,run));
  expect((await context(target)).acceptedPlan).toBeNull();
 });
 it('returns same-project source approval with its native interaction provenance',async()=>{
  const s=await source();expect((await context(s.target)).sourcePlanApproval).toMatchObject({sourceIssueId:s.source,interactionId:s.plan.id,revisionId:s.plan.revisionId,markdown:'Approved source scope'});
 });
 for(const scope of ['excluded','hidden'])it(`withholds ${scope} source-plan approval`,async()=>{
  const s=await source(scope==='excluded'?{projectId:excluded}:{hiddenAt:new Date()});expect((await context(s.target)).sourcePlanApproval).toBeNull();
 });
 it('projects only visible allowed-child applied native review outcomes, preserving decision/run ids',async()=>{
  const parent=await task(),ok=await reviewedChild(parent);
  await reviewedChild(parent,{projectId:excluded});await reviewedChild(parent,{hiddenAt:new Date()});await reviewedChild(parent,{},false);
  const c=await context(parent);expect(c.childReviewOutcomes).toHaveLength(1);expect(c.childReviewOutcomes[0]).toMatchObject({id:ok.interaction,kind:'native_completion_review',status:'accepted',result:{childTaskId:ok.id,sourceDecisionId:ok.decision,sourceRunId:ok.run}});
 });
 it('retains empty native context when no native records exist',async()=>{
  const c=await context(await task());expect(c.acceptedPlan).toBeNull();expect(c.sourcePlanApproval).toBeNull();expect(c.childReviewOutcomes).toEqual([]);
 });
 it('denies hidden current context and revoked actor access',async()=>{
  await db.update(issues).set({hiddenAt:new Date()}).where(eq(issues.id,root));
  try{await expect(context()).rejects.toThrow(/native_coordination_project_denied/);}finally{await db.update(issues).set({hiddenAt:null}).where(eq(issues.id,root));}
  await db.update(agents).set({role:'general'}).where(eq(agents.id,actor));
  try{await expect(context()).rejects.toThrow(/native_coordination_scope_revoked/);}finally{await db.update(agents).set({role:'ceo'}).where(eq(agents.id,actor));}
 });
 it('does not project an unconfirmed bound-run snapshot as native acceptance',async()=>{
  const before=await documentService(db).getIssueDocumentByKey(root,'plan');
  const p=await documentService(db).upsertIssueDocument({issueId:root,key:'plan',title:'Plan',format:'markdown',body:'Unconfirmed bound snapshot',baseRevisionId:before.latestRevisionId,createdByAgentId:actor});
  await db.update(heartbeatRuns).set({contextSnapshot:{issueId:root,planReviewInteraction:{acceptedTargetRevision:{revisionId:p.document.latestRevisionId}}}}).where(eq(heartbeatRuns.id,run));
  expect((await context()).acceptedPlan).toBeNull();
 });
 it('retains an exact older approved snapshot when a newer native approval exists',async()=>{
  const before=await documentService(db).getIssueDocumentByKey(root,'plan');
  const oldRevision=before.latestRevisionId;
  await db.insert(issueThreadInteractions).values({id:randomUUID(),companyId:co,issueId:root,kind:'request_confirmation',status:'accepted',payload:{version:1,prompt:'Approve exact earlier revision',target:{type:'issue_document',issueId:root,key:'plan',revisionId:oldRevision}},resolvedAt:new Date('2026-02-01T00:00:00Z')});
  const newer=await documentService(db).upsertIssueDocument({issueId:root,key:'plan',title:'Plan',format:'markdown',body:'Newer approved scope',baseRevisionId:oldRevision,createdByAgentId:actor});
  await db.insert(issueThreadInteractions).values({id:randomUUID(),companyId:co,issueId:root,kind:'request_confirmation',status:'accepted',payload:{version:1,prompt:'Approve newer revision',target:{type:'issue_document',issueId:root,key:'plan',revisionId:newer.document.latestRevisionId}},resolvedAt:new Date('2026-03-01T00:00:00Z')});
  await db.update(heartbeatRuns).set({contextSnapshot:{issueId:root,planReviewInteraction:{acceptedTargetRevision:{revisionId:oldRevision}}}}).where(eq(heartbeatRuns.id,run));
  expect((await context()).acceptedPlan).toMatchObject({revisionId:oldRevision,markdown:'Unconfirmed bound snapshot'});
 });
 it('preserves ordinary stock snapshot-based accepted-plan behavior',async()=>{
  const p=await documentService(db).upsertIssueDocument({issueId:root,key:'plan',title:'Plan',format:'markdown',body:'Ordinary trusted snapshot',baseRevisionId:(await documentService(db).getIssueDocumentByKey(root,'plan')).latestRevisionId,createdByAgentId:actor});
  await db.update(heartbeatRuns).set({contextSnapshot:{issueId:root,planReviewInteraction:{acceptedTargetRevision:{revisionId:p.document.latestRevisionId}}}}).where(eq(heartbeatRuns.id,run));
  expect(await authority(false).execute({tool:'get_task_context',arguments:{}})).toMatchObject({acceptedPlan:{revisionId:p.document.latestRevisionId,markdown:'Ordinary trusted snapshot'}});
 });
});
