/** Synthetic source fixture only. No provider, live database, credentials or queue worker.
 * Parent supplies the existing actual native PostgreSQL database. Each case owns
 * isolated company/agent/task rows and a genuine native finalization FK chain.
 */
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const fixture=await import(pathToFileURL(process.env.REVIEW_RETRY_FIXTURE_MODULE??new URL('./native-fixture-real-pg.mjs',import.meta.url).pathname));
export const {nativeDatabase,loadNative,schema,eq}=fixture;
const {commitNativeStatusDecision}=await loadNative('@paperclipai/server/dist/services/native-runtime/status-decision-committer.js');
const {NATIVE_STATUS_ARBITER_POLICY_VERSION}=await loadNative('@paperclipai/server/dist/services/native-runtime/status-arbiter.js');
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const CASES=Object.freeze(['eligible','ordinary','resolved','humanonly','stale','revokedpolicy','paused','mismatchedsource','unfinished','activelease','newerrelated','replay']);
export async function seedReviewRetryCase(db,name){
 if(!CASES.includes(name))throw Error('Unknown finite synthetic case');
 const f=Object.fromEntries(['company','project','producer','reviewer','issue','producerRun','reviewerRun','producerContract','reviewerContract','producerResult','reviewerResult','producerAssessment','reviewerAssessment','sourceDecision','card'].map(k=>[k,randomUUID()]));f.name=name;
 const t=Date.now()-30000,at=n=>new Date(t+n);
 f.policy={version:1,role:'reviewer',projectIds:[f.project],issueIds:[f.issue]};
 f.context={issueId:f.issue,projectId:f.project,nativeReviewInteractionId:f.card,nativeReviewDecisionId:f.sourceDecision,sourceRunId:f.producerRun,revisionId:f.sourceDecision};
 const config={provider:'codex',engine:'cli',disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never',nativeFunding:f.policy};
 await db.insert(schema.companies).values({id:f.company,name:'Synthetic exact review retry '+name,issuePrefix:'RR'+f.company.slice(0,6).toUpperCase()});
 await db.insert(schema.projects).values({id:f.project,companyId:f.company,name:'Synthetic native review retry'});
 await db.insert(schema.agents).values([{id:f.producer,companyId:f.company,name:'Synthetic producer',role:'general',status:'idle',adapterType:'paperclip_runner',adapterConfig:{...config,nativeFunding:{...f.policy,role:'producer'}}},{id:f.reviewer,companyId:f.company,name:'Synthetic reviewer',role:'general',status:'idle',adapterType:'paperclip_runner',adapterConfig:config}]);
 await db.insert(schema.issues).values({id:f.issue,companyId:f.company,projectId:f.project,title:'Synthetic unresolved attention review',status:'in_review',statusVersion:3,assigneeAgentId:f.producer,reviewPolicy:'anyone'});
 for(const[revision,id]of [[1,f.producerContract],[2,f.reviewerContract]])await db.insert(schema.completionContracts).values({id,companyId:f.company,issueId:f.issue,revision,schemaVersion:'paperclip.completion-contract.v1',policyVersion:NATIVE_STATUS_ARBITER_POLICY_VERSION,risk:'standard',completionAuthority:'server_arbiter',incompleteCriteriaPolicy:'preserve_non_terminal',contractJson:{synthetic:true},canonicalSha256:sha({id}),createdByActorType:'system',createdByActorId:'synthetic-fixture'});
 await db.insert(schema.heartbeatRuns).values([{id:f.producerRun,companyId:f.company,agentId:f.producer,nativeIssueId:f.issue,status:'succeeded',runtimeMode:'native',completionContractId:f.producerContract,createdAt:at(0),startedAt:at(100),finishedAt:at(1000)},{id:f.reviewerRun,companyId:f.company,agentId:f.reviewer,nativeIssueId:f.issue,status:'running',runtimeMode:'native',completionContractId:f.reviewerContract,contextSnapshot:f.context,createdAt:at(2000),startedAt:at(2500)}]);
 for(const[id,run,contract]of[[f.producerResult,f.producerRun,f.producerContract],[f.reviewerResult,f.reviewerRun,f.reviewerContract]])await db.insert(schema.nativeRunResults).values({id,companyId:f.company,issueId:f.issue,runId:run,completionContractId:contract,serverFingerprint:sha({id,run}),schemaStatus:'valid',resultJson:{synthetic:true},canonicalSha256:sha({id})});
 for(const[id,run,contract,result,prior]of[[f.producerAssessment,f.producerRun,f.producerContract,f.producerResult,'in_progress'],[f.reviewerAssessment,f.reviewerRun,f.reviewerContract,f.reviewerResult,'in_review']])await db.insert(schema.workAssessments).values({id,companyId:f.company,issueId:f.issue,runId:run,contractId:contract,resultId:result,triggerKind:'native_result',triggerActorCompanyId:f.company,priorIssueStatus:prior,priorStatusVersion:prior==='in_progress'?2:3,policyVersion:NATIVE_STATUS_ARBITER_POLICY_VERSION,assessmentJson:{synthetic:true},inputDigest:sha({id})});
 await db.insert(schema.statusDecisions).values({id:f.sourceDecision,companyId:f.company,issueId:f.issue,runId:f.producerRun,assessmentId:f.producerAssessment,decisionVersion:1,policyVersion:NATIVE_STATUS_ARBITER_POLICY_VERSION,fromStatus:'in_progress',toStatus:'in_review',reasonCode:'actionable_attention_pending',decisionJson:{projectedStatusVersion:3},decisionDigest:sha({id:f.sourceDecision}),applicationState:'applied'});
 await db.insert(schema.issueThreadInteractions).values({id:f.card,companyId:f.company,issueId:f.issue,kind:'request_confirmation',status:'pending',sourceRunId:f.producerRun,addresseeAgentId:f.reviewer,requestedResolverPolicy:'anyone',effectiveResolverPolicy:'anyone',resolverPolicyProvenance:'explicit',continuationPolicy:'wake_assignee',payload:{version:1,prompt:'Resolve this synthetic exact review',rejectRequiresReason:true,target:{type:'custom',key:'native_completion_review',revisionId:f.sourceDecision}}});
 await db.update(schema.issues).set({lastStatusDecisionId:f.sourceDecision,executionRunId:f.reviewerRun}).where(eq(schema.issues.id,f.issue));
 await db.insert(schema.nativeRunFinalizations).values({runId:f.reviewerRun,companyId:f.company,issueId:f.issue,phase:'observed',resultId:f.reviewerResult,assessmentId:f.reviewerAssessment});
 if(name!=='unfinished'){
  const committed=await commitNativeStatusDecision({db,companyId:f.company,issueId:f.issue,runId:f.reviewerRun,assessmentId:f.reviewerAssessment,priorStatus:'in_review',priorStatusVersion:3,priorDecisionId:f.sourceDecision,decision:{policyVersion:NATIVE_STATUS_ARBITER_POLICY_VERSION,statusAction:'preserve',toStatus:'in_review',reasonCode:name==='ordinary'?'native_review_action_finished':'native_review_unresolved',unblockDescriptor:null,effects:[{kind:'release_checkout'}]}});
  f.reviewerDecision=committed.decision.id;
 }else await db.update(schema.issues).set({executionRunId:null}).where(eq(schema.issues.id,f.issue));
 await db.update(schema.heartbeatRuns).set({status:'succeeded',finishedAt:at(3000)}).where(eq(schema.heartbeatRuns.id,f.reviewerRun));
 if(name==='resolved')await db.update(schema.issueThreadInteractions).set({status:'accepted',resolvedByAgentId:f.reviewer,resolvedByRunId:f.reviewerRun,resolvedAt:at(2900)}).where(eq(schema.issueThreadInteractions.id,f.card));
 if(name==='humanonly')await db.update(schema.issueThreadInteractions).set({requestedResolverPolicy:'human_only',effectiveResolverPolicy:'human_only'}).where(eq(schema.issueThreadInteractions.id,f.card));
 if(name==='stale')await db.update(schema.issues).set({statusVersion:4}).where(eq(schema.issues.id,f.issue));
 if(name==='revokedpolicy')await db.update(schema.agents).set({adapterConfig:{...config,nativeFunding:undefined}}).where(eq(schema.agents.id,f.reviewer));
 if(name==='paused')await db.update(schema.agents).set({status:'paused'}).where(eq(schema.agents.id,f.reviewer));
 if(name==='mismatchedsource')await db.update(schema.issueThreadInteractions).set({sourceRunId:f.reviewerRun}).where(eq(schema.issueThreadInteractions.id,f.card));
 if(name==='activelease')await db.update(schema.nativeRunFinalizations).set({leaseOwner:'synthetic-active-owner',leaseExpiresAt:new Date(Date.now()+60000)}).where(eq(schema.nativeRunFinalizations.runId,f.reviewerRun));
 if(name==='newerrelated'||name==='replay'){
  f.successor=randomUUID();await db.insert(schema.heartbeatRuns).values({id:f.successor,companyId:f.company,agentId:f.reviewer,nativeIssueId:f.issue,status:'queued',runtimeMode:'native',retryOfRunId:name==='replay'?f.reviewerRun:null,contextSnapshot:{...f.context,wakeReason:'retry_failed_run',previousRunId:f.reviewerRun,forceFreshSession:true},createdAt:at(4000)});
 }
 f.selected=await readSelected(db,f);return f;
}
export async function readSelected(db,f){return(await db.select().from(schema.heartbeatRuns).where(eq(schema.heartbeatRuns.id,f.reviewerRun)))[0];}
