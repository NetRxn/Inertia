import {randomUUID} from "node:crypto";
import type {PluginContext,ToolRunContext} from "@paperclipai/plugin-sdk";
import {createBoundedContextBridge,type BoundedProcessConfig,type ContextBridge} from "../bridge/duplex.js";
import {resolveNativeDescendantTask,validateNativeTaskRun} from "../paperclip/context.js";
import {createRuntimeOwner} from "../bridge/ownership.js";
import {discoveryHash} from "../discovery/service.js";
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==="string"&&!!v.trim()&&v.length<=128;
export interface EnrichmentActor {agentId:string;principalId:string}
export interface EnrichmentContext {company_id:string;applicant_slug:string;project_id:string;issue_id:string;root_issue_id:string;root_project_id:string;agent_id:string;principal_id:string;run_id:string;role:"researcher"|"reviewer"}
export interface EnrichmentBinding {companyId:string;applicantSlug:string;projectId:string;rootIssueId:string;rootProjectId:string;producer:EnrichmentActor;reviewer:EnrichmentActor;bridge:ContextBridge<EnrichmentContext>;authorize:()=>Promise<boolean>}
const contextViews=["inventory","record","proposal","contract","profile"] as const;
function contextParameters(p:Record<string,unknown>):void {
 const hasRecord=p.record_id!==undefined&&p.record_id!==null,hasProposal=p.proposal_hash!==undefined&&p.proposal_hash!==null;
 const view=p.view??(hasRecord?"record":hasProposal?"proposal":"inventory"),offset=p.offset===undefined?0:p.offset,limit=p.limit===undefined?50:p.limit;
 if(Object.keys(p).some(k=>!["view","record_id","proposal_hash","offset","limit"].includes(k))||
    typeof view!=="string"||!contextViews.some(v=>v===view)||
    !Number.isSafeInteger(offset)||Number(offset)<0||!Number.isSafeInteger(limit)||Number(limit)<1||Number(limit)>100||
    hasRecord&&(typeof p.record_id!=="string"||p.record_id.length>200||!/^[^\s\x00-\x1f\x7f]+$/.test(p.record_id))||
    hasProposal&&(typeof p.proposal_hash!=="string"||!/^[a-f0-9]{64}$/.test(p.proposal_hash))||
    hasRecord&&hasProposal||(view==="record")!==hasRecord||(view==="proposal")!==hasProposal||
    view!=="inventory"&&(offset!==0||limit!==50))throw Error("Invalid enrichment context parameters");
}
function triageParameters(op:unknown,p:Record<string,unknown>):void {
 if(op==='triage_scan'){if(Object.keys(p).length)throw Error('Invalid enrichment triage parameters');return;}
 const offset=p.offset===undefined?0:p.offset,limit=p.limit===undefined?50:p.limit;
 if(Object.keys(p).some(k=>!['scan_hash','offset','limit','record_id'].includes(k))||typeof p.scan_hash!=='string'||!/^[a-f0-9]{64}$/.test(p.scan_hash)||!Number.isSafeInteger(offset)||Number(offset)<0||!Number.isSafeInteger(limit)||Number(limit)<1||Number(limit)>100||p.record_id!=null&&(typeof p.record_id!=='string'||p.record_id.length>128||!/^[^\s\x00-\x1f\x7f]+$/.test(p.record_id)||offset!==0))throw Error('Invalid enrichment triage parameters');
}
function linksParameters(p:Record<string,unknown>):void {
 const offset=p.offset??0,limit=p.limit??20;
 if(Object.keys(p).some(k=>!["record_id","offset","limit","context_hash"].includes(k))||typeof p.record_id!=="string"||p.record_id.length>128||!/^[^\s\x00-\x1f\x7f]+$/.test(p.record_id)||!Number.isSafeInteger(offset)||Number(offset)<0||!Number.isSafeInteger(limit)||Number(limit)<1||Number(limit)>50||p.context_hash!==undefined&&(typeof p.context_hash!=="string"||!/^[a-f0-9]{64}$/.test(p.context_hash)))throw Error("Invalid enrichment links parameters");
}
export const enrichmentTool={name:"funding_enrichment",displayName:"Research and review current public opportunities",description:"Use links(record_id, offset, limit, context_hash) to page current official hrefs without granting arbitrary capture URLs. Context defaults to compact paged inventory; fetch context view contract/profile explicitly once, and record/proposal for exact evidence. Use triage_scan with empty parameters for durable exhaustive preliminary rankings through existing DFW matching; triage_page takes scan_hash and bounded offset/limit or an exact record_id. These planning results never admit readiness or eligibility. Enumerate current source records; propose exact source-grounded opportunity details and sponsor requirements; independently review another principal's proposal. Does not approve applications or submit to funders.",parametersSchema:{type:"object",properties:{operation:{type:"string",enum:["context","propose","review","receipt","capture","triage_scan","triage_page","links"]},parameters:{type:"object",properties:{view:{type:"string",enum:contextViews,description:"For context only. Inventory is compact navigation, never clipped canonical evidence."}}}},required:["operation","parameters"],additionalProperties:false}} as const;
export function registerEnrichment(ctx:Pick<PluginContext,"tools"|"issues">,bindings:EnrichmentBinding[],owner:Pick<ReturnType<typeof createRuntimeOwner>,"own">):void {
 ctx.tools.register(enrichmentTool.name,enrichmentTool,async(input,provided)=>{
  if(!object(input)||Object.keys(input).sort().join()!=="operation,parameters"||!object(input.parameters)||!["context","propose","review","receipt","capture","triage_scan","triage_page","links"].includes(String(input.operation))||Buffer.byteLength(JSON.stringify(input))>128*1024)throw Error("Invalid enrichment request");
  if(input.operation==="context")contextParameters(input.parameters);
  if(input.operation==="links")linksParameters(input.parameters);
  if(["triage_scan","triage_page"].includes(String(input.operation)))triageParameters(input.operation,input.parameters);
  const run=structuredClone(provided),matches=bindings.filter(b=>b.companyId===run.companyId&&b.projectId===run.projectId);
  if(matches.length!==1)throw Error("Enrichment scope unavailable");
  const b=matches[0]!,role=run.agentId===b.producer.agentId?"researcher":run.agentId===b.reviewer.agentId?"reviewer":null;
  if(!role||["propose","capture","triage_scan"].includes(String(input.operation))&&role!=="researcher"||input.operation==="review"&&role!=="reviewer")throw Error("Enrichment role denied");
  const actor=role==="researcher"?b.producer:b.reviewer;
  async function context(signal?:AbortSignal):Promise<EnrichmentContext>{
   if(signal?.aborted||!await b.authorize())throw Error("Enrichment configuration changed");
   const issueId=await resolveNativeDescendantTask(ctx,{companyId:b.companyId,projectId:b.projectId,rootIssueId:b.rootIssueId,rootProjectId:b.rootProjectId,allowedAgentIds:[actor.agentId],authorize:b.authorize},run);
   const issue=issueId?await ctx.issues.get(issueId,b.companyId):null;
   if(!issue||issue.parentId!==b.rootIssueId||issue.hiddenAt||issue.executionRunId!==run.runId||issue.status!=="in_progress")throw Error("Enrichment current child unavailable");
   await validateNativeTaskRun(ctx,{companyId:b.companyId,projectId:b.projectId,issueId:issue.id,agentId:actor.agentId,authorize:b.authorize},run,signal);
   if(signal?.aborted)throw Error("Enrichment operation cancelled");
   return{company_id:b.companyId,applicant_slug:b.applicantSlug,project_id:b.projectId,issue_id:issue.id,root_issue_id:b.rootIssueId,root_project_id:b.rootProjectId,agent_id:actor.agentId,principal_id:actor.principalId,run_id:run.runId,role:role!};
  }
  await context();
  const result=await owner.own({companyId:b.companyId,namespaceScope:"inertia:public-enrichment",key:discoveryHash([b.rootIssueId,b.applicantSlug])},async()=>{
   const result=await b.bridge.call(String(input.operation),input.parameters as Record<string,unknown>,{context});await context();return result;
  });
  if(result===null)throw Error("Enrichment portfolio busy; retry later");
  return{data:result};
 });
}
export async function registerConfiguredEnrichment(ctx:PluginContext):Promise<void>{
 const bindings:EnrichmentBinding[]=[];
 for(const company of await ctx.companies.list({limit:1000})){
  let raw:unknown;try{raw=(await ctx.config.get(company.id)).generalEnrichment;}catch(error){if(error instanceof Error&&error.message.includes("company context is required"))continue;throw error;}
  if(!object(raw)||raw.enabled!==true)continue;
  const keys=["enabled","applicantSlug","projectId","rootIssueId","rootProjectId","producer","reviewer","process"];
  if(Object.keys(raw).sort().join()!==keys.sort().join()||![raw.applicantSlug,raw.projectId,raw.rootIssueId,raw.rootProjectId].every(text))throw Error("Invalid enrichment configuration");
  for(const a of [raw.producer,raw.reviewer])if(!object(a)||Object.keys(a).sort().join()!=="agentId,principalId"||![a.agentId,a.principalId].every(text))throw Error("Invalid enrichment actor");
  const producer=raw.producer as unknown as EnrichmentActor,reviewer=raw.reviewer as unknown as EnrichmentActor;
  if(producer.agentId===reviewer.agentId||producer.principalId===reviewer.principalId)throw Error("Independent enrichment reviewer required");
  const fingerprint=discoveryHash(raw);
  bindings.push({companyId:company.id,applicantSlug:raw.applicantSlug as string,projectId:raw.projectId as string,rootIssueId:raw.rootIssueId as string,rootProjectId:raw.rootProjectId as string,producer,reviewer,bridge:createBoundedContextBridge<EnrichmentContext>(raw.process as unknown as BoundedProcessConfig,"dfw-general-enrichment-v1"),authorize:async()=>discoveryHash((await ctx.config.get(company.id)).generalEnrichment)===fingerprint});
 }
 registerEnrichment(ctx,bindings,createRuntimeOwner(ctx.db,{workerId:"enrichment:"+process.pid+":"+randomUUID(),runId:"native-plugin-worker"}));
}
