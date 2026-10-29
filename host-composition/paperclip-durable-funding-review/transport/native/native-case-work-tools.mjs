import {CASE_DOCUMENT_DEFINITIONS} from './native-case-document-read.mjs';
import {selectSourceReviewAdmission,SOURCE_REVIEW_CREATE_DEFINITION} from './native-source-review.mjs';
import{nativeDomainReviewComposition}from'./native-domain-review-composition.mjs';
/** Opt-in current public case tools. Existing enrichment/meeting paths delegate unchanged. */
import * as base from './native-enrichment-tools.mjs';
import{createHash}from'node:crypto';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v),canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v),hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const deny=()=>{throw Error('native_case_work_scope_denied');},normalize=p=>object(p)&&Array.isArray(p.projectIds)&&Array.isArray(p.issueIds)?{...p,projectIds:[...p.projectIds].sort(),issueIds:[...p.issueIds].sort()}:p;
const projected=n=>{const s=v=>v.replace(/[^a-zA-Z0-9_]+/g,'_').replace(/^_+|_+$/g,'');const i=n.lastIndexOf(':');return'app_'+s(n.slice(0,i)).slice(0,20)+'_'+s(n.slice(i+1)).slice(-26)+'_'+createHash('sha256').update(n).digest('hex').slice(0,12);};
export const CASE_PROJECTED_TOOL=projected('netrxn.inertia:funding_case_work'),ENRICHMENT_PROJECTED_TOOL=projected('netrxn.inertia:funding_enrichment');
export function selectCaseWorkAdmission(rows,binding,policy,nativeReview,context,root,baseAdmission){
 if(nativeReview)return null;
 const all=rows.filter(r=>r.pluginKey==='netrxn.inertia'&&r.config?.nativeCaseWork?.enabled===true);
 if(!all.length)return null;if(all.length!==1)deny();
 const row=all[0],c=row.config.nativeCaseWork,a=context.actor,i=context.issue,r=context.run;
 const researcher=a.id===c.researcher?.agentId&&i.projectId===c.researchProjectId;
 const producer=a.id===c.producer?.agentId&&i.projectId===c.projectId;
 if(!researcher&&!producer)return null;
 const prefix='paperclip-runner:create-task:'+c.rootIssueId+':case:';
 if(producer&&(typeof i.originId!=='string'||!i.originId.includes(':case:')))return null;
 if(producer&&i.originKind!=='manual')return null;
 if(row.status!=='ready'||row.companyId!==binding.companyId||row.enabled===false||c.researcher.agentId===c.producer.agentId||c.researcher.principalId===c.producer.principalId
  ||a.id!==binding.agentId||a.companyId!==binding.companyId||a.role!=='general'||a.adapterType!=='paperclip_runner'||['paused','terminated','pending_approval','error'].includes(a.status)
  ||a.adapterConfig?.provider!=='codex'||a.adapterConfig?.engine!=='cli'||a.adapterConfig?.disableCommandExecution!==true||a.adapterConfig?.codexPermissionMode!=='never'||a.adapterConfig?.dangerouslyBypassApprovalsAndSandbox!==false||a.adapterConfig?.dangerouslyBypassSandbox===true||a.adapterConfig?.nativeCoordinator!==undefined||Object.hasOwn(a.adapterConfig,'args')||Object.hasOwn(a.adapterConfig,'extraArgs')
  ||policy?.version!==1||policy.role!=='worker'||hash(normalize(policy))!==hash(normalize(a.adapterConfig.nativeFunding))||policy.portfolioRootIssueId!==c.rootIssueId||!policy.issueIds?.includes(c.rootIssueId)||!policy.projectIds?.includes(c.rootProjectId)||!policy.projectIds?.includes(i.projectId)
  ||!root||root.id!==c.rootIssueId||root.companyId!==binding.companyId||root.projectId!==c.rootProjectId||root.hiddenAt||['done','cancelled'].includes(root.status)
  ||i.id!==binding.issueId||i.companyId!==binding.companyId||i.parentId!==root.id||i.hiddenAt||i.workMode!=='standard'||i.status!=='in_progress'||i.executionRunId!==binding.runId||i.assigneeAgentId!==binding.agentId
  ||r.id!==binding.runId||r.companyId!==binding.companyId||r.agentId!==binding.agentId||r.nativeIssueId!==binding.issueId||r.runtimeMode!=='native'||r.status!=='running'||r.finishedAt)deny();
 let caseBindingId=null;
 if(producer){if(typeof i.originId!=='string'||!i.originId.startsWith(prefix))deny();caseBindingId=i.originId.slice(prefix.length);if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(caseBindingId))deny();}
 if(researcher&&(!baseAdmission||baseAdmission.kind!=='enrichment'||baseAdmission.role!=='researcher'))deny();
 return Object.freeze({version:1,kind:'case-work',role:researcher?'researcher':'producer',companyId:binding.companyId,projectId:i.projectId,issueId:i.id,agentId:a.id,runId:r.id,rootIssueId:root.id,caseBindingId,bindingHash:hash(c),adapterHash:hash(a.adapterConfig),...(researcher?{baseAdmission}:{})});
}
export async function readTaskProjectAdmission(db,binding,policy,nativeReview,context){
 if(nativeReview)return base.readTaskProjectAdmission(db,binding,policy,nativeReview,context);
 const[{and,eq},{plugins,pluginConfig,pluginCompanySettings,agents,issues,heartbeatRuns}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 if(!context)[context]=await db.select({actor:agents,issue:issues,run:heartbeatRuns}).from(heartbeatRuns).innerJoin(issues,eq(issues.id,binding.issueId)).innerJoin(agents,eq(agents.id,binding.agentId)).where(and(eq(heartbeatRuns.id,binding.runId),eq(heartbeatRuns.companyId,binding.companyId))).limit(1);
 if(!context)deny();
 const rows=await db.select({pluginKey:plugins.pluginKey,status:plugins.status,companyId:pluginConfig.companyId,config:pluginConfig.configJson,enabled:pluginCompanySettings.enabled}).from(plugins).innerJoin(pluginConfig,and(eq(pluginConfig.pluginId,plugins.id),eq(pluginConfig.companyId,binding.companyId))).leftJoin(pluginCompanySettings,and(eq(pluginCompanySettings.pluginId,plugins.id),eq(pluginCompanySettings.companyId,binding.companyId))).where(eq(plugins.pluginKey,'netrxn.inertia')).limit(2);
 const configured=rows.find(r=>r.config?.nativeCaseWork?.enabled===true)?.config.nativeCaseWork;
 if(!configured)return base.readTaskProjectAdmission(db,binding,policy,nativeReview,context);
 const[root]=await db.select().from(issues).where(and(eq(issues.companyId,binding.companyId),eq(issues.id,configured.rootIssueId))).limit(1);
 const isResearch=context.actor.id===configured.researcher?.agentId&&context.issue.projectId===configured.researchProjectId;
 const b=isResearch?await base.readTaskProjectAdmission(db,binding,policy,nativeReview,context):null;
 const[parent]=context.issue.parentId?await db.select().from(issues).where(and(eq(issues.companyId,binding.companyId),eq(issues.id,context.issue.parentId))).limit(1):[];
 const source=selectSourceReviewAdmission(rows,binding,policy,nativeReview,context,root,parent);if(source)return source;
 const selected=selectCaseWorkAdmission(rows,binding,policy,nativeReview,context,root,b);
 return selected??base.readTaskProjectAdmission(db,binding,policy,nativeReview,context);
}
export function isTaskProjectTool(binding,name){
 const a=binding.nativeTaskProjectAdmission;
 return ['case-work','source-review'].includes(a?.kind)?(name===CASE_PROJECTED_TOOL||a.role==='researcher'&&name===ENRICHMENT_PROJECTED_TOOL):base.isTaskProjectTool(binding,name);
}
export async function assertFreshTaskProject(db,binding,context){
 if(!['case-work','source-review'].includes(binding.nativeTaskProjectAdmission?.kind))return base.assertFreshTaskProject(db,binding,context);
 const current=await readTaskProjectAdmission(db,binding,context.actor.adapterConfig.nativeFunding,binding.nativeReview,context);
 if(!current||hash(current)!==hash(binding.nativeTaskProjectAdmission))deny();return current;
}
export async function taskProjectDefinitions(binding,context){
 if(!['case-work','source-review'].includes(binding.nativeTaskProjectAdmission?.kind))return base.taskProjectDefinitions(binding,context);
 await context();if(typeof binding.assignedMcpTools?.definitionsFresh!=='function')deny();
 const wanted=binding.nativeTaskProjectAdmission.role==='researcher'?[CASE_PROJECTED_TOOL,ENRICHMENT_PROJECTED_TOOL]:[CASE_PROJECTED_TOOL];
 const tools=(await binding.assignedMcpTools.definitionsFresh('standard')).filter(t=>wanted.includes(t.name));
 if(tools.length!==wanted.length||new Set(tools.map(t=>t.name)).size!==wanted.length)deny();
 await context();
 const result=[...structuredClone(tools),...structuredClone(CASE_DOCUMENT_DEFINITIONS)];
 if(binding.nativeTaskProjectAdmission.kind==='source-review'){
  const proposalHash=binding.nativeTaskProjectAdmission.proposalHash;
  if(typeof proposalHash!=='string'||!/^[a-f0-9]{64}$/.test(proposalHash))deny();
  const digest={type:'string',const:proposalHash},findings={type:'array',maxItems:100,items:{type:'string',minLength:1,maxLength:5000}};
  const parameters={
   source_context:{type:'object',properties:{view:{type:'string',const:'proposal'},proposal_hash:digest},required:['view','proposal_hash'],additionalProperties:false},
   source_review:{type:'object',properties:{proposal_hash:digest,decision:{type:'string',enum:['accept','reject']},findings},required:['proposal_hash','decision','findings'],additionalProperties:false,oneOf:[{properties:{decision:{const:'accept'},findings:{maxItems:0}}},{properties:{decision:{const:'reject'},findings:{minItems:1}}}]},
   source_receipt:{type:'object',properties:{proposal_hash:digest},required:['proposal_hash'],additionalProperties:false},
   source_settlement:{type:'object',properties:{proposal_hash:digest,findings:{...findings,minItems:1}},required:['proposal_hash','findings'],additionalProperties:false}
  };
  const tool=result.find(t=>t.name===CASE_PROJECTED_TOOL);
  tool.description='Independent source review of this exact proposal only. First use source_context with view "proposal" and proposal_hash "'+proposalHash+'". Every call requires that exact proposal_hash. Then source_review accept with empty findings or reject with specific findings; source_receipt reads the resulting receipt. Use source_settlement only for independently confirmed source drift. This does not approve a funding packet or submission.';
  tool.inputSchema={type:'object',properties:{operation:{type:'string',enum:Object.keys(parameters)},parameters:{type:'object'}},required:['operation','parameters'],additionalProperties:false,oneOf:Object.entries(parameters).map(([operation,payload])=>({type:'object',properties:{operation:{const:operation},parameters:payload},required:['operation','parameters'],additionalProperties:false}))};
 }
 return result;
}
/** Decode only this freshly admitted case tool's real dispatcher envelope.
 * Registry pluginId is the logical key, never the installation UUID.
 * No model arguments or unwrapped/nested lookalikes are accepted here. */
export function caseWorkToolResult(value){
 if(!object(value)||Object.keys(value).sort().join()!=='pluginId,result,toolName'||value.pluginId!=='netrxn.inertia'||value.toolName!=='funding_case_work')deny();
 const result=value.result;
 if(!object(result)||Object.keys(result).some(key=>!['content','data'].includes(key))||!object(result.data)||Object.hasOwn(result,'content')&&typeof result.content!=='string')deny();
 return structuredClone(result);
}
export async function executeTaskProjectTool(binding,call,context){
 const a=binding.nativeTaskProjectAdmission;
 if(!['case-work','source-review'].includes(a?.kind))return base.executeTaskProjectTool(binding,call,context);
 if(!isTaskProjectTool(binding,call.tool)||!binding.assignedMcpTools?.has(call.tool))deny();
 if(call.tool===CASE_PROJECTED_TOOL&&!((a.role==='researcher'&&['reserve_case','reserve_candidate'].includes(call.arguments?.operation))||(a.role==='producer'&&['context','checkpoint','prepare','workspace','save','save_assumption','save_gap_progress','render','packet','packet_artifacts','packet_artifact_chunk','source_context','source_links','source_capture','source_propose','source_receipt'].includes(call.arguments?.operation))||(a.kind==='source-review'&&['source_context','source_review','source_receipt','source_settlement'].includes(call.arguments?.operation))))deny();
 if(a.kind==='source-review'&&(call.arguments?.parameters?.proposal_hash!==a.proposalHash||(call.arguments?.operation==='source_context'&&call.arguments?.parameters?.view!=='proposal')))deny();
 await taskProjectDefinitions(binding,context);if(call.tool===CASE_PROJECTED_TOOL&&a.role==='producer'&&['prepare','workspace','save','save_assumption','save_gap_progress','render','packet','packet_artifacts','packet_artifact_chunk'].includes(call.arguments?.operation))nativeDomainReviewComposition.assertCasePreparation((await context()).issue,a.bindingHash);const result=await binding.assignedMcpTools.execute(call,'standard');await context();return call.tool===CASE_PROJECTED_TOOL?caseWorkToolResult(result):result;
}
