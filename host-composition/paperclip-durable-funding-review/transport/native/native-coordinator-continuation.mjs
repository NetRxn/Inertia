/** Bounded Coordinator continuation through existing issue/queue/receipt services. */
import {randomUUID,createHash} from 'node:crypto';
import {and,eq,inArray,isNull,sql} from 'drizzle-orm';
import {activityLog,issues,projects,companies,issueThreadInteractions,issueApprovals,approvals,toolActionRequests,agentWakeupRequests} from '@paperclipai/db';
import {assertAssignableAgent} from '../agent-assignability.js';
import {authorizationService} from '../authorization.js';
import {issueService} from '../issues.js';
import {issueTreeControlService} from '../issue-tree-control.js';
import {issueRecoveryActionService} from '../issue-recovery-actions.js';
import {getExecutionBlocker} from '../execution-blocker.js';
import {resolveCoreTrustPreset} from '../trust-preset-resolver.js';
import {persistActivity,publishActivity} from '../activity-log.js';
import {issueResumeAdmission} from '../issue-resume-admission.mjs';
import {nativeCoordinatorProjectAllowed} from './native-coordinator-policy.js';
import {createDurableTaskContinuation,assertTaskContinuationReceipt,continuationHold} from './native-task-continuation.mjs';
const deny=reason=>{throw Error('native_coordinator_continuation_denied: '+reason);};
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export async function continueCoordinatorTask(db,binding,input,mutate){
 if(!binding.nativeCoordinatorPolicy||!input||Object.keys(input).sort().join()!=='expectedAssigneeActorId,expectedStatusVersion,idempotencyKey,reason,taskId'||!uuid(input.taskId)||!uuid(input.expectedAssigneeActorId)||input.taskId===binding.issueId||!Number.isSafeInteger(input.expectedStatusVersion)||input.expectedStatusVersion<0||typeof input.idempotencyKey!=='string'||!input.idempotencyKey.trim()||input.idempotencyKey.length>160||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>20000||typeof binding.enqueueWakeup!=='function')deny('input');
 const key='coordinator-continue:'+binding.issueId+':'+input.idempotencyKey,fingerprint=createHash('sha256').update(canonical(input)).digest('hex');let publication;
 const readIntent=async tx=>(await tx.select().from(activityLog).where(and(eq(activityLog.companyId,binding.companyId),eq(activityLog.action,'issue.continuation_requested'),eq(activityLog.actorId,binding.agentId),sql`${activityLog.details}->>'continuationKey' = ${key}`)).limit(1))[0];
 const receipt=async(tx,intent)=>intent?(await tx.select().from(agentWakeupRequests).where(and(eq(agentWakeupRequests.id,intent.details.wakeId),eq(agentWakeupRequests.companyId,binding.companyId))).limit(1))[0]:null;
 const authorize=async(tx,context,intent,{admission=true}={})=>{
  const actor={type:'agent',source:'agent_jwt',companyId:binding.companyId,agentId:binding.agentId,runId:binding.runId,onBehalfOfUserId:context.run.responsibleUserId};
  // Snapshot IDs without locks, then lock/revalidate root -> descendants. Nested
  // active Coordinator roots must never acquire target -> ancestor inversions.
  let target=(await tx.select().from(issues).where(and(eq(issues.id,input.taskId),eq(issues.companyId,binding.companyId))).limit(1))[0];
  if(!target)deny('target');
  let node=target;const seen=new Set(),path=[target];
  while(node.id!==binding.issueId){
   if(seen.has(node.id)||seen.size>=100||!node.parentId)deny('ancestry');seen.add(node.id);
   node=(await tx.select().from(issues).where(and(eq(issues.id,node.parentId),eq(issues.companyId,binding.companyId))).limit(1))[0];
   if(!node)deny('ancestry');path.push(node);
  }
  const locked=[];
  for(const snapshot of path.reverse()){
   const fresh=(await tx.select().from(issues).where(and(eq(issues.id,snapshot.id),eq(issues.companyId,binding.companyId))).for('update').limit(1))[0];
   if(!fresh||fresh.hiddenAt||!nativeCoordinatorProjectAllowed(binding,fresh)||locked.length&&fresh.parentId!==locked.at(-1).id||fresh.id!==input.taskId&&['done','cancelled'].includes(fresh.status))deny('ancestry_changed');
   if(!(await authorizationService(tx).decide({actor,action:'issue:read',resource:{type:'issue',companyId:binding.companyId,issueId:fresh.id,projectId:fresh.projectId,parentIssueId:fresh.parentId,assigneeAgentId:fresh.assigneeAgentId,assigneeUserId:fresh.assigneeUserId,status:fresh.status}})).allowed)deny('ancestor_visibility');
   locked.push(fresh);
  }
  node=locked[0];target=locked.at(-1);
  if(target.hiddenAt||target.assigneeUserId||target.assigneeAgentId!==input.expectedAssigneeActorId||target.conversationAgentId||target.externalConversationState||target.workMode!=='standard')deny('target');
  if(node.assigneeAgentId!==binding.agentId||node.executionRunId!==binding.runId)deny('caller_changed');
  const [company]=await tx.select({status:companies.status}).from(companies).where(eq(companies.id,binding.companyId)).limit(1);if(company?.status!=='active')deny('company_held');
  await assertAssignableAgent(tx,binding.companyId,target.assigneeAgentId,{kind:'work'});
  const resource={type:'issue',companyId:binding.companyId,issueId:target.id,projectId:target.projectId,parentIssueId:target.parentId,assigneeAgentId:target.assigneeAgentId,assigneeUserId:null,status:target.status};
  for(const action of ['issue:read','tasks:assign'])if(!(await authorizationService(tx).decide({actor,action,resource})).allowed)deny('permission');
  if(intent&&(intent.details.inputFingerprint!==fingerprint||intent.details.rootIssueId!==binding.issueId||intent.details.targetId!==target.id||intent.details.ownerId!==target.assigneeAgentId))deny('intent');
  if(!admission)return target;
  const existing=await receipt(tx,intent);if(existing)return target; // Reporting a prior receipt never requests another provider turn.
  if(!['todo','in_progress','blocked'].includes(target.status)||target.statusVersion!==(intent?intent.details.postVersion:input.expectedStatusVersion))deny('state');
  const [project]=await tx.select().from(projects).where(and(eq(projects.id,target.projectId),eq(projects.companyId,binding.companyId))).limit(1);
  const trust=resolveCoreTrustPreset({companyId:binding.companyId,agent:context.actor,project,issue:target,run:{companyId:binding.companyId,executionPolicy:context.run.contextSnapshot?.executionPolicy}});
  const [pauseHold,dependencyReadiness,management,mutation]=await Promise.all([issueTreeControlService(tx).getActivePauseHoldGate(binding.companyId,target.id),issueService(tx).getDependencyReadiness(target.id),authorizationService(tx).decide({actor,action:'tasks:manage_active_checkouts',resource}),authorizationService(tx).decide({actor,action:'issue:mutate',resource})]);
  const denied=issueResumeAdmission({issue:target,actor,resumeIntent:true,lowTrust:trust.kind!=='standard',pauseHold,dependencyReadiness,canManage:management.allowed,mutationDecision:mutation});if(denied)deny(denied.error);
  const [interaction]=await tx.select({id:issueThreadInteractions.id}).from(issueThreadInteractions).where(and(eq(issueThreadInteractions.issueId,target.id),eq(issueThreadInteractions.companyId,binding.companyId),eq(issueThreadInteractions.status,'pending'))).limit(1);
  const [approval]=await tx.select({id:approvals.id}).from(issueApprovals).innerJoin(approvals,eq(issueApprovals.approvalId,approvals.id)).where(and(eq(issueApprovals.companyId,binding.companyId),eq(issueApprovals.issueId,target.id),inArray(approvals.status,['pending','revision_requested']))).limit(1);
  const [review]=await tx.select({id:toolActionRequests.id}).from(toolActionRequests).where(and(eq(toolActionRequests.companyId,binding.companyId),eq(toolActionRequests.issueId,target.id),inArray(toolActionRequests.status,['pending','approved','executing']))).limit(1);
  const hold=continuationHold(target,{pendingInteraction:!!interaction,pendingApproval:!!approval,pendingToolReview:!!review,recovery:!!(await issueRecoveryActionService(tx).getActiveForIssue(binding.companyId,target.id)),executionBlocker:!!(await getExecutionBlocker(tx,binding.companyId,target.id))});if(hold)deny(hold);
  return target;
 };
 const intent=await mutate('continue_task',input.idempotencyKey,input,async(tx,context)=>{
  const prior=await readIntent(tx);if(prior){await authorize(tx,context,prior);return prior;}
  const target=await authorize(tx,context,null);let updated=target;
  if(target.status==='blocked')updated=await issueService(tx).update(target.id,{status:'todo',actorAgentId:binding.agentId,actorRunId:binding.runId,companyGuard:binding.companyId},tx);
  if(!updated)deny('missing_target');
  const saved=await persistActivity(tx,{companyId:binding.companyId,actorType:'agent',actorId:binding.agentId,agentId:binding.agentId,runId:binding.runId,issueId:target.id,action:'issue.continuation_requested',entityType:'issue',entityId:target.id,details:{request:input,continuationKey:key,inputFingerprint:fingerprint,rootIssueId:binding.issueId,targetId:target.id,ownerId:target.assigneeAgentId,previousVersion:target.statusVersion,postVersion:updated.statusVersion,wakeId:randomUUID(),reason:input.reason}});publication=saved.publication;return saved.activity;
 },{beforeReceiptReplay:async(tx,context)=>{const prior=await readIntent(tx);if(!prior)deny('missing_intent');await authorize(tx,context,prior);}});
 if(publication)publishActivity(publication);
 // Re-read the durable intent; JSON native receipts convert Date values to strings.
 const saved=await readIntent(db);if(!saved||saved.id!==intent.id)deny('intent_missing');
 const request=createDurableTaskContinuation({id:saved.details.wakeId,requestedAt:saved.createdAt,companyId:binding.companyId,agentId:saved.details.ownerId,issueId:input.taskId,requestedByActorType:'agent',requestedByActorId:binding.agentId,intentId:saved.id,fingerprint,authorize:async tx=>{await authorize(tx,await binding.continuationContext(tx),saved);}});
 let wake=await receipt(db,saved);
 if(!wake){
  await binding.enqueueWakeup(request.agentId,{source:'assignment',triggerDetail:'system',reason:'issue_assigned',payload:{issueId:request.issueId,mutation:'continue_task',taskContinuationIntentId:saved.id},requestedByActorType:'agent',requestedByActorId:binding.agentId,durableTaskContinuation:request,issueStateGuard:{statuses:['todo','in_progress'],assigneeAgentId:request.agentId,statusVersion:saved.details.postVersion},contextSnapshot:{issueId:request.issueId,source:'paperclip_runner.continue_task'}});
  wake=await receipt(db,saved);
 }
 if(!wake)return {status:'not_dispatched',intentId:saved.id,taskId:input.taskId,providerExecution:'not_asserted'};
 assertTaskContinuationReceipt(request,wake);
 return {status:wake.status,intentId:saved.id,wakeRequestId:wake.id,runId:wake.runId??null,taskId:input.taskId,stateRevision:saved.details.postVersion,providerExecution:'not_asserted'};
}
/** Current Coordinator root can discover its committed, not-yet-dispatched intentions after a lost reply. */
export async function coordinatorContinuationContext(db,binding,readIssue,context){
 if(!binding.nativeCoordinatorPolicy)return {items:[],hasMore:false};
 const rows=await db.select().from(activityLog).where(and(eq(activityLog.companyId,binding.companyId),eq(activityLog.action,'issue.continuation_requested'),eq(activityLog.actorId,binding.agentId),sql`${activityLog.details}->>'rootIssueId' = ${binding.issueId}`,readIssue.id===binding.issueId?undefined:eq(activityLog.entityId,readIssue.id),sql`not exists (select 1 from ${agentWakeupRequests} wake where wake.company_id = ${binding.companyId} and wake.id::text = ${activityLog.details}->>'wakeId')`)).orderBy(sql`${activityLog.createdAt} desc`).limit(101),result=[];
 for(const row of rows.slice(0,100)){
  const request=row.details?.request;if(!request||createHash('sha256').update(canonical(request)).digest('hex')!==row.details.inputFingerprint||readIssue.id!==binding.issueId&&readIssue.id!==request.taskId)continue;
  let target=(await db.select().from(issues).where(and(eq(issues.id,request.taskId),eq(issues.companyId,binding.companyId),isNull(issues.hiddenAt))).limit(1))[0],node=target;const seen=new Set();
  while(node&&node.id!==binding.issueId&&!seen.has(node.id)&&seen.size<100){seen.add(node.id);if(!nativeCoordinatorProjectAllowed(binding,node)||!node.parentId){node=null;break;}node=(await db.select().from(issues).where(and(eq(issues.id,node.parentId),eq(issues.companyId,binding.companyId),isNull(issues.hiddenAt))).limit(1))[0];}
  if(!target||!node||node.id!==binding.issueId||!nativeCoordinatorProjectAllowed(binding,target)||target.assigneeAgentId!==request.expectedAssigneeActorId)continue;
  const read=await authorizationService(db).decide({actor:{type:'agent',source:'agent_jwt',companyId:binding.companyId,agentId:binding.agentId,runId:binding.runId,onBehalfOfUserId:context.run.responsibleUserId},action:'issue:read',resource:{type:'issue',companyId:binding.companyId,issueId:target.id,projectId:target.projectId,parentIssueId:target.parentId,assigneeAgentId:target.assigneeAgentId,assigneeUserId:target.assigneeUserId,status:target.status}});if(!read.allowed)continue;
  const [wake]=await db.select().from(agentWakeupRequests).where(and(eq(agentWakeupRequests.id,row.details.wakeId),eq(agentWakeupRequests.companyId,binding.companyId))).limit(1);
  result.push({intentId:row.id,targetTaskId:target.id,deliveryState:wake?.status??'awaiting_native_queue',wakeRequestId:wake?.id??null,runId:wake?.runId??null,...(!wake&&!['done','cancelled','in_review'].includes(target.status)?{recoveryArguments:request}:{})});
 }
 return {items:result,hasMore:rows.length>100,guidance:'Only undelivered intents for this Coordinator root are listed. If hasMore, inspect get_task_context(targetTaskId) for the relevant existing child. Replay saved recoveryArguments exactly; current authority is always rechecked.'};
}
