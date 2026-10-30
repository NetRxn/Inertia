import {randomUUID} from "node:crypto";
import type {PluginContext,ToolRunContext} from "@paperclipai/plugin-sdk";
import {createBoundedContextBridge,type BoundedProcessConfig,type ContextBridge} from "../bridge/duplex.js";
import {resolveNativeDescendantTask,validateNativeTaskRun} from "../paperclip/context.js";
import {createRuntimeOwner} from "../bridge/ownership.js";
import {discoveryHash} from "../discovery/service.js";
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==="string"&&!!v.trim()&&v.length<=200;
export interface PrivateActor {issueId:string;agentId:string;principalId:string}
export interface PrivateContext {company_id:string;applicant_slug:string;match_id:string;principal_id:string;run_id:string;role:"producer";issue_id:string;portfolio_root_issue_id:string}
export interface PrivateBinding {companyId:string;projectId:string;portfolioRootIssueId:string;applicantSlug:string;matchId:string;policyRevision:string;fingerprint:string;producer:PrivateActor;reviewer:PrivateActor;bridge:ContextBridge<PrivateContext>;authorize:()=>Promise<boolean>}
export const privatePreparationTool={name:"funding_private_preparation",displayName:"Prepare the authorized private funding case",description:"Read the current restricted applicant workspace, save seven supported kinds of exact-source drafting proposals, regenerate a restricted packet, or read its receipt. Independent review occurs in the actual native review. No web search, outreach, human approval or submission. Start with workspace and empty parameters. Use its exact seven-target schemas and server-provided source bindings for save; render takes empty parameters; receipt takes manifest_hash.",parametersSchema:{type:"object",properties:{operation:{type:"string",enum:["workspace","save","render","receipt"]},parameters:{type:"object"}},required:["operation","parameters"],additionalProperties:false}} as const;
export function registerPrivatePreparation(ctx:Pick<PluginContext,"tools"|"issues">,bindings:PrivateBinding[],owner:Pick<ReturnType<typeof createRuntimeOwner>,"own">):void{
 ctx.tools.register(privatePreparationTool.name,privatePreparationTool,async(input,provided)=>{
  if(!object(input)||Object.keys(input).sort().join()!=="operation,parameters"||!object(input.parameters)||!["workspace","save","render","receipt"].includes(String(input.operation))||Buffer.byteLength(JSON.stringify(input))>128*1024)throw Error("Invalid private preparation request");
  const run=structuredClone(provided),matches=bindings.filter(b=>b.companyId===run.companyId&&b.projectId===run.projectId&&b.producer.agentId===run.agentId);
  if(matches.length!==1)throw Error("Private preparation producer scope unavailable");
  const b=matches[0]!,execution=(run as ToolRunContext&{privatePreparationExecution?:unknown}).privatePreparationExecution;
  async function context(signal?:AbortSignal):Promise<PrivateContext>{
   if(signal?.aborted||!await b.authorize())throw Error("Private preparation configuration changed");
   const issueId=await resolveNativeDescendantTask(ctx,{companyId:b.companyId,projectId:b.projectId,rootIssueId:b.portfolioRootIssueId,allowedAgentIds:[b.producer.agentId],authorize:b.authorize},run);
   if(!issueId)throw Error("Private preparation child unavailable");
   const expected={version:1,companyId:b.companyId,projectId:b.projectId,issueId,rootIssueId:b.portfolioRootIssueId,agentId:b.producer.agentId,runId:run.runId,bindingHash:b.fingerprint,webSearch:"disabled",historyReuse:false};
   if(!object(execution)||discoveryHash(execution)!==discoveryHash(expected))throw Error("Private provider execution isolation unavailable");
   await validateNativeTaskRun(ctx,{companyId:b.companyId,projectId:b.projectId,issueId,agentId:b.producer.agentId,authorize:b.authorize},run,signal);
   if(signal?.aborted)throw Error("Private preparation cancelled");
   return{company_id:b.companyId,applicant_slug:b.applicantSlug,match_id:b.matchId,principal_id:b.producer.principalId,run_id:run.runId,role:"producer",issue_id:issueId,portfolio_root_issue_id:b.portfolioRootIssueId};
  }
  async function privateAuthorization(request:Record<string,unknown>,signal?:AbortSignal){
   const actor=await context(signal),scope=request.scope,a=request.actor;
   const expectedActor={company_id:b.companyId,project_id:b.projectId,issue_id:actor.issue_id,root_issue_id:b.portfolioRootIssueId,agent_id:b.producer.agentId,principal_id:b.producer.principalId,run_id:run.runId,role:"producer"};
   const prior=object(scope)&&scope.read_purpose==="prior_private_case_read";
   if(prior){
    if(!text(scope.issue_id)||scope.issue_id===actor.issue_id||!text(scope.source_run_id))throw Error("Invalid prior private subject");
    const subject=await ctx.issues.get(scope.issue_id,b.companyId);
    if(!subject||subject.id!==scope.issue_id||subject.companyId!==b.companyId||subject.projectId!==b.projectId||subject.parentId!==b.portfolioRootIssueId||subject.hiddenAt||subject.status!=="done"||subject.assigneeAgentId!==b.producer.agentId)throw Error("Prior private subject unavailable");
   }
   const expectedScope={company_id:b.companyId,project_id:b.projectId,issue_id:prior?scope.issue_id:actor.issue_id,root_issue_id:b.portfolioRootIssueId,applicant_slug:b.applicantSlug,source_run_id:prior?scope.source_run_id:run.runId,producer_agent_id:b.producer.agentId,producer_principal_id:b.producer.principalId,reviewer_agent_id:b.reviewer.agentId,reviewer_principal_id:b.reviewer.principalId,policy_revision:b.policyRevision,permitted_audiences:["public","internal","restricted"],...(prior?{read_purpose:"prior_private_case_read"}:{})};
   if(!object(scope)||!text(scope.match_id)||Object.keys(scope).length!==Object.keys(expectedScope).length+1||Object.entries(expectedScope).some(([k,v])=>discoveryHash(scope[k])!==discoveryHash(v))||discoveryHash(a)!==discoveryHash(expectedActor)||request.scope_hash!==discoveryHash(scope)||request.actor_hash!==discoveryHash(a))throw Error("Private backend scope changed");
   await context(signal);return{authorized:true,scope_hash:request.scope_hash as string,actor_hash:request.actor_hash as string};
  }
  await context();
  const result=await owner.own({companyId:b.companyId,namespaceScope:"inertia:private-preparation",key:discoveryHash([b.portfolioRootIssueId,b.applicantSlug])},async()=>{
   const result=await b.bridge.call(String(input.operation),input.parameters as Record<string,unknown>,{context,privateAuthorization});await context();return result;
  });
  if(result===null)throw Error("Private preparation case busy; retry later");
  return{data:result};
 });
}
export async function registerConfiguredPrivatePreparation(ctx:PluginContext):Promise<void>{
 const bindings:PrivateBinding[]=[];
 for(const company of await ctx.companies.list({limit:1000})){
  let raw:unknown;try{raw=(await ctx.config.get(company.id)).privatePreparation;}catch(error){if(error instanceof Error&&error.message.includes("company context is required"))continue;throw error;}
  if(!object(raw)||raw.enabled!==true)continue;
  const keys=["enabled","projectId","portfolioRootIssueId","applicantSlug","matchId","policyRevision","producer","reviewer","process"];
  if(Object.keys(raw).sort().join()!==keys.sort().join()||![raw.projectId,raw.portfolioRootIssueId,raw.applicantSlug,raw.matchId,raw.policyRevision].every(text))throw Error("Invalid private preparation configuration");
  for(const a of [raw.producer,raw.reviewer])if(!object(a)||Object.keys(a).sort().join()!=="agentId,issueId,principalId"||!Object.values(a).every(text)||a.issueId!==raw.portfolioRootIssueId)throw Error("Invalid private actor template");
  const producer=raw.producer as unknown as PrivateActor,reviewer=raw.reviewer as unknown as PrivateActor;
  if(producer.agentId===reviewer.agentId||producer.principalId===reviewer.principalId)throw Error("Independent private reviewer required");
  const fingerprint=discoveryHash(raw);
  bindings.push({companyId:company.id,projectId:raw.projectId as string,portfolioRootIssueId:raw.portfolioRootIssueId as string,applicantSlug:raw.applicantSlug as string,matchId:raw.matchId as string,policyRevision:raw.policyRevision as string,producer,reviewer,fingerprint,bridge:createBoundedContextBridge<PrivateContext>(raw.process as unknown as BoundedProcessConfig,"dfw-private-preparation-v1"),authorize:async()=>discoveryHash((await ctx.config.get(company.id)).privatePreparation)===fingerprint});
 }
 registerPrivatePreparation(ctx,bindings,createRuntimeOwner(ctx.db,{workerId:"private-preparation:"+process.pid+":"+randomUUID(),runId:"native-plugin-worker"}));
}
