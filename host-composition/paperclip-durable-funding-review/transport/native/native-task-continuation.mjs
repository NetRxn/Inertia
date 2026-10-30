/** Server-only durable task request. Serialized flags cannot acquire this authority. */
import {createHash} from 'node:crypto';
const trusted=new WeakSet(),deny=()=>{throw Error('native_task_continuation_binding_denied');};
export const CONTINUE_TASK_DEFINITION=Object.freeze({name:'continue_task',description:'Continue existing agent-owned work beneath this current Coordinator task without changing its owner. Read get_task_context continuationRequests for awaiting_native_queue recoveryArguments after a lost reply; replay them exactly. Read get_task_context(targetTaskId) or search_tasks first for assigneeAgentId and statusVersion. Use the same idempotencyKey when retrying. Clear ordinary blocked work resumes through normal admission; human/review/recovery/pause/dependency holds remain held. Receipt status is distinct from provider execution.',inputSchema:{type:'object',properties:{taskId:{type:'string',format:'uuid'},expectedAssigneeActorId:{type:'string',format:'uuid'},expectedStatusVersion:{type:'integer',minimum:0},idempotencyKey:{type:'string',minLength:1,maxLength:160},reason:{type:'string',minLength:1,maxLength:20000}},required:['taskId','expectedAssigneeActorId','expectedStatusVersion','idempotencyKey','reason'],additionalProperties:false}});
export function createDurableTaskContinuation(input){
 if(input.requestedByActorType!=='agent'||typeof input.authorize!=='function'||!input.id||!input.intentId||!/^[a-f0-9]{64}$/.test(input.fingerprint))deny();
 const request=Object.freeze({...input,idempotencyKey:'native-task-continuation:'+createHash('sha256').update(JSON.stringify([input.id,input.intentId,input.companyId,input.agentId,input.issueId,input.requestedByActorId,input.fingerprint])).digest('hex')});trusted.add(request);return request;
}
export function assertDurableTaskContinuation(request,scope){if(!trusted.has(request)||['companyId','agentId','issueId','requestedByActorType','requestedByActorId'].some(key=>!scope[key]||request[key]!==scope[key]))deny();}
export function assertTaskContinuationReceipt(request,receipt){if(receipt.payload?.issueId!==request.issueId||receipt.payload?.taskContinuationIntentId!==request.intentId||receipt.id!==request.id||['companyId','agentId','idempotencyKey','requestedByActorType','requestedByActorId'].some(key=>receipt[key]!==request[key]))throw Error('native_task_continuation_receipt_conflict');}
export function continuationHold(target,{pendingInteraction=false,pendingApproval=false,pendingToolReview=false,recovery=false,executionBlocker=false}={}){
 if(target.executionState?.status==='pending'||pendingInteraction||pendingApproval||pendingToolReview||recovery||executionBlocker)return 'pending_authority_or_recovery';
 const descriptor=target.unblockDescriptor;
 if(descriptor!=null&&(!descriptor||typeof descriptor!=='object'||Array.isArray(descriptor)||Object.keys(descriptor).some(key=>!['owner','action'].includes(key))||typeof descriptor.action!=='string'||!descriptor.action.trim()||!descriptor.owner||typeof descriptor.owner!=='object'||descriptor.owner.agentId!==target.assigneeAgentId||Object.keys(descriptor.owner).some(key=>key!=='agentId')))return 'unblock_owner_held';
 return null;
}
