/** Source adapter tests, not native scheduler or runtime admission evidence. */
import { expect,it } from "vitest";
import { publicDraftingTools, publicGapPlanReviewTool } from "../../src/drafting/host.js";
import { readNativeDocument } from "../../src/discovery/documents.js";
import manifest from "../../src/manifest.js";
import { fixture } from "./fixture.js";
const digest="a".repeat(64),requestId="3fed4a00-4eb8-5e70-a206-883845154cf4";
const flags={nativeCaseProgression:true,nativeDependencyHandoff:true,nativeGapPlanReview:true};
function gap() {
 const f=fixture(flags),subtree=f.ctx.issues.getSubtree;
 const relations:any={producer:{blockedBy:[{id:"reviewer",status:"in_progress"}],blocks:[]},reviewer:{blockedBy:[],blocks:[]}};
 f.ctx.issues.getSubtree=async(...args:any[])=>({...await subtree(...args),relations:{[args[0]]:relations[args[0]]}});
 const updates:any[]=[];const update=f.ctx.issues.update;
 f.ctx.issues.update=async(...args:any[])=>{updates.push(args);return update(...args);};
 return {...f,relations,updates,call:(args:any,run=f.reviewer)=>f.tools.get("review_funding_gap_plan")(args,run)};
}
const context=()=>({kind:"gap_plan",requests:[],next_action:"no_pending_gap_reviews"});
const receipt=(pending=0,review_state="handoff_ready")=>({kind:"gap_plan",request_id:requestId,review_state,pending_review_count:pending});
const packet=()=>({status:"public_machine_reviewed_draft_not_human_accepted",workspace_hash:digest,pending_review_count:1,draft_candidates:[],remaining_work:[]});
it("retains exactly the six legacy declarations with default-off optional registration",()=>{
 const f=fixture();expect(f.tools.size).toBe(6);expect(publicDraftingTools).toHaveLength(6);
 expect([...f.tools.keys()]).toEqual(publicDraftingTools.map(t=>t.name));expect(f.tools.has("review_funding_gap_plan")).toBe(false);
 const enabled=gap();expect(enabled.tools.size).toBe(7);
});
it("requires administrator boolean paired flags and rejects post-registration activation",async()=>{
 for(const extra of [{nativeGapPlanReview:true},{nativeGapPlanReview:true,nativeCaseProgression:true},{...flags,nativeGapPlanReview:"true"}])
  expect(()=>fixture(extra as any)).toThrow();
 const f=fixture();f.binding.nativeGapPlanReview=true;
 await expect(f.tools.get("funding_drafting_workspace")({},f.producer)).rejects.toThrow();expect(f.seen).toEqual([]);
});
it("routes explicit context only for fresh configured reviewer without admitting or mirroring",async()=>{
 const f=gap();f.bridge.call=async(op:any,p:any,c:any)=>{expect(op).toBe("gap_review_context");expect(p).toEqual({});expect((await c.context()).role).toBe("reviewer");return context();};
 expect((await f.call({operation:"context"})).data).toEqual(context());
 await expect(f.call({operation:"context"},f.producer)).rejects.toThrow();expect(f.docs.size).toBe(0);expect(f.updates).toEqual([]);
 f.bridge.call=async(op:any,p:any)=>{expect(op).toBe("gap_review_context");expect(p).toEqual({request_id:requestId});return context();};
 await f.call({operation:"context",request_id:requestId});
});
it.each([
 {},{operation:"unknown"},{request_id:requestId,artifact:{}},{operation:"context",request_id:null},
 {operation:"context",request_id:digest},{operation:"context",artifact:{}},{operation:"context",replay_only:true},
 {operation:"context",principal_id:"spoof"},{operation:"admit",artifact:{}},{operation:"admit",request_id:requestId},
 {operation:"admit",request_id:digest,artifact:{}},{operation:"admit",request_id:requestId,artifact:[]},
 {operation:"admit",request_id:requestId,artifact:{},replay_only:false},{operation:"admit",request_id:requestId,artifact:{},company_id:"spoof"},
])("rejects malformed, inferred or authority-bearing gap input %j before native I/O",async args=>{
 const f=gap();await expect(f.call(args)).rejects.toThrow();expect(f.seen).toEqual([]);expect(f.events).toEqual([]);
});
it.each(["handoff_ready","rework_required"])("admits typed %s result with host-only replay policy and combined pending lifecycle",async state=>{
 for(const pending of [0,1]) {
  const f=gap();f.rows.producer.status="blocked";
  f.bridge.call=async(op:any,p:any,c:any)=>{expect(op).toBe("review_gap");expect(p).toEqual({request_id:requestId,artifact:{},replay_only:false});await c.context();return receipt(pending,state);};
  expect((await f.call({operation:"admit",request_id:requestId,artifact:{}})).data).toEqual(receipt(pending,state));
  expect(f.rows.reviewer.status).toBe(pending?"in_progress":"done");expect(f.rows.producer.status).toBe("blocked");expect(f.wakeups.size).toBe(0);
  const doc=await readNativeDocument(f.ctx.issues.documents,"reviewer","public-gap-plan-review-completion:"+requestId,"company");expect(doc).not.toBeNull();expect(doc!.title).toContain("not human acceptance");
 }
});
it("candidate admission still remains in progress while authoritative gap work is pending",async()=>{
 const f=gap();f.bridge.call=async()=>({request_id:digest,state:"supported",pending_review_count:1});
 await f.tools.get("review_funding_candidate")({request_id:digest,artifact:{}},f.reviewer);
 expect(f.rows.reviewer.status).toBe("in_progress");expect(f.wakeups.size).toBe(0);
});
it.each([{kind:"candidate"},{request_id:digest},{review_state:"supported"},{pending_review_count:-1},{pending_review_count:1.5}])("denies invalid typed authoritative receipt %j",async override=>{
 const f=gap();f.bridge.call=async()=>({...receipt(),...override});
 await expect(f.call({operation:"admit",request_id:requestId,artifact:{}})).rejects.toThrow();expect(f.docs.size).toBe(0);expect(f.updates).toEqual([]);
});
it("gap callback preserves typed UUID ack and distinct request/wakeup instructions",async()=>{
 const f=gap(),request={kind:"gap_plan",request_id:requestId,progress:{requirement_id:"gap"}};
 f.bridge.call=async(_:any,__:any,c:any)=>({progress_hash:digest,ack:await c.review(request),packet:packet()});
 const result=await f.tools.get("save_funding_gap_progress")({workspace_hash:digest,progress:{}},f.producer);
 expect(result.data.ack).toEqual({kind:"gap_plan",state:"pending",request_id:requestId});
 const doc=await readNativeDocument(f.ctx.issues.documents,"reviewer","public-gap-plan-review:"+requestId,"company");expect(doc!.body).toContain('"kind":"gap_plan"');expect(doc!.title).toContain("gap-plan");
 const wake=f.wakeups.get(requestId);expect(wake.contextSource).toBe("inertia.public-drafting.gap-review");expect(wake.reason).toContain("review_funding_gap_plan");expect(wake.reason).toContain('operation: "context"');expect(wake.reason).toContain("untrusted");
});
it.each([{kind:"gap_plan",request_id:digest},{request_id:requestId},{kind:"other",request_id:requestId}])("rejects gap/candidate identifier confusion %j",async request=>{
 const f=gap();f.bridge.call=async(_:any,__:any,c:any)=>c.review(request);
 await expect(f.tools.get("save_funding_gap_progress")({workspace_hash:digest,progress:{}},f.producer)).rejects.toThrow();expect(f.docs.size).toBe(0);expect(f.wakeups.size).toBe(0);
});
it("rejects typed gap callback when optional feature is disabled",async()=>{
 const f=fixture();f.bridge.call=async(_:any,__:any,c:any)=>c.review({kind:"gap_plan",request_id:requestId});
 await expect(f.tools.get("save_funding_gap_progress")({workspace_hash:digest,progress:{}},f.producer)).rejects.toThrow();expect(f.docs.size).toBe(0);
});
it.each(["pause","run","graph","revoke","flag","checkout"])("preserves fresh %s authority on gap context and admission",async kind=>{
 for(const operation of ["context","admit"]) {
  const f=gap();if(kind==="pause")f.agents.critic.status="paused";if(kind==="run")f.runs.reviewer[0].status="succeeded";
  if(kind==="graph")f.relations.reviewer.blockedBy=[{id:"producer",status:"blocked"}];if(kind==="revoke")f.revoke();if(kind==="flag")f.binding.nativeGapPlanReview=false;
  if(kind==="checkout")f.ctx.issues.assertCheckoutOwner=async()=>{throw Error("native pause");};
  await expect(f.call(operation==="context"?{operation}:{operation,request_id:requestId,artifact:{}})).rejects.toThrow();
  expect(f.seen).toEqual([]);expect(f.docs.size).toBe(0);expect(f.updates).toEqual([]);
 }
});
it("rechecks authority in gap callback and before actual completion mirror",async()=>{
 for(const at of ["callback","mirror"]) {
  const f=gap();f.bridge.call=async(_:any,__:any,c:any)=>{if(at==="callback"){f.revoke();await c.context();}return receipt();};
  if(at==="mirror")f.ctx.issues.documents.list=async()=>{f.revoke();return [];};
  await expect(f.call({operation:"admit",request_id:requestId,artifact:{}})).rejects.toThrow();expect(f.docs.size).toBe(0);expect(f.updates).toEqual([]);
 }
});
it.each(["running","queued"])("does not reopen R-done with prior %s run for a gap callback",async status=>{
 const f=gap();f.rows.reviewer.status="done";f.runs.reviewer[0].status=status;
 f.bridge.call=async(_:any,__:any,c:any)=>c.review({kind:"gap_plan",request_id:requestId});
 await expect(f.tools.get("save_funding_gap_progress")({workspace_hash:digest,progress:{}},f.producer)).rejects.toThrow();expect(f.updates).toEqual([]);expect(f.wakeups.size).toBe(0);
});

