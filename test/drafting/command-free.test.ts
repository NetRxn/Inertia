import { expect, it } from "vitest";
import { fixture } from "./fixture.js";
const digest="a".repeat(64);
const packet=(pending=0)=>({status:"public_machine_reviewed_draft_not_human_accepted",workspace_hash:digest,pending_review_count:pending,draft_candidates:[],remaining_work:[]});
const workspace=(pending=0)=>({workspace_hash:digest,packet:packet(pending)});
it("review context is discoverable without documents or shell and rejects producer/identity args",async()=>{
  const f=fixture();
  expect(f.tools.has("funding_review_context")).toBe(true);
  f.bridge.call=async(op:any,params:any,c:any)=>{expect(op).toBe("review_context");expect(params).toEqual({});expect((await c.context()).role).toBe("reviewer");return {requests:[],next_action:"no_pending_reviews"};};
  expect((await f.tools.get("funding_review_context")({},f.reviewer)).data.requests).toEqual([]);
  await expect(f.tools.get("funding_review_context")({},f.producer)).rejects.toThrow();
  await expect(f.tools.get("funding_review_context")({issueId:"other"},f.reviewer)).rejects.toThrow();
  expect(f.docs.size).toBe(0);
});
it("checkpoint publishes only verified packet and hands current producer preparation to native review",async()=>{
  const f=fixture();expect(f.tools.has("funding_drafting_checkpoint")).toBe(true);
  f.bridge.call=async(op:any,params:any,c:any)=>{expect(op).toBe("workspace");expect(params).toEqual({});await c.context();return workspace();};
  const updates:any[]=[];
  f.ctx.issues.update=async(id:any,patch:any,company:any,actor:any)=>{updates.push({id,patch,company,actor});f.rows[id].status=patch.status;return f.rows[id];};
  for(let i=0;i<2;i++) await f.tools.get("funding_drafting_checkpoint")({},f.producer);
  expect(f.rows.producer.status).toBe("in_review");
  expect(f.docs.size).toBe(1);
  expect(JSON.parse([...f.docs.values()][0].body)).toMatchObject({version:"dfw-public-drafting-checkpoint-v1",operation:"checkpoint",packet:packet()});
  expect(updates[0]).toEqual({id:"producer",patch:{status:"in_review"},company:"company",actor:{actorAgentId:"author",actorRunId:"run-author"}});
  await expect(f.tools.get("save_funding_proposals")({workspace_hash:digest,proposals:[{}]},f.producer)).rejects.toThrow();
});
it("checkpoint records pending independent review as blocked, never approved or submitted",async()=>{
  const f=fixture();expect(f.tools.has("funding_drafting_checkpoint")).toBe(true);
  f.bridge.call=async()=>workspace(1);
  f.ctx.issues.update=async(id:any,patch:any)=>{f.rows[id].status=patch.status;return f.rows[id];};
  await f.tools.get("funding_drafting_checkpoint")({},f.producer);
  expect(f.rows.producer.status).toBe("blocked");
  expect([...f.docs.values()][0].body).toContain("not_human_accepted");
});
it("checkpoint rejects spoofed authority, wrong role, stale packet and revoked authority before native output",async()=>{
  for(const invalid of [{status:"done"},{issueId:"other"},{principal_id:"other"}]) {
    const f=fixture();expect(f.tools.has("funding_drafting_checkpoint")).toBe(true);
    await expect(f.tools.get("funding_drafting_checkpoint")(invalid,f.producer)).rejects.toThrow();expect(f.docs.size).toBe(0);
  }
  const f=fixture();await expect(f.tools.get("funding_drafting_checkpoint")({},f.reviewer)).rejects.toThrow();
  f.bridge.call=async()=>({workspace_hash:digest,packet:{...packet(),workspace_hash:"b".repeat(64)}});
  await expect(f.tools.get("funding_drafting_checkpoint")({},f.producer)).rejects.toThrow();expect(f.docs.size).toBe(0);
  f.bridge.call=async()=>{f.revoke();return workspace();};
  await expect(f.tools.get("funding_drafting_checkpoint")({},f.producer)).rejects.toThrow();expect(f.docs.size).toBe(0);
});
it("revocation during snapshot reads stops actual native write",async()=>{
  const f=fixture();expect(f.tools.has("funding_drafting_checkpoint")).toBe(true);
  f.bridge.call=async()=>workspace();f.ctx.issues.documents.list=async()=>{f.revoke();return [];};
  await expect(f.tools.get("funding_drafting_checkpoint")({},f.producer)).rejects.toThrow();expect(f.docs.size).toBe(0);
});
it("review receipt publishes canonical evidence, wakes producer, and hands reviewer work to review only when exhausted",async()=>{
  for(const pending of [0,1]){
    const f=fixture();f.bridge.call=async()=>({request_id:digest,state:"supported",pending_review_count:pending});
    f.ctx.issues.update=async(id:any,patch:any)=>{f.rows[id].status=patch.status;return f.rows[id];};
    await f.tools.get("review_funding_candidate")({request_id:digest,artifact:{}},f.reviewer);
    expect(f.rows.reviewer.status).toBe(pending?"in_progress":"in_review");expect(f.docs.size).toBe(1);expect(f.wakeups.size).toBe(1);
    if(!pending) await f.tools.get("review_funding_candidate")({request_id:digest,artifact:{}},f.reviewer);
    expect(f.docs.size).toBe(1);
  }
});

