/** Ordinary source critique is a separately owned child, never native packet attention. */
import {createHash} from 'node:crypto';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export const sourceHash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const deny=()=>{throw Error('native_source_review_scope_denied');};
const normalize=p=>object(p)&&Array.isArray(p.projectIds)&&Array.isArray(p.issueIds)?{...p,projectIds:[...p.projectIds].sort(),issueIds:[...p.issueIds].sort()}:p;
export function sourceProposalHash(issue,parentId){
 const prefix=`paperclip-runner:create-task:${parentId}:source-review:`;
 if(issue?.originKind!=='manual'||typeof issue.originId!=='string'||!issue.originId.startsWith(prefix))return null;
 const proposalHash=issue.originId.slice(prefix.length);return /^[a-f0-9]{64}$/.test(proposalHash)?proposalHash:null;
}
export function selectSourceReviewAdmission(rows,binding,policy,nativeReview,context,root,parent){
 if(nativeReview)return null;
 const all=rows.filter(r=>r.pluginKey==='netrxn.inertia'&&r.config?.nativeCaseWork?.enabled===true);
 if(!all.length)return null;if(all.length!==1)deny();
 const row=all[0],c=row.config.nativeCaseWork,a=context.actor,i=context.issue,r=context.run;
 if(!String(i.originId??'').includes(':source-review:'))return null;
 const proposalHash=sourceProposalHash(i,parent?.id),prefix=`paperclip-runner:create-task:${c.rootIssueId}:case:`;
 if(!c.reviewer?.agentId||!c.reviewer?.principalId||new Set([c.researcher?.agentId,c.producer?.agentId,c.reviewer.agentId]).size!==3||new Set([c.researcher?.principalId,c.producer?.principalId,c.reviewer.principalId]).size!==3
 ||row.status!=='ready'||row.companyId!==binding.companyId||row.enabled===false
 ||a.id!==c.reviewer.agentId||a.id!==binding.agentId||a.companyId!==binding.companyId||a.role!=='general'||a.adapterType!=='paperclip_runner'||!['idle','running'].includes(a.status)
 ||a.adapterConfig?.provider!=='codex'||a.adapterConfig?.engine!=='cli'||a.adapterConfig?.disableCommandExecution!==true||a.adapterConfig?.codexPermissionMode!=='never'||a.adapterConfig?.dangerouslyBypassApprovalsAndSandbox!==false||a.adapterConfig?.dangerouslyBypassSandbox===true||a.adapterConfig?.nativeCoordinator!==undefined||Object.hasOwn(a.adapterConfig,'args')||Object.hasOwn(a.adapterConfig,'extraArgs')
 ||policy?.version!==1||policy.role!=='worker'||sourceHash(normalize(policy))!==sourceHash(normalize(a.adapterConfig.nativeFunding))||policy.portfolioRootIssueId!==c.rootIssueId||!policy.issueIds?.includes(c.rootIssueId)||!policy.projectIds?.includes(c.rootProjectId)||!policy.projectIds?.includes(c.projectId)
 ||!root||root.id!==c.rootIssueId||root.companyId!==binding.companyId||root.projectId!==c.rootProjectId||root.hiddenAt||['done','cancelled'].includes(root.status)
 ||!parent||parent.companyId!==binding.companyId||parent.projectId!==c.projectId||parent.parentId!==root.id||parent.hiddenAt||!['todo','in_progress','blocked'].includes(parent.status)||parent.workMode!=='standard'||parent.assigneeAgentId!==c.producer.agentId||parent.originKind!=='manual'||!parent.originId?.startsWith(prefix)
 ||!proposalHash||i.id!==binding.issueId||i.parentId!==parent.id||i.companyId!==binding.companyId||i.projectId!==c.projectId||i.hiddenAt||i.workMode!=='standard'||i.status!=='in_progress'||i.executionRunId!==binding.runId||i.assigneeAgentId!==binding.agentId
 ||r.id!==binding.runId||r.companyId!==binding.companyId||r.agentId!==binding.agentId||r.nativeIssueId!==binding.issueId||r.runtimeMode!=='native'||r.status!=='running'||r.finishedAt)deny();
 const caseBindingId=parent.originId.slice(prefix.length);if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(caseBindingId))deny();
 return Object.freeze({version:1,kind:'source-review',role:'reviewer',companyId:binding.companyId,projectId:i.projectId,issueId:i.id,agentId:a.id,runId:r.id,rootIssueId:root.id,producerIssueId:parent.id,caseBindingId,proposalHash,bindingHash:sourceHash(c),adapterHash:sourceHash(a.adapterConfig)});
}
export function sourceReviewTaskInput(admission,input,proposal,config){
 if(admission?.kind!=='case-work'||admission.role!=='producer'||!object(input)||Object.keys(input).sort().join()!=='proposalHash,purpose'||input.purpose!=='source_review'||!/^[a-f0-9]{64}$/.test(input.proposalHash)
 ||proposal?.proposal_hash!==input.proposalHash||proposal.case_binding_id!==admission.caseBindingId||proposal.producer_issue_id!==admission.issueId||typeof proposal.producer_run_id!=='string'||!proposal.producer_run_id||typeof proposal.record_id!=='string'||!proposal.record_id
 ||config.projectId!==admission.projectId||!config.reviewer?.agentId||!config.reviewer?.principalId||new Set([config.researcher?.agentId,config.producer?.agentId,config.reviewer.agentId]).size!==3||new Set([config.researcher?.principalId,config.producer?.principalId,config.reviewer.principalId]).size!==3)deny();
 return {idempotencyKey:'source-review:'+input.proposalHash,title:'Independent source review '+input.proposalHash.slice(0,12),description:'Review the exact source proposal '+input.proposalHash+' for case '+admission.caseBindingId+'. Read source_context, then source_review accept/reject or source_settlement for independently confirmed source drift. This task does not approve a funding packet or submission.',projectId:admission.projectId,assigneeActorId:config.reviewer.agentId,status:'todo'};
}
export function sourceReviewWakeId(child,binding,reviewerAgentId,proposalHash){
 return child?.companyId===binding.companyId&&child.parentId===binding.issueId&&child.assigneeAgentId===reviewerAgentId&&child.status==='todo'&&!child.hiddenAt&&sourceProposalHash(child,binding.issueId)===proposalHash?`created-child:${child.id}`:null;
}
export const SOURCE_REVIEW_CREATE_DEFINITION=Object.freeze({name:'create_task',description:'Create or recover the exact independent Charlie source-review child for this case. The server derives assignment, project, task content and idempotency; the child blocks this case until reviewed or settled as stale.',inputSchema:{type:'object',properties:{purpose:{type:'string',enum:['source_review']},proposalHash:{type:'string',pattern:'^[a-f0-9]{64}$'}},required:['purpose','proposalHash'],additionalProperties:false}});
export async function readSourceReviewProposal(db,binding,input){
 if(!object(input)||Object.keys(input).sort().join()!=='proposalHash,purpose'||input.purpose!=='source_review'||!/^[a-f0-9]{64}$/.test(input.proposalHash))deny();
 const [{and,eq},{plugins,pluginConfig,pluginCompanySettings,issues},{documentService},{readTaskProjectAdmission}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db'),import('../documents.js'),import('./native-case-work-tools.mjs')]);
 const admission=await readTaskProjectAdmission(db,binding,binding.nativeFundingPolicy?{version:binding.nativeFundingPolicy.version,role:'worker',projectIds:binding.nativeFundingPolicy.projectIds,issueIds:binding.nativeFundingPolicy.issueIds,portfolioRootIssueId:binding.nativeFundingPolicy.portfolioRootIssueId}:null,null);
 if(admission?.kind!=='case-work'||admission.role!=='producer'||sourceHash(admission)!==sourceHash(binding.nativeTaskProjectAdmission))deny();
 const rows=await db.select({config:pluginConfig.configJson,status:plugins.status,enabled:pluginCompanySettings.enabled}).from(plugins).innerJoin(pluginConfig,and(eq(pluginConfig.pluginId,plugins.id),eq(pluginConfig.companyId,binding.companyId))).leftJoin(pluginCompanySettings,and(eq(pluginCompanySettings.pluginId,plugins.id),eq(pluginCompanySettings.companyId,binding.companyId))).where(eq(plugins.pluginKey,'netrxn.inertia')).limit(2);
 if(rows.length!==1||rows[0].status!=='ready'||rows[0].enabled===false)deny();const config=rows[0].config?.nativeCaseWork;
 if(!config||sourceHash(config)!==admission.bindingHash)deny();
 const key='funding-'+createHash('sha256').update(JSON.stringify('case-source-proposal-'+input.proposalHash)).digest('hex').slice(0,32)+'-0000000001';
 const document=await documentService(db).getIssueDocumentByKey(binding.issueId,key);
 if(!document||document.companyId!==binding.companyId||document.issueId!==binding.issueId||document.latestRevisionNumber!==1)deny();
 let proposal;try{proposal=JSON.parse(document.body);}catch{deny();}
 if(proposal.version!=='inertia-case-source-proposal-v1'||proposal.company_id!==binding.companyId||proposal.project_id!==admission.projectId||proposal.root_issue_id!==admission.rootIssueId||proposal.producer_agent_id!==binding.agentId||proposal.producer_principal_id!==config.producer.principalId)deny();
 sourceReviewTaskInput(admission,input,proposal,config);return{proposal,config};
}
export function validateSourceReviewReceipt(a,c,value){
 const actor=(v,id,principal,issue)=>object(v)&&v.company_id===a.companyId&&v.project_id===a.projectId&&v.root_issue_id===c.rootIssueId&&v.root_project_id===c.rootProjectId&&v.applicant_slug===c.applicantSlug&&v.agent_id===id&&v.principal_id===principal&&v.issue_id===issue&&typeof v.run_id==='string'&&v.run_id.length>0;
 if(a?.kind!=='source-review'||!object(value)||value.proposal_hash!==a.proposalHash||value.case_binding_id!==a.caseBindingId||value.human_acceptance!=='not_accepted'||value.submission!=='not_submitted'||value.business_complete!==false||!Array.isArray(value.findings)||value.findings.some(v=>typeof v!=='string')||!actor(value.producer,c.producer.agentId,c.producer.principalId,a.producerIssueId)||!actor(value.reviewer,c.reviewer.agentId,c.reviewer.principalId,a.issueId)||value.producer.run_id===value.reviewer.run_id)deny();
 if(value.state==='accepted'){if(value.decision!=='accept'||value.findings.length)deny();}
 else if(value.state==='rejected'){if(value.decision!=='reject'||!value.findings.length)deny();}
 else if(value.state==='settled_source_drift'){if(value.decision!==undefined||!Array.isArray(value.drift)||!value.drift.length||value.drift.some(v=>!object(v)||typeof v.field!=='string'||!v.field||v.expected_hash===v.current_hash||![v.expected_hash,v.current_hash].every(h=>h===null||typeof h==='string')))deny();}
 else deny();
 return structuredClone(value);
}
async function sourceReviewFacts(db,binding,{completion=false}={}){
 const[{and,eq},{plugins,pluginConfig,pluginCompanySettings,agents,issues,heartbeatRuns}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const[context]=await db.select({actor:agents,issue:issues,run:heartbeatRuns}).from(heartbeatRuns).innerJoin(issues,eq(issues.id,binding.issueId)).innerJoin(agents,eq(agents.id,binding.agentId)).where(and(eq(heartbeatRuns.id,binding.runId),eq(heartbeatRuns.companyId,binding.companyId))).limit(1);if(!context)deny();
 const rows=await db.select({pluginKey:plugins.pluginKey,status:plugins.status,companyId:pluginConfig.companyId,config:pluginConfig.configJson,enabled:pluginCompanySettings.enabled}).from(plugins).innerJoin(pluginConfig,and(eq(pluginConfig.pluginId,plugins.id),eq(pluginConfig.companyId,binding.companyId))).leftJoin(pluginCompanySettings,and(eq(pluginCompanySettings.pluginId,plugins.id),eq(pluginCompanySettings.companyId,binding.companyId))).where(eq(plugins.pluginKey,'netrxn.inertia')).limit(2);
 const config=rows[0]?.config?.nativeCaseWork;if(!config)deny();
 const[root]=await db.select().from(issues).where(and(eq(issues.id,config.rootIssueId),eq(issues.companyId,binding.companyId))).limit(1);
 const[parent]=await db.select().from(issues).where(and(eq(issues.id,context.issue.parentId),eq(issues.companyId,binding.companyId))).limit(1);
 // Finalization may run after the owning native run has recorded success. Ownership is still exact.
 if(completion){if(!['running','succeeded'].includes(context.run.status))deny();context.run={...context.run,status:'running',finishedAt:null};}
 const admission=selectSourceReviewAdmission(rows,binding,context.actor.adapterConfig.nativeFunding,null,context,root,parent);if(!admission)deny();
 const {toolAccessPolicyService}=await import('../tool-access-policy.js');
 const decision=await toolAccessPolicyService(db).decide({companyId:binding.companyId,actor:{actorType:'agent',actorId:binding.agentId,agentId:binding.agentId},runContext:{heartbeatRunId:binding.runId,issueId:binding.issueId,projectId:admission.projectId},request:{toolName:'netrxn.inertia:funding_case_work',providerType:'paperclip_plugin',arguments:{operation:'source_receipt',parameters:{proposal_hash:admission.proposalHash}},sideEffecting:false},consumeRateLimit:false});
 if(decision?.allowed!==true||decision.decision!=='allow')deny();
 return{admission,config,context};
}
export async function recordSourceReviewSettlement(db,binding,call,result){
 const a=binding.nativeTaskProjectAdmission;if(a?.kind!=='source-review'||!['source_review','source_settlement','source_receipt'].includes(call.arguments?.operation))return;
 const {admission,config}=await sourceReviewFacts(db,binding);if(sourceHash(admission)!==sourceHash(a))deny();
 const payload=result?.data;const value=call.arguments.operation==='source_receipt'?payload?.receipt:payload;
 // Pending receipts have no terminal value and cannot authorize DONE.
 if(!value)return;
 const receipt=validateSourceReviewReceipt(a,config,value);
 if(call.arguments.operation!=='source_receipt'&&receipt.reviewer.run_id!==binding.runId)deny();
 const[{and,eq},{heartbeatRuns,activityLog},{documentService}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db'),import('../documents.js')]);
 const key='funding-'+createHash('sha256').update(JSON.stringify('case-source-proposal-'+a.proposalHash)).digest('hex').slice(0,32)+'-0000000001';
 const document=await documentService(db).getIssueDocumentByKey(a.producerIssueId,key);let proposal;try{proposal=JSON.parse(document?.body);}catch{deny();}
 if(document.latestRevisionNumber!==1||proposal.producer_run_id!==receipt.producer.run_id||proposal.proposal_hash!==a.proposalHash||proposal.case_binding_id!==a.caseBindingId||proposal.producer_issue_id!==a.producerIssueId)deny();
 for(const actor of[receipt.producer,receipt.reviewer]){const[run]=await db.select().from(heartbeatRuns).where(and(eq(heartbeatRuns.id,actor.run_id),eq(heartbeatRuns.companyId,a.companyId),eq(heartbeatRuns.agentId,actor.agent_id),eq(heartbeatRuns.nativeIssueId,actor.issue_id))).limit(1);if(!run||run.runtimeMode!=='native')deny();}
 await db.insert(activityLog).values({companyId:a.companyId,actorType:'system',actorId:'inertia.source-review',agentId:binding.agentId,runId:binding.runId,action:'inertia.source_review_settled',entityType:'issue',entityId:a.issueId,details:{version:1,admission:{...a,runId:null},receipt,receiptHash:sourceHash(receipt)}});
}
export async function assertSourceReviewCompletion(db,{issue,toStatus,runId}){
 if(toStatus!=='done'||!String(issue?.originId??'').includes(':source-review:'))return;
 const binding={companyId:issue.companyId,issueId:issue.id,agentId:issue.assigneeAgentId,runId};
 const{admission:a,config}=await sourceReviewFacts(db,binding,{completion:true});
 const[{and,eq},{activityLog}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const rows=await db.select().from(activityLog).where(and(eq(activityLog.companyId,a.companyId),eq(activityLog.entityId,a.issueId),eq(activityLog.action,'inertia.source_review_settled'),eq(activityLog.actorType,'system'),eq(activityLog.actorId,'inertia.source-review')));
 const receipt=rows.find(r=>r.details?.version===1&&sourceHash(r.details.admission)===sourceHash({...a,runId:null})&&r.details.receiptHash===sourceHash(r.details.receipt));
 if(!receipt)deny();validateSourceReviewReceipt(a,config,receipt.details.receipt);
}
// Not a JSON/API option. Only the validated native mutation path can opt into
// excluding completed exact source-review history from the helper's live quota.
export const SOURCE_REVIEW_CHILD_CONTINUATION=Symbol('inertia.native-source-review-child');

export const CASE_HISTORY_CONTINUATION=Symbol('inertia.native-case-history');
export function selectCaseHistoryContinuation(rows,binding,context,input){
 if(!binding.nativeCoordinatorPolicy||!/^case:[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.idempotencyKey??''))return null;
 const matches=rows.filter(r=>r.pluginKey==='netrxn.inertia'&&r.companyId===binding.companyId&&r.status==='ready'&&r.enabled!==false&&r.config?.nativeCaseWork?.enabled===true);
 if(matches.length!==1)return null;
 const c=matches[0].config.nativeCaseWork,i=context.issue;
 if(i.id!==binding.issueId||i.id!==c.rootIssueId||i.companyId!==binding.companyId||i.projectId!==c.rootProjectId||i.assigneeAgentId!==binding.agentId||i.hiddenAt||!['todo','in_progress','blocked'].includes(i.status)||input.projectId!==c.projectId||input.assigneeActorId!==c.producer?.agentId||!binding.nativeCoordinatorPolicy.projectIds?.includes(c.projectId)||!binding.nativeCoordinatorPolicy.projectIds?.includes(c.rootProjectId))return null;
 return{projectId:c.projectId,assigneeAgentId:c.producer.agentId};
}
export async function readCaseHistoryContinuation(db,binding,context,input){
 if(!binding.nativeCoordinatorPolicy||!String(input.idempotencyKey??'').startsWith('case:'))return null;
 const[{and,eq},{plugins,pluginConfig,pluginCompanySettings}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const rows=await db.select({pluginKey:plugins.pluginKey,status:plugins.status,companyId:pluginConfig.companyId,config:pluginConfig.configJson,enabled:pluginCompanySettings.enabled}).from(plugins).innerJoin(pluginConfig,and(eq(pluginConfig.pluginId,plugins.id),eq(pluginConfig.companyId,binding.companyId))).leftJoin(pluginCompanySettings,and(eq(pluginCompanySettings.pluginId,plugins.id),eq(pluginCompanySettings.companyId,binding.companyId))).where(eq(plugins.pluginKey,'netrxn.inertia')).limit(2);
 return selectCaseHistoryContinuation(rows,binding,context,input);
}
