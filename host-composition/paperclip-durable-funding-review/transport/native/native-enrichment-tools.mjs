/** Exact configured public-opportunity research tasks; delegates all meeting behavior unchanged. */
import * as meeting from './native-task-project-tools.mjs';
import {createHash} from 'node:crypto';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const deny=()=>{throw Error('native_enrichment_admission_denied');};
const normalizedPolicy=v=>object(v)&&Array.isArray(v.projectIds)&&Array.isArray(v.issueIds)?{...v,projectIds:[...v.projectIds].sort(),issueIds:[...v.issueIds].sort()}:v;
const canonicalTool='netrxn.inertia:funding_enrichment';
const projected=()=>{const s=v=>v.replace(/[^a-zA-Z0-9_]+/g,'_').replace(/^_+|_+$/g,'');const i=canonicalTool.lastIndexOf(':');return `app_${s(canonicalTool.slice(0,i)).slice(0,20)}_${s(canonicalTool.slice(i+1)).slice(-26)}_${createHash('sha256').update(canonicalTool).digest('hex').slice(0,12)}`;};
export function selectEnrichmentAdmission(rows,binding,policy,nativeReview,context,root){
 if(nativeReview)return null;
 const all=rows.filter(r=>r.pluginKey==='netrxn.inertia'&&r.config?.generalEnrichment?.enabled===true);
 if(!all.length)return null;if(all.length!==1)deny();
 const row=all[0],c=row.config.generalEnrichment,issue=context.issue,actor=context.actor,run=context.run,a=actor.adapterConfig;
 if(issue.projectId!==c.projectId)return null;
 if(row.status!=='ready'||row.companyId!==binding.companyId||row.settingsPresent&&row.enabled!==true)deny();
 const role=c.producer?.agentId===binding.agentId?'researcher':c.reviewer?.agentId===binding.agentId?'reviewer':null;
 if(!role||!c.producer?.principalId||!c.reviewer?.principalId||c.producer.agentId===c.reviewer.agentId||c.producer.principalId===c.reviewer.principalId)deny();
 if(actor.role!=='general'||actor.adapterType!=='paperclip_runner'||['paused','terminated','pending_approval','error'].includes(actor.status)||actor.id!==binding.agentId||actor.companyId!==binding.companyId
  ||a.provider!=='codex'||a.engine!=='cli'||a.disableCommandExecution!==true||a.dangerouslyBypassApprovalsAndSandbox!==false||a.dangerouslyBypassSandbox===true||a.codexPermissionMode!=='never'||a.nativeCoordinator!==undefined
  ||['extraArgs','args'].some(k=>a[k]!==undefined&&(!Array.isArray(a[k])||a[k].length))||policy?.role!=='worker'||canonical(normalizedPolicy(policy))!==canonical(normalizedPolicy(a.nativeFunding))||policy.portfolioRootIssueId!==c.rootIssueId||!policy.issueIds?.includes(c.rootIssueId)||!policy.projectIds?.includes(c.projectId)||!policy.projectIds?.includes(c.rootProjectId))deny();
 if(!root||root.id!==c.rootIssueId||root.companyId!==binding.companyId||root.projectId!==c.rootProjectId||root.hiddenAt||['done','cancelled'].includes(root.status)
  ||issue.id!==binding.issueId||issue.parentId!==root.id||issue.companyId!==binding.companyId||issue.hiddenAt||issue.workMode!=='standard'||issue.assigneeAgentId!==binding.agentId||issue.executionRunId!==binding.runId||!['todo','in_progress','blocked'].includes(issue.status)
  ||run.id!==binding.runId||run.companyId!==binding.companyId||run.agentId!==binding.agentId||run.nativeIssueId!==binding.issueId||run.runtimeMode!=='native'||run.status!=='running'||run.finishedAt)deny();
 return Object.freeze({version:1,kind:'enrichment',role,companyId:binding.companyId,projectId:issue.projectId,issueId:binding.issueId,agentId:binding.agentId,runId:binding.runId,bindingHash:hash([c,root.id,root.projectId]),adapterHash:hash(a)});
}
export async function readTaskProjectAdmission(db,binding,policy,nativeReview,context){
 const [{and,eq},{plugins,pluginCompanySettings,pluginConfig,agents,issues,heartbeatRuns}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 if(!context){[context]=await db.select({actor:agents,issue:issues,run:heartbeatRuns}).from(heartbeatRuns).innerJoin(issues,eq(issues.id,binding.issueId)).innerJoin(agents,eq(agents.id,binding.agentId)).where(and(eq(heartbeatRuns.id,binding.runId),eq(heartbeatRuns.companyId,binding.companyId))).limit(1);}
 if(!context)deny();
 const rows=await db.select({pluginKey:plugins.pluginKey,status:plugins.status,companyId:pluginConfig.companyId,config:pluginConfig.configJson,settingsId:pluginCompanySettings.id,enabled:pluginCompanySettings.enabled}).from(plugins).innerJoin(pluginConfig,and(eq(pluginConfig.pluginId,plugins.id),eq(pluginConfig.companyId,binding.companyId))).leftJoin(pluginCompanySettings,and(eq(pluginCompanySettings.pluginId,plugins.id),eq(pluginCompanySettings.companyId,binding.companyId))).where(eq(plugins.pluginKey,'netrxn.inertia')).limit(2);
 const candidates=rows.filter(r=>r.config?.generalEnrichment?.enabled===true&&r.config.generalEnrichment.projectId===context.issue.projectId);
 if(!candidates.length)return meeting.readTaskProjectAdmission(db,binding,policy,nativeReview,context);
 if(candidates.length!==1)deny();
 const [root]=await db.select().from(issues).where(and(eq(issues.id,candidates[0].config.generalEnrichment.rootIssueId),eq(issues.companyId,binding.companyId))).limit(1);
 return selectEnrichmentAdmission(rows.map(r=>({...r,settingsPresent:r.settingsId!=null})),binding,policy,nativeReview,context,root);
}
export function isTaskProjectTool(binding,name){return binding.nativeTaskProjectAdmission?.kind==='enrichment'?name===projected():meeting.isTaskProjectTool(binding,name);}
export async function assertFreshTaskProject(db,binding,context){
 if(binding.nativeTaskProjectAdmission?.kind!=='enrichment')return meeting.assertFreshTaskProject(db,binding,context);
 const current=await readTaskProjectAdmission(db,binding,context.actor.adapterConfig.nativeFunding??null,binding.nativeReview,context);
 if(!current||hash(current)!==hash(binding.nativeTaskProjectAdmission))deny();return current;
}
export async function taskProjectDefinitions(binding,context){
 if(binding.nativeTaskProjectAdmission?.kind!=='enrichment')return meeting.taskProjectDefinitions(binding,context);
 await context();if(typeof binding.assignedMcpTools?.definitionsFresh!=='function')deny();
 const tools=(await binding.assignedMcpTools.definitionsFresh('standard')).filter(t=>t.name===projected());
 if(tools.length!==1)deny();await context();return structuredClone(tools);
}
export async function executeTaskProjectTool(binding,call,context){
 if(binding.nativeTaskProjectAdmission?.kind!=='enrichment')return meeting.executeTaskProjectTool(binding,call,context);
 if(!isTaskProjectTool(binding,call.tool)||!binding.assignedMcpTools?.has(call.tool))deny();
 await taskProjectDefinitions(binding,context);const result=await binding.assignedMcpTools.execute(call,'standard');await context();return result;
}
