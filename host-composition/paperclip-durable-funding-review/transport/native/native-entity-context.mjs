/** Generic configured public entity access; private/native/task authority stays separate. */
import{createHash}from'node:crypto';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v),canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export const entityHash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const deny=()=>{throw Error('native_entity_context_scope_denied');};
export const ENTITY_TOOL='netrxn.inertia:entity_context';
const projected=n=>{const s=v=>v.replace(/[^a-zA-Z0-9_]+/g,'_').replace(/^_+|_+$/g,'');const i=n.lastIndexOf(':');return'app_'+s(n.slice(0,i)).slice(0,20)+'_'+s(n.slice(i+1)).slice(-26)+'_'+createHash('sha256').update(n).digest('hex').slice(0,12);};
export const ENTITY_PROJECTED_TOOL=projected(ENTITY_TOOL);
export function selectEntityAdmission(rows,binding,context,review=null){
 const all=rows.filter(r=>r.pluginKey==='netrxn.inertia'&&r.config?.entityContext?.enabled===true);
 if(!all.length)return null;if(all.length!==1)deny();
 const row=all[0],c=row.config.entityContext,a=context.actor,i=context.issue,r=context.run;
 const grants=c.actorGrants?.filter(g=>g.agentId===binding.agentId&&g.projectIds?.includes(i.projectId))??[];
 if(!grants.length)return null;if(grants.length!==1)deny();const g=grants[0];
 if(row.status!=='ready'||row.enabled===false||row.companyId!==binding.companyId||typeof g.principalId!=='string'||!g.principalId||typeof g.canRefresh!=='boolean'
  ||a.id!==binding.agentId||a.companyId!==binding.companyId||!['general','ceo'].includes(a.role)||a.adapterType!=='paperclip_runner'||!['idle','running'].includes(a.status)
  ||a.adapterConfig?.provider!=='codex'||a.adapterConfig?.engine!=='cli'||a.adapterConfig?.disableCommandExecution!==true||a.adapterConfig?.codexPermissionMode!=='never'||a.adapterConfig?.dangerouslyBypassApprovalsAndSandbox!==false||a.adapterConfig?.dangerouslyBypassSandbox===true||Object.hasOwn(a.adapterConfig,'args')||Object.hasOwn(a.adapterConfig,'extraArgs')
  ||i.id!==binding.issueId||i.companyId!==binding.companyId||i.hiddenAt||r.id!==binding.runId||r.companyId!==binding.companyId||r.agentId!==binding.agentId||r.nativeIssueId!==binding.issueId||r.runtimeMode!=='native'||r.status!=='running'||r.finishedAt)deny();
 const owned=i.assigneeAgentId===binding.agentId&&i.executionRunId===binding.runId&&['todo','in_progress','blocked'].includes(i.status);
 if(!review&&!owned)deny();
 const role=review?'reviewer':g.canRefresh?'researcher':'reader',canRefresh=!review&&owned&&g.canRefresh&&i.status==='in_progress';
 return Object.freeze({version:1,companyId:binding.companyId,projectId:i.projectId,issueId:i.id,agentId:a.id,runId:r.id,principalId:g.principalId,role,canRefresh,bindingHash:entityHash(c),review,adapterHash:entityHash(a.adapterConfig)});
}
export function entityExecution(admission){if(!admission)deny();const{adapterHash,...safe}=admission;return safe;}
export async function readEntityAdmission(db,binding,context){
 const[{and,eq},{plugins,pluginConfig,pluginCompanySettings,agents,issues,heartbeatRuns}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 if(!context)[context]=await db.select({actor:agents,issue:issues,run:heartbeatRuns}).from(heartbeatRuns).innerJoin(issues,eq(issues.id,binding.issueId)).innerJoin(agents,eq(agents.id,binding.agentId)).where(and(eq(heartbeatRuns.id,binding.runId),eq(heartbeatRuns.companyId,binding.companyId))).limit(1);
 if(!context)deny();
 const rows=await db.select({pluginKey:plugins.pluginKey,status:plugins.status,companyId:pluginConfig.companyId,config:pluginConfig.configJson,enabled:pluginCompanySettings.enabled}).from(plugins).innerJoin(pluginConfig,and(eq(pluginConfig.pluginId,plugins.id),eq(pluginConfig.companyId,binding.companyId))).leftJoin(pluginCompanySettings,and(eq(pluginCompanySettings.pluginId,plugins.id),eq(pluginCompanySettings.companyId,binding.companyId))).where(eq(plugins.pluginKey,'netrxn.inertia')).limit(2);
 const config=rows.find(r=>r.config?.entityContext?.enabled===true)?.config.entityContext;
 if(!config||!config.actorGrants?.some(g=>g.agentId===binding.agentId&&g.projectIds?.includes(context.issue.projectId)))return null;
 const{getNativeReviewAssignment,readNativeReviewAssignmentContext}=await import("./native-review-participant.js");
 const snapshot=readNativeReviewAssignmentContext(context.run.contextSnapshot);
 let review=null;
 if(snapshot){
  const current=await getNativeReviewAssignment(db,{...binding,contextSnapshot:snapshot,actingRunId:binding.runId,allowResolvedByRunId:binding.runId});if(!current)deny();
  review={interactionId:current.interaction.id,decisionId:current.sourceDecision.id,producerRunId:current.sourceRun.id,producerAgentId:current.sourceRun.agentId};
 }
 return selectEntityAdmission(rows,binding,context,review);
}
async function fresh(db,binding,context){
 const row=await context(),a=await readEntityAdmission(db,binding,row);
 if(!a||entityHash(a)!==entityHash(binding.nativeEntityAdmission))deny();return a;
}
export async function entityDefinitions(db,binding,context){
 if(!binding.nativeEntityAdmission)return[];
 await fresh(db,binding,context);
 const selected=(await binding.assignedMcpTools?.definitionsFresh('standard')??[]).filter(t=>t.name===ENTITY_PROJECTED_TOOL);
 if(selected.length!==1)deny();await fresh(db,binding,context);return structuredClone(selected);
}
export async function executeEntityTool(db,binding,call,context){
 if(!binding.nativeEntityAdmission||call.tool!==ENTITY_PROJECTED_TOOL||!binding.assignedMcpTools?.has(call.tool))deny();
 const a=await fresh(db,binding,context),op=call.arguments?.operation;
 if(!['context','search','refresh'].includes(op)||op==='refresh'&&!a.canRefresh)deny();
 await entityDefinitions(db,binding,context);const result=await binding.assignedMcpTools.execute(call,'standard');await fresh(db,binding,context);return result;
}
export async function entityGatewayMetadata(db,session){
 const[{and,eq},{heartbeatRuns}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const[run]=await db.select().from(heartbeatRuns).where(and(eq(heartbeatRuns.companyId,session.companyId),eq(heartbeatRuns.id,session.runId),eq(heartbeatRuns.agentId,session.agentId))).limit(1);
 if(!run?.nativeIssueId)deny();
 return entityExecution(await readEntityAdmission(db,{companyId:session.companyId,agentId:session.agentId,issueId:run.nativeIssueId,runId:session.runId}));
}
