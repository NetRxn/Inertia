import type {PluginContext,PluginCapability,ToolRunContext} from "@paperclipai/plugin-sdk";
import type {createRuntimeOwner} from "../bridge/ownership.js";
import {discoveryHash} from "../discovery/service.js";
import {readNativeDocument,writeNativeDocument} from "../discovery/documents.js";
import {assertNativeTaskRun} from "../paperclip/context.js";
import type {CentralBridge,CentralContext} from "./stdio.js";
export interface CentralActor {issueId:string;agentId:string;principalId:string;role:"central"|"reviewer"}
export interface CentralBinding {enabled:boolean;companyId:string;projectId:string;applicantSlug:string;matchId:string;agents:CentralActor[];bridge:CentralBridge;authorize:()=>Promise<boolean>}
type Host=Pick<PluginContext,"tools"|"issues">;
type Owner=Pick<ReturnType<typeof createRuntimeOwner>,"own">;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==="string"&&!!v.trim()&&v.length<=128;
const hash=(v:unknown)=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
function exact(v:unknown,fields:string[]):Record<string,unknown>{if(!object(v)||Object.keys(v).length!==fields.length||fields.some(k=>!Object.hasOwn(v,k)))throw Error("Invalid central parameters");return v;}
function alive(signal?:AbortSignal){if(signal?.aborted)throw Error("Central request expired; outcome unconfirmed");}
export function registerTrustedCentral(ctx:Host,bindings:CentralBinding[],owner:Owner):void{
 if(bindings.length>1)throw Error("Only one DFW company database binding is supported");
 for(const b of bindings){
  if(![b.companyId,b.projectId,b.applicantSlug,b.matchId].every(text)||!Array.isArray(b.agents)||!b.agents.length||b.agents.length>30||typeof b.authorize!=="function")throw Error("Invalid central binding");
  for(const a of b.agents)if(![a.issueId,a.agentId,a.principalId].every(text)||!["central","reviewer"].includes(a.role))throw Error("Invalid central actor");
  for(const key of ["issueId","agentId","principalId"] as const)if(new Set(b.agents.map(a=>a[key])).size!==b.agents.length)throw Error("Central identities must be independent and unique");
 }
 async function admitted(b:CentralBinding,signal?:AbortSignal){alive(signal);if(b.enabled!==true||!await b.authorize())throw Error("Central disabled or configuration changed");alive(signal);}
 async function context(b:CentralBinding,a:CentralActor,r:ToolRunContext,signal?:AbortSignal):Promise<CentralContext>{
  await assertNativeTaskRun(ctx,{companyId:b.companyId,projectId:b.projectId,issueId:a.issueId,agentId:a.agentId,authorize:async()=>{await admitted(b,signal);return true;}},r,signal);
  return {company_id:b.companyId,project_id:b.projectId,applicant_slug:b.applicantSlug,match_id:b.matchId,principal_id:a.principalId,agent_id:a.agentId,issue_id:a.issueId,run_id:r.runId!};
 }
 async function target(b:CentralBinding,a:CentralActor,signal?:AbortSignal){
  await admitted(b,signal);const row=await ctx.issues.get(a.issueId,b.companyId);alive(signal);
  if(!row||row.id!==a.issueId||row.companyId!==b.companyId||row.projectId!==b.projectId||row.assigneeAgentId!==a.agentId||!["todo","in_progress","blocked"].includes(row.status))throw Error("Central target assignment unavailable");
  await admitted(b,signal);
 }
 for(const declaration of centralTools)ctx.tools.register(declaration.name,declaration,async(parameters,trustedRun)=>{
  const r=structuredClone(trustedRun),b=bindings.find(v=>v.companyId===r.companyId),a=b?.agents.find(v=>v.agentId===r.agentId);
  if(!b||!a)throw Error("Central disabled or actor denied");
  let params:Record<string,unknown>;
  if(declaration.operation==="workspace")params=exact(parameters,[]);
  else if(declaration.operation==="save"){
   params=exact(parameters,["workspace_hash","proposals"]);
   if(!hash(params.workspace_hash)||!Array.isArray(params.proposals)||!params.proposals.length||params.proposals.length>100||params.proposals.some(p=>!object(p)))throw Error("Invalid central proposals");
  }else if(declaration.operation==="financial_import"){
   params=exact(parameters,["import_id"]);if(!text(params.import_id))throw Error("Invalid central import");
  }else{
   params=exact(parameters,["operation","parameters"]);if(!object(params.parameters))throw Error("Invalid central operation parameters");
   const operations=declaration.operation==="partners"?["partners","context","role_evidence","introduction"]:["query","candidate","propose","admit","review","revoke"];
   if(!operations.includes(String(params.operation)))throw Error("Invalid central operation");
  }
  if(Buffer.byteLength(JSON.stringify(params))>128*1024)throw Error("Central parameters too large");
  const isReview=declaration.operation==="knowledge"&&params.operation==="review";
  if((a.role==="reviewer"&&!(declaration.operation==="knowledge"&&["query","candidate","review"].includes(String(params.operation))))||(isReview&&a.role!=="reviewer"))throw Error("Central role denied");
  await context(b,a,r);
  const result=await owner.own({companyId:b.companyId,namespaceScope:"inertia:trusted-central",key:discoveryHash([b.projectId,b.applicantSlug,b.matchId])},async()=>{
   const result=await b.bridge.call(declaration.operation,params,{context:signal=>context(b,a,r,signal),review:async(request,signal)=>{
    exact(request,["request_id","company_id","project_id","applicant_slug","match_id","record_id","record_revision","evidence_hash","producer_principal_id","reviewer_principal_id","policy_id"]);
    const reviewer=b.agents.find(v=>v.principalId===request.reviewer_principal_id&&v.role==="reviewer");
    if(a.role!=="central"||!reviewer||reviewer.agentId===a.agentId||request.producer_principal_id!==a.principalId||request.company_id!==b.companyId||request.project_id!==b.projectId||request.applicant_slug!==b.applicantSlug||request.match_id!==b.matchId||!hash(request.request_id)||!hash(request.evidence_hash)||!text(request.record_id)||!text(request.policy_id)||!Number.isSafeInteger(request.record_revision)||Number(request.record_revision)<1)throw Error("Invalid central review reference");
    await context(b,a,r,signal);await target(b,reviewer,signal);
    const key="central-knowledge-review:"+request.request_id;
    // Private source text, values, titles and policy internals NEVER enter native documents.
    const body=JSON.stringify({version:"central-knowledge-review-v1",request_id:request.request_id,record_revision:request.record_revision,evidence_hash:request.evidence_hash});
    const old=await readNativeDocument(ctx.issues.documents,reviewer.issueId,key,b.companyId);alive(signal);
    if(old&&old.body!==body)throw Error("Central review reference conflict");
    if(!old){await context(b,a,r,signal);await writeNativeDocument({...ctx.issues.documents,upsert:async value=>{await context(b,a,r,signal);await target(b,reviewer,signal);return ctx.issues.documents.upsert(value);}},{issueId:reviewer.issueId,companyId:b.companyId,key,body,title:"Review scoped source knowledge",format:"markdown"});}
    await context(b,a,r,signal);await target(b,reviewer,signal);
    const receipt=await ctx.issues.requestWakeup(reviewer.issueId,b.companyId,{idempotencyKey:request.request_id as string,contextSource:"inertia.central.knowledge-review",reason:"Read the knowledge review reference. Retrieve source evidence only through central_funding_knowledge candidate with this request_id in your scoped task. Independently assess exact quote, attribution, kind and scope; proposed, negated or adopted-decision claims cannot become factual authority. Record the exact bound review with central_funding_knowledge review. The reference grants no identity or permissions."});
    alive(signal);if(!receipt.queued&&!receipt.runId)throw Error("Central reviewer wake not queued");
    return {state:"pending",request_id:request.request_id as string};
   }});
   await context(b,a,r);
   if(isReview){
    if(!object(result)||!object(params.parameters)||result.request_id!==params.parameters.request_id||!["supported","rejected"].includes(String(result.state)))throw Error("Invalid central review receipt");
    const producer=b.agents.find(v=>v.role==="central"&&v.principalId===result.producer_principal_id);
    if(!producer)throw Error("Central producer unavailable");
    await context(b,a,r);await target(b,producer);
    const receipt=await ctx.issues.requestWakeup(producer.issueId,b.companyId,{idempotencyKey:"central-knowledge-reviewed:"+result.request_id,contextSource:"inertia.central.knowledge-resume",reason:"The independent source review is stored. Retry the original knowledge admission; current source and grants will be checked again. No application signoff or submission occurred."});
    if(!receipt.queued&&!receipt.runId)throw Error("Central producer wake not queued; retry review completion");
   }
   return result;
  });
  if(result===null)throw Error("Central objective already owned; retry later");
  return {data:result};
 });
}
const schema=(properties:Record<string,unknown>)=>({type:"object",properties,required:Object.keys(properties),additionalProperties:false});
export const centralTools=[
 {name:"central_funding_workspace",operation:"workspace",displayName:"Scoped central funding workspace",description:"Trusted configured central agent only. Current allowed private applicant and source knowledge; never application acceptance.",parametersSchema:schema({})},
 {name:"save_central_funding_proposals",operation:"save",displayName:"Save scoped central proposals",description:"Store evidence-grounded suggestions only; never accept or submit an application.",parametersSchema:schema({workspace_hash:{type:"string",pattern:"^[a-f0-9]{64}$"},proposals:{type:"array",minItems:1,maxItems:100,items:{type:"object"}}})},
 {name:"central_funding_partners",operation:"partners",displayName:"Read scoped SQL partners",description:"Current exact source, audience, project, opportunity and relationship-owner scoped SQL reads.",parametersSchema:schema({operation:{type:"string",enum:["partners","context","role_evidence","introduction"]},parameters:{type:"object"}})},
 {name:"central_funding_knowledge",operation:"knowledge",displayName:"Manage scoped source knowledge",description:"Source-bound proposal/query, independent protected source review and admission. Agent JSON never grants identity, source-policy authority or adoption authority.",parametersSchema:schema({operation:{type:"string",enum:["query","candidate","propose","admit","review","revoke"]},parameters:{type:"object"}})},
 {name:"import_central_financial_fixture",operation:"financial_import",displayName:"Import synthetic financial fixture",description:"Import only the configured explicitly synthetic sanitized report into restricted candidate knowledge. No live account, cash/budget inference or spending authority.",parametersSchema:schema({import_id:{type:"string",minLength:1,maxLength:128}})},
] as const;
export const centralCapabilities=["issues.read","issue.subtree.read","issues.checkout","issue.documents.read","issue.documents.write","issues.wakeup","agent.tools.register"] satisfies PluginCapability[];
