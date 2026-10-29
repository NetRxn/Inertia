/** Exact existing funding-role ceiling; native Paperclip retains lifecycle authority. */
import { createHash } from 'node:crypto';
export const NATIVE_FUNDING_PRODUCER_TOOLS = Object.freeze(['funding_drafting_workspace','save_funding_proposals','save_funding_gap_progress','funding_drafting_checkpoint'].map(name => 'netrxn.inertia:' + name));
export const NATIVE_FUNDING_REVIEW_TOOLS = Object.freeze(['get_task_context','get_task_history','list_documents','read_document','list_document_revisions','resolve_review','record_preparation_review']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join() === [...keys].sort().join();
const ids=values=>Array.isArray(values)&&values.length>=1&&values.length<=16&&values.every(id=>typeof id==='string'&&uuid.test(id))&&new Set(values).size===values.length;
function projectedName(name) {
 const sanitize=value=>value.replace(/[^a-zA-Z0-9_]+/g,'_').replace(/^_+|_+$/g,'');
 const separator=name.lastIndexOf(':');
 return `app_${sanitize(name.slice(0,separator)).slice(0,20)}_${sanitize(name.slice(separator+1)).slice(-26)}_${createHash('sha256').update(name).digest('hex').slice(0,12)}`;
}
const producerNames=Object.freeze(NATIVE_FUNDING_PRODUCER_TOOLS.map(projectedName));
export function normalizeNativeFundingPolicy(config={}) {
 if(config.nativeFunding===undefined)return null;
 const p=config.nativeFunding;
 if(!(exact(p,['version','role','projectIds','issueIds'])||exact(p,['version','role','projectIds','issueIds','portfolioRootIssueId'])&&uuid.test(p.portfolioRootIssueId)&&p.issueIds?.includes(p.portfolioRootIssueId))||p.version!==1||!['producer','reviewer','worker'].includes(p.role)||!ids(p.projectIds)||!ids(p.issueIds)
  ||config.nativeCoordinator!==undefined||config.provider!=='codex'||config.engine!=='cli'||config.disableCommandExecution!==true
  ||config.dangerouslyBypassApprovalsAndSandbox!==false||config.dangerouslyBypassSandbox===true||config.codexPermissionMode!=='never'
  ||Object.hasOwn(config,'extraArgs')||Object.hasOwn(config,'args'))throw Error('native_funding_configuration_invalid');
 return Object.freeze({version:1,role:p.role,projectIds:Object.freeze([...p.projectIds].sort()),issueIds:Object.freeze([...p.issueIds].sort()),...(p.portfolioRootIssueId?{portfolioRootIssueId:p.portfolioRootIssueId}:{})});
}
export function nativeFundingToolNames(policy) {
 if(policy?.role==='producer')return producerNames;
 if(policy?.role==='reviewer')return NATIVE_FUNDING_REVIEW_TOOLS;
 throw Error('native_funding_scope_revoked');
}
export function assertNativeFundingTool(policy,tool) {
 if(!nativeFundingToolNames(policy).includes(tool))throw Error('native_funding_tool_denied');
}
export function assertNativeFundingContext(binding,context) {
 const p=binding.nativeFundingPolicy;if(!p)return;
 let now=normalizeNativeFundingPolicy(context.actor.adapterConfig);
 if(now?.role==='worker')now={...now,role:binding.nativeReview?'reviewer':'producer'};
 if(binding.nativeCoordinatorPolicy||p.companyId!==binding.companyId||p.agentId!==binding.agentId
  ||context.actor.id!==binding.agentId||context.actor.companyId!==binding.companyId||context.actor.role!=='general'
  ||context.actor.adapterType!=='paperclip_runner'||['paused','terminated','pending_approval','error'].includes(context.actor.status)
  ||!now||JSON.stringify(now)!==JSON.stringify({version:p.version,role:p.role,projectIds:p.projectIds,issueIds:p.issueIds,...(p.portfolioRootIssueId?{portfolioRootIssueId:p.portfolioRootIssueId}:{})})
  ||context.issue.companyId!==binding.companyId||context.issue.id!==binding.issueId||context.issue.hiddenAt
  ||!p.projectIds.includes(context.issue.projectId)||!(p.issueIds.includes(context.issue.id)&&context.issue.id!==p.portfolioRootIssueId||p.portfolioRootIssueId&&context.issue.parentId===p.portfolioRootIssueId&&context.issue.id!==p.portfolioRootIssueId)
  ||context.run.id!==binding.runId||context.run.companyId!==binding.companyId||context.run.agentId!==binding.agentId
  ||context.run.nativeIssueId!==binding.issueId||context.run.runtimeMode!=='native'||context.run.status!=='running'
  ||(p.role==='reviewer')!==Boolean(binding.nativeReview))throw Error('native_funding_scope_revoked');
}
