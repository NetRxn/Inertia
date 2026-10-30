import type{PluginContext}from"@paperclipai/plugin-sdk";
import{createBoundedContextBridge,type BoundedProcessConfig,type ContextBridge}from"../bridge/duplex.js";
import{discoveryHash}from"../discovery/service.js";
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v),text=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=200&&/^[^\s\x00-\x1f\x7f]+$/.test(v),digest=(v:unknown)=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
// JSONB/RPC object key ordering is not an authorization boundary. Preserve
// array order and every exact metadata key while hashing canonical objects.
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const stableHash=(v:unknown)=>discoveryHash(canonical(v));
interface Grant{agentId:string;principalId:string;projectIds:string[];canRefresh:boolean}
export interface EntityContext{company_id:string;applicant_slug:string;project_id:string;issue_id:string;agent_id:string;principal_id:string;run_id:string;role:"reader"|"researcher"|"reviewer"}
export interface EntityBinding{companyId:string;applicantSlug:string;actorGrants:Grant[];fingerprint:string;authorize:()=>Promise<boolean>;bridge:ContextBridge<EntityContext>}
const entityTokenSchema={type:"string",minLength:1,maxLength:200,pattern:"^[^\\s\\u0000-\\u001f\\u007f]+$"} as const;
const entityHashSchema={type:"string",pattern:"^[a-f0-9]{64}$"} as const;
const entityPageProperties={offset:{type:"integer",minimum:0},limit:{type:"integer",minimum:1,maximum:100},context_hash:entityHashSchema} as const;
const entityParameterSchemas={
 context:{type:"object",description:"Read the current configured source/document inventory. source_id is an optional SINGLE inventory filter only for this operation. Page using the returned next_offset and context_hash.",properties:{...entityPageProperties,source_id:entityTokenSchema},additionalProperties:false},
 search:{type:"object",description:"Search current indexed public excerpts. Use query * to page all authorized excerpts; context_hash pins pagination.",properties:{...entityPageProperties,query:{type:"string",minLength:1,maxLength:500,pattern:"\\S"}},required:["query"],additionalProperties:false},
 refresh:{type:"object",description:"Refresh the exact configured source IDs from context.items where kind=configured_source; use each item's id. source_ids is a PLURAL array even for one source; source_id, URL and document IDs are invalid here. Pick one stable request_id; repeat that same request_id with the identical ordered source_ids array to read back. Use a new request_id for a new attempt on failed sources.",properties:{request_id:entityTokenSchema,source_ids:{type:"array",minItems:1,maxItems:100,uniqueItems:true,items:entityTokenSchema}},required:["request_id","source_ids"],additionalProperties:false},
} as const;
export const entityContextTool={name:"entity_context",displayName:"Read current public organization context",description:"Read or search current source-attributed public organization holdings for this configured native actor/project. No funding case, goal, legal adoption or private applicant fact is implied. context accepts offset/limit/source_id/context_hash; search accepts query/offset/limit/context_hash. Only a configured researcher owning the current task may refresh with {request_id,source_ids:[id,...]}. Obtain IDs from context.items where kind=configured_source. source_id is singular ONLY for the context filter; refresh always requires the plural array source_ids and the same ordered array on replay. URLs, audiences, recipients and scope are administrator configured. Successful prior refresh sources persist; repeat the same request_id to read back, or use a new request_id to retry failed sources.",parametersSchema:{type:"object",properties:{operation:{type:"string",enum:["context","search","refresh"]},parameters:{type:"object"}},required:["operation","parameters"],additionalProperties:false,oneOf:Object.entries(entityParameterSchemas).map(([operation,parameters])=>({type:"object",properties:{operation:{const:operation},parameters},required:["operation","parameters"],additionalProperties:false}))}}as const;
function validate(op:string,p:Record<string,unknown>){
 if(op==="refresh"){if(Object.keys(p).sort().join()!=="request_id,source_ids"||!text(p.request_id)||!Array.isArray(p.source_ids)||!p.source_ids.length||p.source_ids.length>100||!p.source_ids.every(text)||new Set(p.source_ids).size!==p.source_ids.length)throw Error("Invalid protected entity refresh");return;}
 const fields=op==="search"?["query","offset","limit","context_hash"]:["offset","limit","source_id","context_hash"];
 if(!["context","search"].includes(op)||Object.keys(p).some(k=>!fields.includes(k))||!Number.isSafeInteger(p.offset??0)||Number(p.offset??0)<0||!Number.isSafeInteger(p.limit??50)||Number(p.limit??50)<1||Number(p.limit??50)>100||p.context_hash!==undefined&&!digest(p.context_hash)||p.source_id!==undefined&&!text(p.source_id)||op==="search"&&(typeof p.query!=="string"||!p.query.trim()||p.query.length>500))throw Error("Invalid entity context page");
}
export function registerEntityContext(ctx:Pick<PluginContext,"tools"|"issues"|"agents">,bindings:EntityBinding[]):void{
 ctx.tools.register(entityContextTool.name,entityContextTool,async(input,provided)=>{
  if(!object(input)||Object.keys(input).sort().join()!=="operation,parameters"||!object(input.parameters)||!["context","search","refresh"].includes(String(input.operation))||Buffer.byteLength(JSON.stringify(input))>128*1024)throw Error("Invalid entity request");
  const op=String(input.operation);validate(op,input.parameters);
  const run=structuredClone(provided),matches=bindings.flatMap(b=>b.companyId===run.companyId?b.actorGrants.filter(g=>g.agentId===run.agentId&&g.projectIds.includes(run.projectId??"")).map(grant=>({b,grant})):[]);
  if(matches.length!==1)throw Error("Entity actor/project grant unavailable");
  const{b,grant}=matches[0]!,rawMeta=(run as typeof run&{entityExecution?:unknown}).entityExecution;
  if(!object(rawMeta)||!text(rawMeta.issueId))throw Error("Entity native execution unavailable");
  const meta:Record<string,unknown>=structuredClone(rawMeta);
  async function context(signal?:AbortSignal):Promise<EntityContext>{
   if(signal?.aborted||!await b.authorize())throw Error("Entity configuration changed");
   const issue=await ctx.issues.get(String(meta.issueId),b.companyId),agent=await ctx.agents.get(run.agentId,b.companyId);
   if(!issue||issue.id!==meta.issueId||issue.companyId!==b.companyId||issue.projectId!==run.projectId||issue.hiddenAt||!agent||agent.id!==run.agentId||agent.companyId!==b.companyId||!["idle","running"].includes(agent.status)||!["general","ceo"].includes(agent.role))throw Error("Entity native task/actor unavailable");
   const tree=await ctx.issues.getSubtree(issue.id,b.companyId,{includeRoot:true,includeActiveRuns:true});
   const active=tree.activeRuns?.[issue.id]?.find(r=>r.id===run.runId&&r.issueId===issue.id&&r.agentId===run.agentId&&r.status==="running"&&r.finishedAt===null);
   if(tree.companyId!==b.companyId||tree.rootIssueId!==issue.id||!active)throw Error("Entity native run unavailable");
   let role:EntityContext["role"],canRefresh=false;
   if(meta.review!==null){
    if(!object(meta.review))throw Error("Entity review identity unavailable");
    const review=meta.review,card=(await ctx.issues.listInteractions(issue.id,b.companyId)).find(r=>r.id===review.interactionId),target=card&&object(card.payload)&&object(card.payload.target)?card.payload.target:null;
    if(!card||card.companyId!==b.companyId||card.issueId!==issue.id||card.kind!=="request_confirmation"||card.addresseeAgentId!==run.agentId||card.addresseeUserId||card.sourceRunId!==review.producerRunId||issue.assigneeAgentId!==review.producerAgentId||!target||target.type!=="custom"||target.key!=="native_completion_review"||target.revisionId!==review.decisionId||!((card.status==="pending"&&issue.status==="in_review"&&issue.executionRunId===run.runId)||(["accepted","rejected"].includes(card.status)&&card.resolvedByRunId===run.runId&&card.resolvedByAgentId===run.agentId)))throw Error("Entity review assignment changed");
    role="reviewer";
   }else{
    if(issue.assigneeAgentId!==run.agentId||issue.executionRunId!==run.runId||!["todo","in_progress","blocked"].includes(issue.status))throw Error("Entity current task owner changed");
    canRefresh=grant.canRefresh&&issue.status==="in_progress";role=grant.canRefresh?"researcher":"reader";
   }
   const expected={version:1,companyId:b.companyId,projectId:run.projectId,issueId:issue.id,agentId:run.agentId,runId:run.runId,principalId:grant.principalId,role,canRefresh,bindingHash:b.fingerprint,review:meta.review};
   if(Object.keys(meta).sort().join()!==Object.keys(expected).sort().join()||stableHash(meta)!==stableHash(expected)||op==="refresh"&&!canRefresh)throw Error("Entity execution scope or refresh grant changed");
   if(signal?.aborted||!await b.authorize())throw Error("Entity authorization changed");
   return{company_id:b.companyId,applicant_slug:b.applicantSlug,project_id:issue.projectId!,issue_id:issue.id,agent_id:run.agentId,principal_id:grant.principalId,run_id:run.runId,role};
  }
  await context();
  const result=await b.bridge.call(op,input.parameters,{context});
  await context();return{data:result};
 });
}
export async function registerConfiguredEntityContext(ctx:PluginContext):Promise<void>{
 const bindings:EntityBinding[]=[];
 for(const company of await ctx.companies.list({limit:1000})){
  const raw=(await ctx.config.get(company.id)).entityContext;if(!object(raw)||raw.enabled!==true)continue;
  if(Object.keys(raw).sort().join()!=="actorGrants,applicantSlug,enabled,process"||!text(raw.applicantSlug)||!Array.isArray(raw.actorGrants)||!raw.actorGrants.length)throw Error("Invalid entity context configuration");
  const grants:Grant[]=[];
  for(const g of raw.actorGrants){
   if(!object(g)||Object.keys(g).sort().join()!=="agentId,canRefresh,principalId,projectIds"||!text(g.agentId)||!text(g.principalId)||typeof g.canRefresh!=="boolean"||!Array.isArray(g.projectIds)||!g.projectIds.length||!g.projectIds.every(text)||new Set(g.projectIds).size!==g.projectIds.length)throw Error("Invalid entity actor grant");
   if(grants.some(p=>p.agentId===g.agentId||p.principalId===g.principalId))throw Error("Ambiguous entity actor grant");
   grants.push(g as unknown as Grant);
  }
  const fingerprint=stableHash(raw);bindings.push({companyId:company.id,applicantSlug:raw.applicantSlug,actorGrants:grants,fingerprint,authorize:async()=>stableHash((await ctx.config.get(company.id)).entityContext)===fingerprint,bridge:createBoundedContextBridge(raw.process as unknown as BoundedProcessConfig,"dfw-entity-grounding-v1")});
 }
 registerEntityContext(ctx,bindings);
}
