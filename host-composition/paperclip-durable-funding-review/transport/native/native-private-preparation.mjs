/** Default-off private native admission. Identity/config/grants never come from tool arguments. */
import {createHash} from 'node:crypto';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v),text=v=>typeof v==='string'&&v.length>0&&v.length<=200;
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export const privateDigest=v=>createHash('sha256').update(canonical(v)).digest('hex');
export const PRIVATE_TOOL='netrxn.inertia:funding_private_preparation';
const deny=()=>{throw Error('native_private_preparation_denied');};
export function privateToolName(){const sanitize=v=>v.replace(/[^a-zA-Z0-9_]+/g,'_').replace(/^_+|_+$/g,'');const i=PRIVATE_TOOL.lastIndexOf(':');return `app_${sanitize(PRIVATE_TOOL.slice(0,i)).slice(0,20)}_${sanitize(PRIVATE_TOOL.slice(i+1)).slice(-26)}_${createHash('sha256').update(PRIVATE_TOOL).digest('hex').slice(0,12)}`;}
export const PRIVATE_PROJECTED_TOOL=privateToolName();
export function selectPrivatePreparation(rows,binding,policy,nativeReview,context,root){
 const candidates=rows.filter(r=>r.pluginKey==='netrxn.inertia'&&r.config?.privatePreparation?.enabled===true);
 if(!candidates.length)return null;if(candidates.length!==1)deny();
 const row=candidates[0],c=row.config.privatePreparation,a=context.actor,i=context.issue,r=context.run;
 if(i.projectId!==c.projectId||![c.producer?.agentId,c.reviewer?.agentId].includes(binding.agentId))return null;
 const role=nativeReview?'reviewer':'producer',actor=c[role],resolved=Boolean(nativeReview&&context.privateReviewResolved===true);
 const normalized=p=>object(p)&&Array.isArray(p.projectIds)&&Array.isArray(p.issueIds)?{...p,projectIds:[...p.projectIds].sort(),issueIds:[...p.issueIds].sort()}:p;
 if(row.status!=='ready'||row.companyId!==binding.companyId||row.settingsPresent&&row.enabled!==true
  ||!text(c.policyRevision)||!text(c.applicantSlug)||!text(c.matchId)||!actor||actor.agentId!==binding.agentId
  ||c.producer?.agentId===c.reviewer?.agentId||c.producer?.principalId===c.reviewer?.principalId
  ||c.producer?.issueId!==c.portfolioRootIssueId||c.reviewer?.issueId!==c.portfolioRootIssueId
  ||!policy||privateDigest(normalized(policy))!==privateDigest(normalized(a.adapterConfig?.nativeFunding))||!['worker',role].includes(policy.role)||policy.portfolioRootIssueId!==c.portfolioRootIssueId||!policy.projectIds?.includes(c.projectId)||!policy.issueIds?.includes(c.portfolioRootIssueId)
  ||a.id!==binding.agentId||a.companyId!==binding.companyId||a.role!=='general'||a.adapterType!=='paperclip_runner'||['paused','terminated','pending_approval','error'].includes(a.status)
  ||a.adapterConfig?.provider!=='codex'||a.adapterConfig?.engine!=='cli'||a.adapterConfig?.disableCommandExecution!==true||a.adapterConfig?.codexPermissionMode!=='never'||a.adapterConfig?.dangerouslyBypassApprovalsAndSandbox!==false||a.adapterConfig?.dangerouslyBypassSandbox===true||a.adapterConfig?.nativeCoordinator!==undefined||Object.hasOwn(a.adapterConfig,'args')||Object.hasOwn(a.adapterConfig,'extraArgs')
  ||!root||root.id!==c.portfolioRootIssueId||root.companyId!==binding.companyId||root.projectId!==c.projectId||root.hiddenAt||['done','cancelled'].includes(root.status)
  ||i.id!==binding.issueId||i.id===root.id||i.parentId!==root.id||i.companyId!==binding.companyId||i.hiddenAt||i.workMode!=='standard'||!resolved&&(i.executionRunId!==binding.runId||i.status!==(nativeReview?'in_review':'in_progress'))||!nativeReview&&i.assigneeAgentId!==binding.agentId
  ||r.id!==binding.runId||r.companyId!==binding.companyId||r.agentId!==binding.agentId||r.nativeIssueId!==binding.issueId||r.runtimeMode!=='native'||r.status!=='running'||r.finishedAt)deny();
 return Object.freeze({version:1,kind:'private-preparation',role,companyId:binding.companyId,projectId:c.projectId,issueId:i.id,rootIssueId:root.id,agentId:binding.agentId,runId:binding.runId,bindingHash:privateDigest(c),policyRevision:c.policyRevision,principalId:actor.principalId});
}
export function privateExecutionMetadata(a){if(a?.kind!=='private-preparation'||!['producer','reviewer'].includes(a.role))deny();return{version:1,companyId:a.companyId,projectId:a.projectId,issueId:a.issueId,rootIssueId:a.rootIssueId,agentId:a.agentId,runId:a.runId,bindingHash:a.bindingHash,webSearch:'disabled',historyReuse:false};}
export async function readPrivatePreparation(db,binding,policy,nativeReview,context){
 const [{and,eq},{plugins,pluginCompanySettings,pluginConfig,agents,issues,heartbeatRuns}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 if(!context){[context]=await db.select({actor:agents,issue:issues,run:heartbeatRuns}).from(heartbeatRuns).innerJoin(issues,eq(issues.id,binding.issueId)).innerJoin(agents,eq(agents.id,binding.agentId)).where(and(eq(heartbeatRuns.id,binding.runId),eq(heartbeatRuns.companyId,binding.companyId))).limit(1);}
 if(!context)deny();
 const rows=await db.select({pluginKey:plugins.pluginKey,status:plugins.status,companyId:pluginConfig.companyId,config:pluginConfig.configJson,settingsId:pluginCompanySettings.id,enabled:pluginCompanySettings.enabled}).from(plugins).innerJoin(pluginConfig,and(eq(pluginConfig.pluginId,plugins.id),eq(pluginConfig.companyId,binding.companyId))).leftJoin(pluginCompanySettings,and(eq(pluginCompanySettings.pluginId,plugins.id),eq(pluginCompanySettings.companyId,binding.companyId))).where(eq(plugins.pluginKey,'netrxn.inertia')).limit(2);
 const c=rows.find(r=>r.config?.privatePreparation?.enabled===true)?.config.privatePreparation;
 if(!c)return null;
 const[root]=await db.select().from(issues).where(and(eq(issues.id,c.portfolioRootIssueId),eq(issues.companyId,binding.companyId))).limit(1);
 return selectPrivatePreparation(rows.map(r=>({...r,settingsPresent:r.settingsId!=null})),binding,policy??context.actor.adapterConfig?.nativeFunding,nativeReview,context,root);
}
export async function privateGatewayMetadata(db,session){
 const[{and,eq},{heartbeatRuns,agents}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const[run]=await db.select().from(heartbeatRuns).where(and(eq(heartbeatRuns.id,session.runId),eq(heartbeatRuns.companyId,session.companyId))).limit(1);
 const[a]=await db.select().from(agents).where(and(eq(agents.id,session.agentId),eq(agents.companyId,session.companyId))).limit(1);
 if(!run||!a)deny();
 const admission=await readPrivatePreparation(db,{companyId:session.companyId,agentId:session.agentId,runId:session.runId,issueId:run.nativeIssueId},a.adapterConfig?.nativeFunding,null);
 const expected=privateExecutionMetadata(admission);
 if(privateDigest(run.runnerProfileJson?.privatePreparationExecution)!==privateDigest(expected))deny();
 return expected;
}
export async function privateDefinitions(binding,context){await context();const tools=(await binding.assignedMcpTools?.definitionsFresh('standard')??[]).filter(t=>t.name===PRIVATE_PROJECTED_TOOL);if(tools.length!==1)deny();await context();return tools;}
export async function executePrivateTool(binding,call,context){if(call.tool!==PRIVATE_PROJECTED_TOOL||!binding.assignedMcpTools?.has(call.tool))deny();await privateDefinitions(binding,context);const result=await binding.assignedMcpTools.execute(call,'standard');await context();return result;}
export function isolationSessionId(binding,mode,bindingHash){
 const bytes=createHash('sha1').update(Buffer.from('6ba7b8119dad11d180b400c04fd430c8','hex')).update(canonical(['inertia-private-context-v1',binding.companyId,binding.agentId,binding.issueId,binding.runId,mode,bindingHash])).digest();
 bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const h=bytes.subarray(0,16).toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export async function privateSessionIsolation(db,binding,policy,coordinator){
 const[{and,eq,sql,inArray,desc},{plugins,pluginConfig,pluginCompanySettings,agents,issues,heartbeatRuns}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const[context]=await db.select({actor:agents,issue:issues,run:heartbeatRuns}).from(heartbeatRuns).innerJoin(issues,eq(issues.id,binding.issueId)).innerJoin(agents,eq(agents.id,binding.agentId)).where(and(eq(heartbeatRuns.id,binding.runId),eq(heartbeatRuns.companyId,binding.companyId))).limit(1);if(!context)deny();
 const rows=await db.select({status:plugins.status,config:pluginConfig.configJson,enabled:pluginCompanySettings.enabled}).from(plugins).innerJoin(pluginConfig,and(eq(pluginConfig.pluginId,plugins.id),eq(pluginConfig.companyId,binding.companyId))).leftJoin(pluginCompanySettings,and(eq(pluginCompanySettings.pluginId,plugins.id),eq(pluginCompanySettings.companyId,binding.companyId))).where(eq(plugins.pluginKey,'netrxn.inertia')).limit(2);
 const enabled=rows.filter(r=>r.status==='ready'&&r.enabled!==false&&r.config?.privatePreparation?.enabled===true);if(enabled.length>1)deny();const cfg=enabled[0]?.config.privatePreparation;
 const[history]=await db.select({profile:heartbeatRuns.runnerProfileJson}).from(heartbeatRuns).where(and(eq(heartbeatRuns.companyId,binding.companyId),sql`${heartbeatRuns.runnerProfileJson}->'inertiaExecutionIsolation' IS NOT NULL`,inArray(sql`${heartbeatRuns.runnerProfileJson}->'inertiaExecutionIsolation'->>'mode'`,['private','coordinator-private']),coordinator?inArray(sql`${heartbeatRuns.runnerProfileJson}->'inertiaExecutionIsolation'->>'privateProjectId'`,coordinator.projectIds):eq(heartbeatRuns.agentId,binding.agentId))).orderBy(desc(heartbeatRuns.createdAt)).limit(1);
 const past=history?.profile?.inertiaExecutionIsolation;
 let mode,hash,privateProjectId,rootIssueId;
 if(coordinator||past?.mode==='coordinator-private'){
  const visible=cfg&&coordinator?.projectIds?.includes(cfg.projectId)||past?.mode==='private'||past?.mode==='coordinator-private';
  if(!visible&&!past)return null;
  mode=visible?'coordinator-private':'public';hash=cfg&&visible?privateDigest(cfg):past.bindingHash;privateProjectId=cfg&&visible?cfg.projectId:past.privateProjectId;rootIssueId=cfg&&visible?cfg.portfolioRootIssueId:past.rootIssueId;
 }else{
  const mapped=cfg&&[cfg.producer?.agentId,cfg.reviewer?.agentId].includes(binding.agentId);
  if(!mapped&&!past)return null;
  privateProjectId=mapped?cfg.projectId:past.privateProjectId;rootIssueId=mapped?cfg.portfolioRootIssueId:past.rootIssueId;hash=mapped?privateDigest(cfg):past.bindingHash;
  mode=context.issue.projectId===privateProjectId?'private':'public';
 }
 const descriptor={version:1,mode,companyId:binding.companyId,agentId:binding.agentId,issueId:binding.issueId,projectId:context.issue.projectId,privateProjectId,rootIssueId,bindingHash:hash,sessionId:isolationSessionId(binding,mode,hash),webSearch:mode==='public'?'unchanged':'disabled',historyReuse:false};
 return Object.freeze(descriptor);
}
export async function admittedIsolation(db,execution){
 const[{and,eq},{heartbeatRuns}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const[run]=await db.select().from(heartbeatRuns).where(and(eq(heartbeatRuns.id,execution.binding.runId),eq(heartbeatRuns.companyId,execution.binding.companyId))).limit(1);
 const expected=await privateSessionIsolation(db,execution.binding,execution.provider.nativeFundingPolicy,execution.provider.nativeCoordinatorPolicy),stored=run?.runnerProfileJson?.inertiaExecutionIsolation;
 if(!expected&&!stored)return null;
 if(!expected||!stored||privateDigest(expected)!==privateDigest(stored)||run.nativeSessionId!==stored.sessionId||execution.session.normalizedSessionId!==stored.sessionId||run.runnerProfileJson.nativeExecutionInput?.session?.normalizedSessionId!==stored.sessionId)throw Error('private_context_requires_fresh_admission');
 return stored;
}
export async function assertCoordinatorPrivateIsolation(db,binding,context){
 const p=binding.nativeCoordinatorPolicy;if(!p)return;
 const expected=await privateSessionIsolation(db,binding,null,{version:p.version,projectIds:p.projectIds});if(!expected)return;
 const stored=context.run.runnerProfileJson?.inertiaExecutionIsolation;
 if(!stored||privateDigest(expected)!==privateDigest(stored)||context.run.nativeSessionId!==stored.sessionId||context.run.runnerProfileJson?.nativeExecutionInput?.session?.normalizedSessionId!==stored.sessionId)throw Error('coordinator_private_context_requires_fresh_admission');
}
export async function markPrivateExecution(db,binding,admission){
 const[{and,eq},{heartbeatRuns}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const[run]=await db.select().from(heartbeatRuns).where(and(eq(heartbeatRuns.id,binding.runId),eq(heartbeatRuns.companyId,binding.companyId),eq(heartbeatRuns.agentId,binding.agentId),eq(heartbeatRuns.status,'running'))).limit(1);if(!run)deny();
 const receipt=admission.role==='producer'?privateExecutionMetadata(admission):{version:1,companyId:admission.companyId,projectId:admission.projectId,issueId:admission.issueId,rootIssueId:admission.rootIssueId,agentId:admission.agentId,runId:admission.runId,bindingHash:admission.bindingHash,webSearch:'disabled',historyReuse:false};
 await db.update(heartbeatRuns).set({runnerProfileJson:{...(run.runnerProfileJson??{}),privatePreparationExecution:receipt}}).where(and(eq(heartbeatRuns.id,binding.runId),eq(heartbeatRuns.companyId,binding.companyId),eq(heartbeatRuns.status,'running')));
 return receipt;
}