it("static optional definition grants no callable handler while disabled",async()=>{
 const {operation:_,...declaration}=publicGapPlanReviewTool;
 expect(manifest.tools?.filter(t=>t.name==="review_funding_gap_plan")).toEqual([declaration]);
 const legacy=publicDraftingTools.map(({operation:_,...tool})=>tool);
 expect(manifest.tools?.filter(t=>publicDraftingTools.some(d=>d.name===t.name))).toEqual(legacy);
 const f=fixture();expect([...f.tools.keys()]).toEqual(publicDraftingTools.map(t=>t.name));
 expect(f.tools.has("review_funding_gap_plan")).toBe(false);
 const enabled=gap();await expect(enabled.call({operation:"context"},enabled.producer)).rejects.toThrow();
 enabled.binding.nativeGapPlanReview=false;
 await expect(enabled.call({operation:"context"})).rejects.toThrow();expect(enabled.seen).toEqual([]);
 expect(declaration.annotations).toEqual({readOnlyHint:false,destructiveHint:true,openWorldHint:false,idempotentHint:false});
 expect(declaration.parametersSchema.oneOf).toHaveLength(2);
 for(const branch of declaration.parametersSchema.oneOf)expect(branch.additionalProperties).toBe(false);
});
it.each([
 {kind:"candidate",requests:[],next_action:"no_pending_gap_reviews"},
 {kind:"gap_plan",requests:[{kind:"gap_plan",request_id:digest,output_contract:{}}],next_action:"review_gap_plans"},
 {kind:"gap_plan",requests:[{kind:"gap_plan",request_id:requestId}],next_action:"review_gap_plans"},
 {kind:"gap_plan",requests:Array.from({length:101},()=>({kind:"gap_plan",request_id:requestId,output_contract:{}})),next_action:"review_gap_plans"},
])("rejects malformed authoritative gap context without native completion",async result=>{
 const f=gap();f.bridge.call=async()=>result;
 await expect(f.call({operation:"context"})).rejects.toThrow();expect(f.docs.size).toBe(0);expect(f.updates).toEqual([]);
});
it.each(["producer","company","project","stale-run","reassigned"])("denies gap admission for %s identity before domain I/O",async kind=>{
 const f=gap();let run={...f.reviewer};
 if(kind==="producer")run=f.producer;
 if(kind==="company")run.companyId="another-company";
 if(kind==="project")run.projectId="another-project";
 if(kind==="stale-run")run.runId="old-run";
 if(kind==="reassigned")f.rows.reviewer.assigneeAgentId="replacement";
 await expect(f.call({operation:"admit",request_id:requestId,artifact:{}},run)).rejects.toThrow();
 expect(f.seen).toEqual([]);expect(f.docs.size).toBe(0);expect(f.updates).toEqual([]);
});
it("gap callback does not bypass a revoked producer before dispatch or wake",async()=>{
 const f=gap();f.bridge.call=async(_:any,__:any,c:any)=>{f.revoke();return c.review({kind:"gap_plan",request_id:requestId});};
 await expect(f.tools.get("save_funding_gap_progress")({workspace_hash:digest,progress:{}},f.producer)).rejects.toThrow();
 expect(f.docs.size).toBe(0);expect(f.wakeups.size).toBe(0);expect(f.updates).toEqual([]);
});
it("context accepts exact completed request metadata without admitting another review",async()=>{
 const f=gap(),result={kind:"gap_plan",requests:[{kind:"gap_plan",request_id:requestId,output_contract:{type:"object"},completed_review:{rubric_version:"actionable-gap-v1"}}],next_action:"no_pending_gap_reviews"};
 f.bridge.call=async(op:any)=>{expect(op).toBe("gap_review_context");return result;};
 expect((await f.call({operation:"context",request_id:requestId})).data).toEqual(result);
 expect(f.docs.size).toBe(0);expect(f.updates).toEqual([]);expect(f.wakeups.size).toBe(0);
});
