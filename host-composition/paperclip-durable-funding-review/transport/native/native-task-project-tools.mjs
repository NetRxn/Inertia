/** Opt-in exact meeting-task catalog; no grants, lifecycle writes, shell or raw API. */
import {createHash} from 'node:crypto';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const text=v=>typeof v==='string'&&!!v.trim()&&v.length<=500&&!/[\x00-\x1f]/.test(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).sort().join() === [...keys].sort().join();
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const arrayHash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const deny=()=>{throw Error('native_task_project_admission_denied');};
export const TASK_PROJECT_CANONICAL_TOOLS=Object.freeze({
 extractor:Object.freeze(['meeting_source_context','submit_meeting_candidates'].map(n=>'netrxn.inertia:'+n)),
 reader:Object.freeze(['netrxn.inertia:meeting_source_context']),
});
const projected=n=>{const s=v=>v.replace(/[^a-zA-Z0-9_]+/g,'_').replace(/^_+|_+$/g,'');const i=n.lastIndexOf(':');return `app_${s(n.slice(0,i)).slice(0,20)}_${s(n.slice(i+1)).slice(-26)}_${createHash('sha256').update(n).digest('hex').slice(0,12)}`;};
export function taskProjectToolNames(admission){const names=TASK_PROJECT_CANONICAL_TOOLS[admission?.role];if(!names)deny();return names.map(projected);}
export function isTaskProjectTool(binding,name){return !!binding.nativeTaskProjectAdmission&&taskProjectToolNames(binding.nativeTaskProjectAdmission).includes(name);}
function optIn(config){
 if(config?.nativeTaskProjectTools===undefined)return null;
 const p=config.nativeTaskProjectTools;
 if(!exact(p,['version','projectIds'])||p.version!==1||!Array.isArray(p.projectIds)||p.projectIds.length<1||p.projectIds.length>16||p.projectIds.some(v=>!uuid(v))||new Set(p.projectIds).size!==p.projectIds.length)deny();
 return p;
}
function runner(binding,context,policy){
 const c=context.actor.adapterConfig;
 if(c.provider!=='codex'||c.engine!=='cli'||c.disableCommandExecution!==true||c.dangerouslyBypassApprovalsAndSandbox!==false||c.dangerouslyBypassSandbox===true||c.codexPermissionMode!=='never'||['extraArgs','args'].some(k=>c[k]!==undefined&&(!Array.isArray(c[k])||c[k].length)))deny();
 const worker=context.actor.role==='general'&&policy?.role==='worker'&&c.nativeFunding?.role==='worker'&&canonical(policy)===canonical(c.nativeFunding)&&c.nativeCoordinator===undefined;
 const coordinator=context.actor.role==='ceo'&&!policy&&c.nativeFunding===undefined&&c.nativeCoordinator?.version===1&&c.nativeCoordinator.projectIds?.includes(context.issue.projectId);
 if(!worker&&!coordinator)deny();
 if(context.actor.id!==binding.agentId||context.actor.companyId!==binding.companyId||context.actor.adapterType!=='paperclip_runner'||['paused','terminated','pending_approval','error'].includes(context.actor.status)
  ||context.issue.id!==binding.issueId||context.issue.companyId!==binding.companyId||context.issue.hiddenAt||context.issue.workMode!=='standard'||context.issue.assigneeAgentId!==binding.agentId||context.issue.executionRunId!==binding.runId||!['in_progress','blocked','todo'].includes(context.issue.status)
  ||context.run.id!==binding.runId||context.run.companyId!==binding.companyId||context.run.agentId!==binding.agentId||context.run.nativeIssueId!==binding.issueId||context.run.runtimeMode!=='native'||context.run.status!=='running'||context.run.finishedAt)deny();
 return coordinator;
}
function base(rows,binding,policy,nativeReview,context){
 if(nativeReview)return null;
 const enabled=optIn(context?.actor?.adapterConfig);if(!enabled)return null;
 if(!enabled.projectIds.includes(context.issue.projectId))return null;
 const candidates=rows.filter(r=>r.pluginKey==='netrxn.inertia'&&r.config?.roundtable?.enabled===true);
 if(!candidates.length)return null;if(candidates.length!==1)deny();
 const row=candidates[0],c=row.config.roundtable;
 if(row.status!=='ready'||row.companyId!==binding.companyId||row.settingsPresent&&row.enabled!==true||!text(c.admission)||!text(c.principalId)||!text(c.origin)||!Array.isArray(c.meetings)||c.meetings.length<1||c.meetings.length>100||c.meetings.some(m=>!object(m)||!text(m.meetingId))||new Set(c.meetings.map(m=>m.meetingId)).size!==c.meetings.length)deny();
 try{const u=new URL(c.origin);if(u.protocol!=='https:'||u.origin!==c.origin)deny();}catch{deny();}
 return{c,coordinator:runner(binding,context,policy),adapterHash:hash(context.actor.adapterConfig)};
}
export function taskProjectMappingKeys(companyId,c){
 if(!c?.nativeIntake||!text(c.nativeIntake.organizationId))return[];
 return c.meetings.filter(m=>text(m.meetingId)).map(m=>{
  const ref=arrayHash([companyId,c.origin,c.principalId,m.meetingId]);
  return arrayHash([c.nativeIntake.organizationId,'inertia-roundtable',ref]);
 });
}
/** Pure selector consumes native/config/mapping records, never model-supplied scope. */
export function selectTaskProjectAdmission(rows,binding,policy,nativeReview,context,mappings=[],ancestors=[]){
 const selected=base(rows,binding,policy,nativeReview,context);if(!selected)return null;
 const{c,coordinator,adapterHash}=selected;
 const extraction=c.meetings.filter(m=>m.nativeExtraction?.issueId===binding.issueId);
 let role,mapping;
 if(extraction.length){
  if(extraction.length!==1||coordinator)deny();
  const m=extraction[0],a=m.nativeExtraction;
  if(m.withdrawn!==false||!text(m.meetingId)||a.projectId!==context.issue.projectId||a.agentId!==binding.agentId)deny();
  role='extractor';
 }else{
  const intake=c.nativeIntake;
  if(intake?.referenceOnly!==true||intake.sourceAccess!==true||intake.projectId!==context.issue.projectId||![intake.intakeAgentId,...(intake.allowedAgentIds??[])].includes(binding.agentId))return null;
  const keys=taskProjectMappingKeys(binding.companyId,c),chain=[context.issue,...ancestors],seen=new Set();
  let current=context.issue;
  for(let depth=0;current&&depth<33;depth++){
   if(seen.has(current.id)||current.companyId!==binding.companyId||current.projectId!==context.issue.projectId||current.hiddenAt||['done','cancelled'].includes(current.status))deny();seen.add(current.id);
   const matches=mappings.filter(m=>m&&keys.includes(m.key)&&m.companyId===binding.companyId&&m.nativeIssueId===current.id&&m.pending===false&&m.snapshot?.withdrawn===false&&m.snapshot?.sourceSystem==='inertia-roundtable'&&m.snapshot.organizationId===intake.organizationId&&m.snapshot.audience==='restricted'&&typeof m.marker==='string'&&/^[a-f0-9]{64}$/.test(m.marker));
   if(matches.length){
    if(matches.length!==1)deny();mapping=matches[0];
    if(current.originKind!=='plugin:netrxn.inertia:objective'||current.originId!==mapping.key||!new RegExp('^Objective source revision: '+mapping.marker+'$','m').test(current.description??''))deny();
    const ref=mapping.snapshot.sourceId;
    if(!c.meetings.some(m=>m.withdrawn===false&&arrayHash([binding.companyId,c.origin,c.principalId,m.meetingId])===ref))deny();
    break;
   }
   if(!current.parentId)break;
   current=chain.find(i=>i.id===current.parentId);
  }
  if(!mapping)return null;
  role='reader';
 }
 return Object.freeze({version:1,role,companyId:binding.companyId,projectId:context.issue.projectId,issueId:binding.issueId,agentId:binding.agentId,runId:binding.runId,bindingHash:hash([c,mapping??null]),adapterHash});
}
export async function readTaskProjectAdmission(db,binding,policy,nativeReview,context){
 const [{and,eq,sql},{plugins,pluginCompanySettings,pluginConfig,agents,issues,heartbeatRuns}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 if(!context){[context]=await db.select({actor:agents,issue:issues,run:heartbeatRuns}).from(heartbeatRuns).innerJoin(issues,eq(issues.id,binding.issueId)).innerJoin(agents,eq(agents.id,binding.agentId)).where(and(eq(heartbeatRuns.id,binding.runId),eq(heartbeatRuns.companyId,binding.companyId))).limit(1);}
 if(!context)deny();
 if(nativeReview||!optIn(context.actor.adapterConfig))return null;
 const rows=await db.select({pluginKey:plugins.pluginKey,status:plugins.status,companyId:pluginConfig.companyId,config:pluginConfig.configJson,settingsId:pluginCompanySettings.id,enabled:pluginCompanySettings.enabled}).from(plugins)
  .innerJoin(pluginConfig,and(eq(pluginConfig.pluginId,plugins.id),eq(pluginConfig.companyId,binding.companyId)))
  .leftJoin(pluginCompanySettings,and(eq(pluginCompanySettings.pluginId,plugins.id),eq(pluginCompanySettings.companyId,binding.companyId))).where(eq(plugins.pluginKey,'netrxn.inertia')).limit(2);
 const source=rows.map(r=>({...r,settingsPresent:r.settingsId!=null})),selected=base(source,binding,policy,nativeReview,context);if(!selected)return null;
 if(selected.c.meetings.some(m=>m.nativeExtraction?.issueId===binding.issueId))return selectTaskProjectAdmission(source,binding,policy,nativeReview,context);
 const intake=selected.c.nativeIntake;
 if(intake?.sourceAccess!==true||intake.projectId!==context.issue.projectId||![intake.intakeAgentId,...(intake.allowedAgentIds??[])].includes(binding.agentId))return null;
 const keys=taskProjectMappingKeys(binding.companyId,selected.c);if(!keys.length)return null;
 const records=await db.execute(sql`SELECT record FROM "plugin_netrxn_inertia_e936d62b87".objective_intake WHERE mapping_key IN (${sql.join(keys.map(k=>sql`${k}`),sql`, `)})`);
 const mappings=(records.rows??records).map(r=>r.record),ancestors=[];let current=context.issue;
 for(let depth=0;current.parentId&&depth<32;depth++){
  if(mappings.some(m=>m?.nativeIssueId===current.id))break;
  const [parent]=await db.select().from(issues).where(and(eq(issues.id,current.parentId),eq(issues.companyId,binding.companyId))).limit(1);
  if(!parent)break;ancestors.push(parent);current=parent;
 }
 return selectTaskProjectAdmission(source,binding,policy,nativeReview,context,mappings,ancestors);
}
export async function assertFreshTaskProject(db,binding,context){
 const fresh=await readTaskProjectAdmission(db,binding,context.actor.adapterConfig.nativeFunding??null,binding.nativeReview,context);
 if(!fresh||hash(fresh)!==hash(binding.nativeTaskProjectAdmission))deny();return fresh;
}
export async function taskProjectDefinitions(binding,context){
 await context();const assigned=binding.assignedMcpTools,allowed=taskProjectToolNames(binding.nativeTaskProjectAdmission);
 if(typeof assigned?.definitionsFresh!=='function')deny();
 const tools=(await assigned.definitionsFresh('standard')).filter(t=>allowed.includes(t.name));
 if(tools.length!==allowed.length||new Set(tools.map(t=>t.name)).size!==allowed.length)deny();
 await context();return tools.map(t=>structuredClone(t));
}
export async function executeTaskProjectTool(binding,call,context){
 if(!isTaskProjectTool(binding,call.tool))deny();
 const tools=await taskProjectDefinitions(binding,context);
 if(!tools.some(t=>t.name===call.tool)||!binding.assignedMcpTools.has(call.tool))deny();
 const result=await binding.assignedMcpTools.execute(call,'standard');await context();return result;
}
