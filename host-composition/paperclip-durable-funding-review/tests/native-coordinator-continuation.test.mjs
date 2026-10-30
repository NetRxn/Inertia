import test from 'node:test';import assert from 'node:assert/strict';
import {createDurableTaskContinuation,assertDurableTaskContinuation,assertTaskContinuationReceipt,CONTINUE_TASK_DEFINITION} from '../transport/native/native-task-continuation.mjs';
import {issueResumeAdmission} from '../transport/native/issue-resume-admission.mjs';
const actor={type:'agent',agentId:'co'},issue={id:'child',companyId:'company',status:'blocked',assigneeAgentId:'beta'};
const clear={lowTrust:false,pauseHold:null,dependencyReadiness:{unresolvedBlockerCount:0},canManage:true,mutationDecision:{allowed:false}};
test('shared normal resume admits clear blocked work and respects actual pause/dependency/peer authority',()=>{
 assert.equal(issueResumeAdmission({issue,actor,resumeIntent:true,...clear}),null);
 for(const patch of[{lowTrust:true},{pauseHold:{id:'pause'}},{dependencyReadiness:{unresolvedBlockerCount:1}},{canManage:false}])assert(issueResumeAdmission({issue,actor,resumeIntent:true,...clear,...patch}));
 assert.equal(issueResumeAdmission({issue:{...issue,assigneeAgentId:'co'},actor,resumeIntent:true,...clear,canManage:false}),null);
});
test('durable task continuation is server-branded and binds one exact native wake receipt',()=>{
 const input={id:'wake',requestedAt:new Date(0),companyId:'company',agentId:'beta',issueId:'child',requestedByActorType:'agent',requestedByActorId:'co',intentId:'intent',fingerprint:'a'.repeat(64),authorize:async()=>{}};
 const request=createDurableTaskContinuation(input),scope={companyId:'company',agentId:'beta',issueId:'child',requestedByActorType:'agent',requestedByActorId:'co'};
 assertDurableTaskContinuation(request,scope);assert.throws(()=>assertDurableTaskContinuation({...request},scope));assert.throws(()=>assertDurableTaskContinuation(request,{...scope,agentId:'other'}));
 const receipt={id:request.id,...scope,idempotencyKey:request.idempotencyKey,payload:{issueId:request.issueId,taskContinuationIntentId:request.intentId}};assertTaskContinuationReceipt(request,receipt);assert.throws(()=>assertTaskContinuationReceipt(request,{...receipt,id:'second-wake'}));assert.throws(()=>assertTaskContinuationReceipt(request,{...receipt,payload:{...receipt.payload,issueId:'foreign'}}));
 assert.equal(CONTINUE_TASK_DEFINITION.name,'continue_task');assert.equal(CONTINUE_TASK_DEFINITION.inputSchema.additionalProperties,false);assert(!('assigneeActorId' in CONTINUE_TASK_DEFINITION.inputSchema.properties));
});
test('ordinary null blocked descriptor is eligible but actual human/review/recovery and foreign descriptors hold',async()=>{
 const {continuationHold}=await import('../transport/native/native-task-continuation.mjs');const target={status:'blocked',assigneeAgentId:'beta',unblockDescriptor:null};
 assert.equal(continuationHold(target),null);assert.equal(continuationHold({...target,unblockDescriptor:{owner:{agentId:'beta'},action:'Continue saved research'}}),null);
 for(const descriptor of[{owner:'board'},{owner:{userId:'human'}},{owner:{agentId:'foreign'}},{unrecognized:true},{owner:{agentId:'beta'}},{owner:{agentId:'beta'},action:''},{owner:{agentId:'beta'},action:'continue',unknown:true},'unknown'])assert(continuationHold({...target,unblockDescriptor:descriptor}));
 for(const hold of['pendingInteraction','pendingApproval','pendingToolReview','recovery','executionBlocker'])assert(continuationHold(target,{[hold]:true}));
});