it("in-review checkpoint replay keeps native run checks and ordinary draft writes closed",async()=>{
  for(const mutate of [(f:any)=>{f.runs.producer[0].status="succeeded";},(f:any)=>{f.runs.producer[0].id="other";},(f:any)=>{f.agents.author.status="paused";}]) {
    const f=fixture();f.rows.producer.status="in_review";mutate(f);
    await expect(f.tools.get("funding_drafting_checkpoint")({},f.producer)).rejects.toThrow();
    expect(f.seen).toHaveLength(0);expect(f.docs.size).toBe(0);
  }
});
it("in-review reviewer completion injects replay-only from native state, never tool arguments",async()=>{
  for(const status of ["in_progress","in_review"]){
    const f=fixture();f.rows.reviewer.status=status;
    f.bridge.call=async(op:any,params:any,c:any)=>{expect(op).toBe("review");expect(params.replay_only).toBe(status==="in_review");await c.context();return {request_id:digest,state:"supported",pending_review_count:0};};
    await f.tools.get("review_funding_candidate")({request_id:digest,artifact:{}},f.reviewer);
    await expect(f.tools.get("review_funding_candidate")({request_id:digest,artifact:{},replay_only:false},f.reviewer)).rejects.toThrow();
  }
});
it("new authoritative pending request reactivates only the configured reviewer before waking it",async()=>{
  const f=fixture();f.rows.reviewer.status="in_review";
  f.bridge.call=async(_:any,__:any,c:any)=>({results:[await c.review({request_id:digest})],packet:packet(1)});
  f.ctx.issues.requestWakeup=async(id:any)=>{expect(id).toBe("reviewer");expect(f.rows.reviewer.status).toBe("in_progress");return {queued:true};};
  await f.tools.get("save_funding_proposals")({workspace_hash:digest,proposals:[{}]},f.producer);
});
it("pending totals above response batch size still hand off as blocked",async()=>{
  const f=fixture();f.bridge.call=async()=>workspace(101);
  await f.tools.get("funding_drafting_checkpoint")({},f.producer);
  expect(f.rows.producer.status).toBe("blocked");
});
it("large public evidence stays in domain workspace, not duplicated into native checkpoint",async()=>{
  const f=fixture();f.bridge.call=async()=>({workspace_hash:digest,packet:{...packet(),research_evidence:[{evidence_text:"public-source-".repeat(15000)}]}});
  await f.tools.get("funding_drafting_checkpoint")({},f.producer);
  const output=JSON.parse([...f.docs.values()][0].body);
  expect(output.packet.research_evidence).toBeUndefined();expect(output.full_packet_sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(f.rows.producer.status).toBe("in_review");
});
it("oversized saved proposal output has explicit bounded native previews with exact full-packet hash",async()=>{
  const f=fixture();const saved=Array.from({length:100},()=>({request_id:digest,target_key:"answer",value:"draft".repeat(1500),machine_review_state:"pending",human_acceptance:"not_accepted"}));
  f.bridge.call=async()=>({workspace_hash:digest,packet:{...packet(100),saved_candidates:saved}});
  await f.tools.get("funding_drafting_checkpoint")({},f.producer);
  const body=[...f.docs.values()][0].body,output=JSON.parse(body);
  expect(body.length).toBeLessThanOrEqual(524288);expect(output.detail).toBe("bounded_preview");expect(output.full_packet_sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(output.packet.saved_candidates[0].value_truncated).toBe(true);expect(output.packet.saved_candidates[0].value_sha256).toMatch(/^[a-f0-9]{64}$/);
});
it("reviewer reassignment during producer refresh cannot reactivate the replacement's task",async()=>{
  const f=fixture();f.rows.reviewer.status="in_review";
  let checkedTarget=false,changed=false;
  const get=f.ctx.issues.get,subtree=f.ctx.issues.getSubtree;
  f.ctx.issues.get=async(id:string,...args:any[])=>{const row=await get(id,...args);if(id==="reviewer"&&f.docs.size)checkedTarget=true;return row;};
  f.ctx.issues.getSubtree=async(...args:any[])=>{const tree=await subtree(...args);if(checkedTarget&&!changed){f.rows.reviewer.assigneeAgentId="replacement";changed=true;}return tree;};
  f.bridge.call=async(_:any,__:any,c:any)=>({results:[await c.review({request_id:digest})],packet:packet(1)});
  await expect(f.tools.get("save_funding_proposals")({workspace_hash:digest,proposals:[{}]},f.producer)).rejects.toThrow();
  expect(changed).toBe(true);expect(f.rows.reviewer.status).toBe("in_review");expect(f.wakeups.size).toBe(0);
});
it("review begun in progress gains no replay privilege if task changes to in_review during callback",async()=>{
  const f=fixture();f.bridge.call=async(_:any,params:any,c:any)=>{expect(params.replay_only).toBe(false);f.rows.reviewer.status="in_review";return c.context();};
  await expect(f.tools.get("review_funding_candidate")({request_id:digest,artifact:{}},f.reviewer)).rejects.toThrow();
  expect(f.docs.size).toBe(0);expect(f.wakeups.size).toBe(0);
});
it("bounded native previews respect character limit even for JSON-escaped source strings",async()=>{
  const f=fixture(),long="\u0001".repeat(2048);
  const saved=Array.from({length:100},()=>({request_id:digest,target_type:long,target_key:long,value:long,machine_review_state:"pending"}));
  const remaining=Array.from({length:100},()=>({requirement_id:long,owner:long,action:long,next_step:long}));
  f.bridge.call=async()=>({workspace_hash:digest,packet:{...packet(100),saved_candidates:saved,remaining_work:remaining}});
  await f.tools.get("funding_drafting_checkpoint")({},f.producer);
  const body=[...f.docs.values()][0].body;expect(body.length).toBeLessThanOrEqual(524288);
  const output=JSON.parse(body);expect(output.packet.saved_candidate_count).toBe(100);expect(output.packet.remaining_work_count).toBe(100);
});
it("native blocked/in-review reads reacquire checkout inside owner and restore handoff state",async()=>{
  for(const status of ["blocked","in_review"]){
    const f=fixture();f.rows.producer.status=status;
    f.bridge.call=async(_:any,__:any,c:any)=>{expect(f.rows.producer.status).toBe("in_progress");await c.context();return workspace();};
    await f.tools.get("funding_drafting_workspace")({},f.producer);
    expect(f.rows.producer.status).toBe(status);
  }
});
