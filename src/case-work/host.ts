import {randomUUID} from "node:crypto";
import type {PluginContext,ToolRunContext} from "@paperclipai/plugin-sdk";
import {createBoundedContextBridge,type BoundedProcessConfig,type ContextBridge} from "../bridge/duplex.js";
import {resolveNativeDescendantTask,validateNativeTaskRun} from "../paperclip/context.js";
import {createRuntimeOwner} from "../bridge/ownership.js";
import {discoveryHash} from "../discovery/service.js";
import {readNativeDocument,writeNativeDocument} from "../discovery/documents.js";
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const identifier=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=128&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v);
const digest=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
type Party={agentId:string;principalId:string};
export interface CaseWorkContext {company_id:string;applicant_slug:string;project_id:string;issue_id:string;root_issue_id:string;root_project_id:string;agent_id:string;principal_id:string;run_id:string;role:"researcher"|"producer";case_binding_id:string|null}
export interface CaseWorkBinding {companyId:string;researchProjectId:string;projectId:string;rootIssueId:string;rootProjectId:string;applicantSlug:string;researcher:Party;producer:Party;reviewer?:Party;policyRevision:string;bridge:ContextBridge<CaseWorkContext>;authorize:()=>Promise<boolean>}
const hashSchema={type:"string",pattern:"^[a-f0-9]{64}$"} as const;
const caseParametersSchema={oneOf:[
 {type:"object",description:"reserve_case: researcher only; source IDs and hashes from current inventory.",properties:{record_id:{type:"string",maxLength:128},record_hash:hashSchema,scan_hash:hashSchema},required:["record_id","record_hash"],additionalProperties:false},
 {type:"object",description:"context: producer only. summary is default. source requires source_document_id; source text limit 1..32000 (default8000), history limit1..100(default25). summary accepts no paging.",properties:{view:{type:"string",enum:["summary","source","history"]},source_document_id:{type:"string",maxLength:128},offset:{type:"integer",minimum:0},limit:{type:"integer",minimum:1,maximum:32000}},additionalProperties:false},
 {type:"object",description:"checkpoint: producer only. Use context revision_hash and current checkpoint_hash, or null previous_checkpoint_hash for first save. At least substantive note, artifact_refs or unresolved required. Saving partial work never completes the native case.",properties:{revision_hash:hashSchema,previous_checkpoint_hash:{anyOf:[hashSchema,{type:"null"}]},phase:{type:"string",enum:["research","draft"]},artifact_refs:{type:"array",maxItems:100,items:{type:"object",properties:{kind:{type:"string",enum:["research","draft","gap"]},reference:{type:"string",minLength:1,maxLength:2048},sha256:hashSchema},required:["kind","reference","sha256"],additionalProperties:false}},note:{type:"string",minLength:1,maxLength:32768},unresolved:{type:"array",maxItems:100,items:{type:"string",minLength:1,maxLength:2048}}},required:["revision_hash","previous_checkpoint_hash","phase","artifact_refs"],additionalProperties:false}
,
 {type:"object",description:"save: producer only. First read prepare/workspace output_contract.proposal_schema; every proposal must match the complete typed schema and exact workspace hash.",properties:{workspace_hash:hashSchema,proposals:{type:"array",minItems:1,maxItems:100,items:{type:"object"}}},required:["workspace_hash","proposals"],additionalProperties:false},
 {type:"object",description:"save_gap_progress: producer only. Use current workspace output_contract for typed progress. Saving progress queues no native review by itself.",properties:{workspace_hash:hashSchema,progress:{type:"object"},previous_hash:{anyOf:[hashSchema,{type:"null"}]}},required:["workspace_hash","progress"],additionalProperties:false}
]} as const;
export const caseWorkTool={name:"funding_case_work",displayName:"Checkpoint one current public funding case",description:"Researcher: reserve_case(record_id,record_hash,scan_hash?) creates a durable preliminary source checkpoint for GENERAL Coordinator to create the ordinary native task while scanning continues. Producer: prepare/workspace with empty parameters derives only this exact case after current independent source admission and returns full typed proposal/gap schemas. save(workspace_hash,proposals) and save_gap_progress(workspace_hash,progress,previous_hash?) persist partial typed work. render/packet take empty parameters. A pending review acknowledgement is not a queued reviewer: request the actual independent native review using ordinary paperclip_finish needs_review, then continue producer corrections after rejection; no case completion from partial work. Producer: context defaults to summary; source view pages bound source_document_id text; history view pages complete prior checkpoints. checkpoint saves substantive note/draft text, source artifact references and unresolved work using current revision_hash and previous_checkpoint_hash CAS. This never completes the funding case, admits eligibility, approves an application or submits. Native case work remains open; use normal progress, review and continuation for remaining work.",parametersSchema:{type:"object",properties:{operation:{type:"string",enum:["reserve_case","context","checkpoint","prepare","workspace","save","save_gap_progress","render","packet"]},parameters:caseParametersSchema},required:["operation","parameters"],additionalProperties:false}} as const;
export function caseBindingFromOrigin(origin:unknown,root:string):string{
 const prefix="paperclip-runner:create-task:"+root+":case:";
 if(typeof origin!=="string"||!origin.startsWith(prefix)||!identifier(origin.slice(prefix.length)))throw Error("Native case origin unavailable");
 return origin.slice(prefix.length);
}
function parameters(op:string,p:Record<string,unknown>){
 if(["prepare","workspace","render","packet"].includes(op)){if(Object.keys(p).length)throw Error("Invalid case preparation parameters");return;}
 if(["save","save_gap_progress"].includes(op)){
  const save=op==="save",fields=save?["workspace_hash","proposals"]:["workspace_hash","progress","previous_hash"];
  if(Object.keys(p).some(k=>!fields.includes(k))||!digest(p.workspace_hash)||(save?(!Array.isArray(p.proposals)||p.proposals.length<1||p.proposals.length>100||p.proposals.some(v=>!object(v))):(!object(p.progress)||p.previous_hash!==undefined&&p.previous_hash!==null&&!digest(p.previous_hash))))throw Error("Invalid case preparation parameters");return;
 }
 if(op==="reserve_case"){if(Object.keys(p).some(k=>!["record_id","record_hash","scan_hash"].includes(k))||!identifier(p.record_id)||!digest(p.record_hash)||p.scan_hash!==undefined&&!digest(p.scan_hash))throw Error("Invalid case reservation");return;}
 if(op==="context"){
  const view=p.view??"summary",offset=p.offset??0,limit=p.limit??(view==="source"?8000:25);
  if(Object.keys(p).some(k=>!["view","source_document_id","offset","limit"].includes(k))||!["summary","source","history"].includes(String(view))||!Number.isSafeInteger(offset)||Number(offset)<0||!Number.isSafeInteger(limit)||Number(limit)<1||Number(limit)>(view==="source"?32000:100)||(view==="source")!==Object.hasOwn(p,"source_document_id")||view==="source"&&!identifier(p.source_document_id)||view==="summary"&&(offset!==0||p.limit!==undefined))throw Error("Invalid case context page");return;
 }
 if(op!=="checkpoint"||Object.keys(p).some(k=>!["previous_checkpoint_hash","revision_hash","phase","artifact_refs","note","unresolved"].includes(k))||!digest(p.revision_hash)||!Object.hasOwn(p,"previous_checkpoint_hash")||p.previous_checkpoint_hash!==null&&!digest(p.previous_checkpoint_hash)||!["research","draft"].includes(String(p.phase))||!Array.isArray(p.artifact_refs)||p.artifact_refs.length>100||p.artifact_refs.some(r=>!object(r)||Object.keys(r).sort().join()!=="kind,reference,sha256"||!["research","draft","gap"].includes(String(r.kind))||typeof r.reference!=="string"||!r.reference.trim()||r.reference.length>2048||!digest(r.sha256))||p.note!==undefined&&(typeof p.note!=="string"||!p.note.trim()||p.note.length>32768)||p.unresolved!==undefined&&(!Array.isArray(p.unresolved)||p.unresolved.length>100||p.unresolved.some(v=>typeof v!=="string"||!v.trim()||v.length>2048))||!p.artifact_refs.length&&!p.note&&!(Array.isArray(p.unresolved)&&p.unresolved.length))throw Error("Invalid substantive case checkpoint");
}
export function registerCaseWork(ctx:Pick<PluginContext,"tools"|"issues">,bindings:CaseWorkBinding[],owner:Pick<ReturnType<typeof createRuntimeOwner>,"own">):void{
 ctx.tools.register(caseWorkTool.name,caseWorkTool,async(input,provided)=>{
  if(!object(input)||Object.keys(input).sort().join()!=="operation,parameters"||!object(input.parameters)||!["reserve_case","context","checkpoint","prepare","workspace","save","save_gap_progress","render","packet"].includes(String(input.operation))||Buffer.byteLength(JSON.stringify(input))>256*1024)throw Error("Invalid case work request");
  const op=String(input.operation),params=input.parameters;parameters(op,params);
  const run=structuredClone(provided),matches=bindings.filter(b=>b.companyId===run.companyId&&((run.projectId===b.researchProjectId&&run.agentId===b.researcher.agentId)||(run.projectId===b.projectId&&run.agentId===b.producer.agentId)));
  if(matches.length!==1)throw Error("Case work scope unavailable");
  const b=matches[0]!,role=run.agentId===b.researcher.agentId?"researcher":"producer",party=role==="researcher"?b.researcher:b.producer;
  if((role==="researcher")!==(op==="reserve_case"))throw Error("Case work role denied");
  if(["prepare","workspace","save","save_gap_progress","render","packet"].includes(op)&&!b.reviewer)throw Error("Case preparation requires the configured independent native reviewer");
  async function current(signal?:AbortSignal){
   if(signal?.aborted||!await b.authorize())throw Error("Case work configuration changed");
   const projectId=role==="researcher"?b.researchProjectId:b.projectId;
   const id=await resolveNativeDescendantTask(ctx,{companyId:b.companyId,projectId,rootIssueId:b.rootIssueId,rootProjectId:b.rootProjectId,allowedAgentIds:[party.agentId],authorize:b.authorize},run);
   const issue=id?await ctx.issues.get(id,b.companyId):null,root=await ctx.issues.get(b.rootIssueId,b.companyId);
   if(!issue||issue.hiddenAt||issue.executionRunId!==run.runId||issue.status!=="in_progress"||!root||root.hiddenAt||root.companyId!==b.companyId||root.projectId!==b.rootProjectId||["done","cancelled"].includes(root.status)||role==="producer"&&(issue.parentId!==b.rootIssueId||issue.originKind!=="manual"))throw Error("Current case task unavailable");
   await validateNativeTaskRun(ctx,{companyId:b.companyId,projectId,issueId:issue.id,agentId:party.agentId,authorize:b.authorize},run,signal);
   const context:CaseWorkContext={company_id:b.companyId,applicant_slug:b.applicantSlug,project_id:projectId,issue_id:issue.id,root_issue_id:b.rootIssueId,root_project_id:b.rootProjectId,agent_id:party.agentId,principal_id:party.principalId,run_id:run.runId,role,case_binding_id:role==="producer"?caseBindingFromOrigin(issue.originId,b.rootIssueId):null};
   return{context,issue,root};
  }
  const initial=await current(),context=async(signal?:AbortSignal)=>(await current(signal)).context;
  const caseTask=async(request:Record<string,unknown>,signal?:AbortSignal)=>{
   const c=await current(signal);
   if(role!=="producer"||Object.keys(request).sort().join()!=="case_binding_id"||request.case_binding_id!==c.context.case_binding_id)throw Error("Case task callback denied");
   return{company_id:b.companyId,project_id:b.projectId,issue_id:c.issue.id,parent_id:c.issue.parentId,assignee_agent_id:c.issue.assigneeAgentId,origin_kind:c.issue.originKind,origin_id:c.issue.originId,hidden:Boolean(c.issue.hiddenAt),status:c.issue.status,active_run_id:run.runId,root_hidden:Boolean(c.root.hiddenAt),root_status:c.root.status};
  };
  const result=await owner.own({companyId:b.companyId,namespaceScope:"inertia:case-work",key:discoveryHash([b.rootIssueId,b.applicantSlug,initial.context.case_binding_id??params.record_id])},async()=>{
   const value=await b.bridge.call(op,params,{context,caseTask,review:async(request,signal)=>{
    if(role!=="producer"||!["save","save_gap_progress"].includes(op)||!object(request)||!(request.kind==="gap_plan"?identifier(request.request_id):digest(request.request_id))||Buffer.byteLength(JSON.stringify(request))>128*1024)throw Error("Invalid exact-case pending review request");
    await current(signal);
    // Acknowledges a committed domain request only; actual native needs_review
    // and independent participant admission remain owned by Paperclip.
    return{state:"pending",request_id:request.request_id as string};
   }});
   await current();
   if(!object(value)||value.business_complete!==false||!identifier(value.case_binding_id)||role==="producer"&&value.case_binding_id!==initial.context.case_binding_id)throw Error("Case work receipt changed");
   if(role==="researcher"){
    const task={idempotencyKey:"case:"+value.case_binding_id,title:"Research funding case "+value.case_binding_id,description:"Save incremental current-source research and draft checkpoints through funding_case_work. This task remains open while agent work remains. Partial checkpoint success is not business completion or final application acceptance. Binding "+value.case_binding_id+".",projectId:b.projectId,assigneeActorId:b.producer.agentId,status:"todo"};
    const key="case-identification-"+value.case_binding_id+"-"+String(value.revision_hash??discoveryHash(value));
    const body=JSON.stringify({...value,create_task:task,native_source_issue_id:initial.issue.id},null,2);
    if(Buffer.byteLength(body)>524288)throw Error("Case source checkpoint requires paging");
    const previous=await readNativeDocument(ctx.issues.documents,initial.issue.id,key,b.companyId);
    if(previous&&previous.body!==body)throw Error("Immutable case source checkpoint changed");
    if(!previous){
     await writeNativeDocument(ctx.issues.documents,{companyId:b.companyId,issueId:initial.issue.id,key,title:"Identified public funding case",format:"markdown",body},{immutable:true});
     await current();
    }
    const comment="Agent source checkpoint: preliminary public funding case "+value.case_binding_id+" is available in source task "+initial.issue.id+". Continue independent case task creation with idempotencyKey "+task.idempotencyKey+" while full scanning continues. No eligibility, human approval or submission is asserted.";
    const marker="<!-- inertia-case-identified:"+discoveryHash([b.companyId,b.rootIssueId,value.case_binding_id,value.revision_hash??"initial"])+" -->";
    await current();
    const comments=await ctx.issues.listComments(b.rootIssueId,b.companyId);
    if(!comments.some(row=>row.body===comment||row.body.includes(marker))){
     await current();
     await ctx.issues.createComment(b.rootIssueId,comment+"\n\n"+marker,b.companyId,{authorAgentId:run.agentId});
    }
    // Generic native wakeup is at-least-once. Retry after a lost reply; native
    // create_task's stable case key, not this notification, deduplicates tasks.
    await current();
    await ctx.issues.requestWakeup(b.rootIssueId,b.companyId,{reason:"funding_case_identified",contextSource:"inertia.case-work",idempotencyKey:"case-identified:"+value.case_binding_id+":"+String(value.revision_hash??"initial"),actorAgentId:run.agentId,actorRunId:run.runId});
    return{...value,create_task:task,native_source_issue_id:initial.issue.id};
   }
   if(op==="checkpoint"){
    const body=JSON.stringify({...value,note:params.note??null,unresolved:params.unresolved??[],artifact_refs:params.artifact_refs},null,2);
    await writeNativeDocument(ctx.issues.documents,{companyId:b.companyId,issueId:initial.issue.id,key:"case-progress-"+String(value.checkpoint_hash??discoveryHash(value)),title:"Partial funding case work",format:"markdown",body},{immutable:true});
    await current();
   }
   return b.reviewer?{...value,native_review_guidance:{queued:false,reviewer_agent_id:b.reviewer.agentId,attention_request:{kind:"review",ownerClass:"agent",targetAgentId:b.reviewer.agentId,summary:"Independently review the current typed case preparation; reject with precise corrections until regenerated complete packet is supported."},instruction:"Saved domain requests do not queue a reviewer. Use ordinary paperclip_finish reportedWorkDisposition needs_review with this named attentionRequests entry and the actual current completion contract. Preserve remaining work truthfully. Partial saves are not case completion. Independent item reviews require producer correction/regeneration before whole-packet acceptance."}}:value;
  });
  if(result===null)throw Error("This case is busy; other cases remain independent");
  return{data:result};
 });
}
export async function registerConfiguredCaseWork(ctx:PluginContext):Promise<void>{
 const bindings:CaseWorkBinding[]=[];
 for(const company of await ctx.companies.list({limit:1000})){
  const raw=(await ctx.config.get(company.id)).nativeCaseWork;
  if(!object(raw)||raw.enabled!==true)continue;
  const keys=["enabled","researchProjectId","projectId","rootIssueId","rootProjectId","applicantSlug","researcher","producer","policyRevision","process"];
  const reviewConfigured=Object.hasOwn(raw,"reviewer")||Object.hasOwn(raw,"reviewProcess");if(reviewConfigured)keys.push("reviewer","reviewProcess");
  if(Object.keys(raw).sort().join()!==keys.sort().join()||![raw.researchProjectId,raw.projectId,raw.rootIssueId,raw.rootProjectId,raw.applicantSlug,raw.policyRevision].every(identifier))throw Error("Invalid protected case work configuration");
  for(const p of[raw.researcher,raw.producer])if(!object(p)||Object.keys(p).sort().join()!=="agentId,principalId"||!Object.values(p).every(identifier))throw Error("Invalid case work principal");
  const researcher=raw.researcher as unknown as Party,producer=raw.producer as unknown as Party;
  if(researcher.agentId===producer.agentId||researcher.principalId===producer.principalId)throw Error("Case research producer identities must differ");
  if(reviewConfigured){
   if(!object(raw.reviewer)||Object.keys(raw.reviewer).sort().join()!=="agentId,principalId"||!Object.values(raw.reviewer).every(identifier)||raw.reviewer.agentId===producer.agentId||raw.reviewer.principalId===producer.principalId||!object(raw.reviewProcess)||raw.reviewProcess.configurationPath!==(raw.process as Record<string,unknown>).configurationPath)throw Error("Independent case reviewer unavailable");
   createBoundedContextBridge(raw.reviewProcess as unknown as BoundedProcessConfig,"dfw-native-case-review-v1");
  }
  const fingerprint=discoveryHash(raw);
  bindings.push({companyId:company.id,researchProjectId:raw.researchProjectId as string,projectId:raw.projectId as string,rootIssueId:raw.rootIssueId as string,rootProjectId:raw.rootProjectId as string,applicantSlug:raw.applicantSlug as string,researcher,producer,...(reviewConfigured?{reviewer:raw.reviewer as unknown as Party}:{}),policyRevision:raw.policyRevision as string,bridge:createBoundedContextBridge<CaseWorkContext>(raw.process as unknown as BoundedProcessConfig,"dfw-native-case-work-v1"),authorize:async()=>discoveryHash((await ctx.config.get(company.id)).nativeCaseWork)===fingerprint});
 }
 registerCaseWork(ctx,bindings,createRuntimeOwner(ctx.db,{workerId:"case-work:"+process.pid+":"+randomUUID(),runId:"native-plugin-worker"}));
}
