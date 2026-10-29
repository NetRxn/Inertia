/** Resource deadlines for two existing native tools. This never grants tool access. */
import { readTaskProjectAdmission } from './native-case-work-tools.mjs';
import { readEntityAdmission, entityHash } from './native-entity-context.mjs';
export const NATIVE_INERTIA_RESOURCE_KIND = 'inertia-native-resource-v1';
export const NATIVE_INERTIA_RESOURCE_TOOLS = Object.freeze(['netrxn.inertia:funding_case_work','netrxn.inertia:entity_context']);
export const NATIVE_INERTIA_RESOURCE_OVERHEAD = Object.freeze({rpcMs:40_000,gatewayMs:50_000});
const CASE=NATIVE_INERTIA_RESOURCE_TOOLS[0],ENTITY=NATIVE_INERTIA_RESOURCE_TOOLS[1];
const caseOperations=new Set(['context','checkpoint','prepare','workspace','save','save_assumption','save_gap_progress','render','packet','packet_artifacts','packet_artifact_chunk','source_context','source_links','source_capture','source_propose','source_receipt']);
const sourceOperations=new Set(['source_context','source_review','source_receipt','source_settlement']);
const entityOperations=new Set(['context','search','refresh']);
const fields=['version','kind','role','companyId','agentId','runId','issueId','projectId','toolName','invocationId','bindingHash','startedAt','operationTimeoutMs','operationDeadlineAt','rpcDeadlineAt','gatewayDeadlineAt'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const duration=v=>Number.isInteger(v)&&v>=100&&v<=120_000;
const sameSet=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a).size===a.length&&a.every((v,i)=>typeof v==='string'&&v===b[i]);
const invalid=()=>{throw Error('native_inertia_execution_policy_invalid');};
function assigned(input){
 const a=input.assignment,p=a?.pinned;
 return a?.valid===true&&p?.version===1&&p.agentId===input.agentId&&Array.isArray(p.connections)&&p.connections.length===0&&Array.isArray(p.tools)&&p.tools.length===0&&sameSet(a.names,p.pluginTools)&&a.names.includes(input.toolName);
}
/** The named gateway already validates its pinned SDK ceiling. Native authority supplies the narrower role/catalog. */
export async function resolveNativeInertiaExecutionPolicy(db,input){
 if(!NATIVE_INERTIA_RESOURCE_TOOLS.includes(input.toolName)||!assigned(input)||!Number.isSafeInteger(input.startedAt)||input.startedAt>Date.now())return null;
 const p=input.policyInput,operation=p?.request?.arguments?.operation;
 if(p?.companyId!==input.companyId||p.actor?.actorType!=='agent'||p.actor.agentId!==input.agentId||p.runContext?.heartbeatRunId!==input.runId||p.request?.toolName!==input.toolName||p.request?.providerType!=='paperclip_plugin')return null;
 const [{and,eq},s,{toolAccessPolicyService}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db'),import('../tool-access-policy.js')]);
 const key=input.toolName===CASE?'nativeCaseWork':'entityContext';
 async function current(){
  const [context]=await db.select({actor:s.agents,issue:s.issues,run:s.heartbeatRuns}).from(s.heartbeatRuns).innerJoin(s.issues,eq(s.issues.id,s.heartbeatRuns.nativeIssueId)).innerJoin(s.agents,eq(s.agents.id,s.heartbeatRuns.agentId)).where(and(eq(s.heartbeatRuns.id,input.runId),eq(s.heartbeatRuns.companyId,input.companyId),eq(s.agents.id,input.agentId))).limit(1);
  if(!context||context.run.runtimeMode!=='native'||context.run.status!=='running'||context.run.finishedAt||context.issue.companyId!==input.companyId||p.runContext.issueId!==context.issue.id||p.runContext.projectId!==context.issue.projectId)return null;
  const binding={companyId:input.companyId,agentId:input.agentId,runId:input.runId,issueId:context.issue.id};
  const admission=input.toolName===CASE?await readTaskProjectAdmission(db,binding,context.actor.adapterConfig?.nativeFunding,null,context):await readEntityAdmission(db,binding,context);
  if(input.toolName===CASE?!(admission?.kind==='case-work'&&admission.role==='producer'&&caseOperations.has(operation)||admission?.kind==='source-review'&&admission.role==='reviewer'&&sourceOperations.has(operation)&&p.request.arguments.parameters?.proposal_hash===admission.proposalHash):!admission||!entityOperations.has(operation)||operation==='refresh'&&!admission.canRefresh)return null;
  const rows=await db.select({config:s.pluginConfig.configJson,status:s.plugins.status,enabled:s.pluginCompanySettings.enabled}).from(s.plugins).innerJoin(s.pluginConfig,and(eq(s.pluginConfig.pluginId,s.plugins.id),eq(s.pluginConfig.companyId,input.companyId))).leftJoin(s.pluginCompanySettings,and(eq(s.pluginCompanySettings.pluginId,s.plugins.id),eq(s.pluginCompanySettings.companyId,input.companyId))).where(eq(s.plugins.pluginKey,'netrxn.inertia')).limit(2);
  if(rows.length!==1||rows[0].status!=='ready'||rows[0].enabled===false)return null;
  const config=rows[0].config?.[key],operationTimeoutMs=config?.process?.timeoutMs;
  if(config?.enabled!==true||entityHash(config)!==admission.bindingHash||!duration(operationTimeoutMs))return null;
  return{admission,operationTimeoutMs};
 }
 const before=await current();if(!before)return null;
 const decision=await toolAccessPolicyService(db).decide({...p,consumeRateLimit:false});
 if(decision?.allowed!==true||decision.decision!=='allow')throw Error('native_inertia_execution_grant_denied');
 const after=await current();if(!after||entityHash(after)!==entityHash(before))throw Error('native_inertia_execution_scope_changed');
 const b=after.admission,n=after.operationTimeoutMs,t=input.startedAt;
 const result=Object.freeze({version:1,kind:NATIVE_INERTIA_RESOURCE_KIND,role:b.role,companyId:b.companyId,agentId:b.agentId,runId:b.runId,issueId:b.issueId,projectId:b.projectId,toolName:input.toolName,invocationId:input.invocationId,bindingHash:b.bindingHash,startedAt:t,operationTimeoutMs:n,operationDeadlineAt:t+n,rpcDeadlineAt:t+n+NATIVE_INERTIA_RESOURCE_OVERHEAD.rpcMs,gatewayDeadlineAt:t+n+NATIVE_INERTIA_RESOURCE_OVERHEAD.gatewayMs});
 return validateNativeInertiaExecutionPolicy(result,input.toolName,{companyId:b.companyId,agentId:b.agentId,runId:b.runId,projectId:b.projectId});
}
/** Internal dispatcher argument only: resource metadata is never added to plugin/model context. */
export function validateNativeInertiaExecutionPolicy(policy,toolName,runContext){
 if(Object.hasOwn(runContext,'fundingExecution')||Object.hasOwn(runContext,'nativeInertiaExecution'))invalid();
 if(!object(policy)||Object.keys(policy).length!==fields.length||fields.some(k=>!Object.hasOwn(policy,k))||policy.version!==1||policy.kind!==NATIVE_INERTIA_RESOURCE_KIND||!NATIVE_INERTIA_RESOURCE_TOOLS.includes(toolName)||policy.toolName!==toolName||!['companyId','agentId','runId','issueId','projectId','invocationId'].every(k=>uuid(policy[k]))||!['companyId','agentId','runId','projectId'].every(k=>policy[k]===runContext[k])||!hash(policy.bindingHash)||!duration(policy.operationTimeoutMs)||!Number.isSafeInteger(policy.startedAt)||policy.startedAt>Date.now()||policy.operationDeadlineAt!==policy.startedAt+policy.operationTimeoutMs||policy.rpcDeadlineAt!==policy.operationDeadlineAt+NATIVE_INERTIA_RESOURCE_OVERHEAD.rpcMs||policy.gatewayDeadlineAt!==policy.operationDeadlineAt+NATIVE_INERTIA_RESOURCE_OVERHEAD.gatewayMs||(toolName===CASE?!['producer','reviewer'].includes(policy.role):!['reader','researcher','reviewer'].includes(policy.role)))invalid();
 if(policy.operationDeadlineAt<=Date.now())throw Error('native_inertia_execution_deadline_exhausted');
 return policy;
}
