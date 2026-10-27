/** Default-disabled task-specific selection. No grants, preapproval or state writes. */
import {createHash} from 'node:crypto';
import {normalizeNativeFundingPolicy} from './native-funding-policy.js';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\x00-\x1f]/.test(v);
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export const discoveryFingerprint=v=>createHash('sha256').update(canonical(v)).digest('hex');
const denied=()=>{throw Error('native_discovery_admission_denied');};
export const DISCOVERY_CANONICAL_TOOLS=Object.freeze({
 scout:Object.freeze(['funding-discovery-context','funding-discovery-submit'].map(n=>'netrxn.inertia:'+n)),
 diligence:Object.freeze(['funding-diligence-context','funding-diligence-submit','funding-source-validation-submit','funding-facts-submit'].map(n=>'netrxn.inertia:'+n)),
});
const projected=n=>{const s=v=>v.replace(/[^a-zA-Z0-9_]+/g,'_').replace(/^_+|_+$/g,'');const i=n.lastIndexOf(':');return `app_${s(n.slice(0,i)).slice(0,20)}_${s(n.slice(i+1)).slice(-26)}_${createHash('sha256').update(n).digest('hex').slice(0,12)}`;};
export function nativeDiscoveryToolNames(admission){if(!DISCOVERY_CANONICAL_TOOLS[admission?.role])return denied();return DISCOVERY_CANONICAL_TOOLS[admission.role].map(projected);}
export function assertDiscoveryTool(admission,name){if(!nativeDiscoveryToolNames(admission).includes(name))denied();}

/** rows are fresh native plugin/config/settings records, never tool arguments. */
export function selectNativeDiscoveryAdmission(rows,binding,policy,context,nativeReview){
 if(!policy)return null;
 const candidates=rows.filter(r=>r.pluginKey==='netrxn.inertia'&&r.config?.fundingDiscovery?.enabled===true&&
  [r.config.fundingDiscovery.issueId,r.config.fundingDiscovery.diligence?.issueId].includes(binding.issueId));
 if(candidates.length===0)return null;
 if(candidates.length!==1||nativeReview)return denied();
 const row=candidates[0],c=row.config.fundingDiscovery;
 if(row.status!=='ready'||row.companyId!==binding.companyId||row.settingsPresent&&row.enabled!==true
  ||!id(c.key)||!id(c.organizationId)||!id(c.projectId)||!id(c.principalId)||!object(c.process)
  ||!Array.isArray(c.publicQueries)||!c.publicQueries.length||c.publicQueries.length>10
  ||c.publicQueries.some(q=>typeof q!=='string'||!q.trim()||q.length>500||/[\x00-\x1f]/.test(q)))denied();
 const role=c.issueId===binding.issueId?'scout':'diligence';
 const actor=role==='scout'?c:c.diligence;
 if(!actor||actor.agentId!==binding.agentId||!id(actor.principalId)||!object(actor.process)
  ||c.projectId!==context.issue.projectId||!policy.projectIds.includes(c.projectId)||!policy.issueIds.includes(binding.issueId)
  ||policy.role!==(role==='scout'?'producer':'reviewer')
  ||c.diligence&&(c.diligence.issueId===c.issueId||c.diligence.agentId===c.agentId||c.diligence.principalId===c.principalId))denied();
 let now;try{now=normalizeNativeFundingPolicy(context.actor.adapterConfig);}catch{return denied();}
 if(canonical(now)!==canonical({version:policy.version,role:policy.role,projectIds:policy.projectIds,issueIds:policy.issueIds})||context.actor.id!==binding.agentId||context.actor.companyId!==binding.companyId
  ||context.actor.role!=='general'||context.actor.adapterType!=='paperclip_runner'||['paused','terminated','pending_approval','error'].includes(context.actor.status)
  ||context.issue.id!==binding.issueId||context.issue.companyId!==binding.companyId||context.issue.hiddenAt
  ||context.issue.assigneeAgentId!==binding.agentId||context.issue.executionRunId!==binding.runId||context.issue.workMode!=='standard'
  ||context.run.id!==binding.runId||context.run.companyId!==binding.companyId||context.run.agentId!==binding.agentId
  ||context.run.nativeIssueId!==binding.issueId||context.run.runtimeMode!=='native'||context.run.status!=='running')denied();
 return Object.freeze({version:1,role,companyId:binding.companyId,projectId:c.projectId,issueId:binding.issueId,agentId:binding.agentId,
  runId:binding.runId,key:c.key,principalId:actor.principalId,bindingHash:discoveryFingerprint(c),publicQueries:Object.freeze([...c.publicQueries])});
}

export async function readNativeDiscoveryAdmission(db,binding,policy,nativeReview,context){
 if(!policy)return null;
 const [{and,eq},{plugins,pluginCompanySettings,pluginConfig,agents,issues,heartbeatRuns}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 if(!context){[context]=await db.select({actor:agents,issue:issues,run:heartbeatRuns}).from(heartbeatRuns)
  .innerJoin(issues,eq(issues.id,binding.issueId)).innerJoin(agents,eq(agents.id,binding.agentId))
  .where(and(eq(heartbeatRuns.id,binding.runId),eq(heartbeatRuns.companyId,binding.companyId))).limit(1);}
 if(!context)denied();
 const rows=await db.select({pluginKey:plugins.pluginKey,status:plugins.status,companyId:pluginConfig.companyId,config:pluginConfig.configJson,
  settingsId:pluginCompanySettings.id,enabled:pluginCompanySettings.enabled}).from(plugins)
  .innerJoin(pluginConfig,and(eq(pluginConfig.pluginId,plugins.id),eq(pluginConfig.companyId,binding.companyId)))
  .leftJoin(pluginCompanySettings,and(eq(pluginCompanySettings.pluginId,plugins.id),eq(pluginCompanySettings.companyId,binding.companyId)))
  .where(eq(plugins.pluginKey,'netrxn.inertia')).limit(2);
 return selectNativeDiscoveryAdmission(rows.map(r=>({...r,settingsPresent:r.settingsId!=null})),binding,policy,context,nativeReview);
}
export async function assertFreshNativeDiscovery(db,binding,context){
 const fresh=await readNativeDiscoveryAdmission(db,binding,binding.nativeFundingPolicy,binding.nativeReview,context);
 if(!fresh||discoveryFingerprint(fresh)!==discoveryFingerprint(binding.nativeDiscoveryAdmission))denied();return fresh;
}
export async function discoveryDefinitions(binding,context){
 await context();const assigned=binding.assignedMcpTools,allowed=nativeDiscoveryToolNames(binding.nativeDiscoveryAdmission);
 if(typeof assigned?.definitionsFresh!=='function')denied();
 const tools=(await assigned.definitionsFresh('standard')).filter(t=>allowed.includes(t.name));
 if(tools.length!==allowed.length||new Set(tools.map(t=>t.name)).size!==allowed.length)denied();
 await context();return tools.map(t=>structuredClone(t));
}
export async function executeDiscoveryTool(binding,call,context){
 assertDiscoveryTool(binding.nativeDiscoveryAdmission,call.tool);await context();
 const tools=await discoveryDefinitions(binding,context);
 if(!tools.some(t=>t.name===call.tool)||!binding.assignedMcpTools.has(call.tool))denied();
 const result=await binding.assignedMcpTools.execute(call,'standard');await context();return result;
}
