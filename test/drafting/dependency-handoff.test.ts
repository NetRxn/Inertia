/** Host-boundary qualification only: these tests do not simulate native finalization/admission. */
import { expect, it } from "vitest";
import { fixture } from "./fixture.js";
const hash="a".repeat(64), requestId="b".repeat(64);
const packet=(pending=1)=>({status:"public_machine_reviewed_draft_not_human_accepted",workspace_hash:hash,pending_review_count:pending,draft_candidates:[],remaining_work:[]});
const handoff=()=>({version:"dfw-native-case-handoff-v1",selection_id:"selection",case_key:{applicant_id:"applicant",opportunity_namespace:"public",opportunity_external_id:"one"},semantic_hash:hash,native_run_id:"run-author",workspace_hash:hash,disposition:"awaiting_independent_review",human_acceptance:"not_accepted",submission:"not_submitted",packet_hash:hash});
const envelope=(replayed=false)=>({version:"dfw-native-dependency-checkpoint-v1",handoff:handoff(),replayed,producer_run_frozen:true});
function dependency(){
 const f=fixture(); f.binding.nativeCaseProgression=true; f.binding.nativeDependencyHandoff=true;
 const relations:any={producer:{blockedBy:[{id:"reviewer",status:"in_progress"}],blocks:[]},reviewer:{blockedBy:[],blocks:[{id:"producer",status:"in_progress"}]}};
 const subtree=f.ctx.issues.getSubtree;
 f.ctx.issues.getSubtree=async(...args:any[])=>({...await subtree(...args),issueIds:[args[0]],relations:{[args[0]]:structuredClone(relations[args[0]])}});
 const updates:any[]=[];const update=f.ctx.issues.update;
 f.ctx.issues.update=async(...args:any[])=>{updates.push(structuredClone(args));return update(...args);};
 return {...f,relations,updates};
}
it("requires native progression when dependency opt-in is set",async()=>{
 const f=dependency(); f.binding.nativeCaseProgression=false;
 await expect(f.tools.get("funding_drafting_workspace")({},f.producer)).rejects.toThrow();
 expect(f.seen).toEqual([]);
});
it.each(["missing","reverse","unrelated","unknown"])("fails closed on %s dependency readback without graph edits",async(kind)=>{
 const f=dependency();
 if(kind==="missing")f.relations.producer.blockedBy=[];
 if(kind==="reverse")f.relations.reviewer.blockedBy=[{id:"producer",status:"in_progress"}];
 if(kind==="unrelated")f.relations.producer.blockedBy.push({id:"security-hold",status:"blocked"});
 if(kind==="unknown")delete f.relations.producer.blockedBy;
 await expect(f.tools.get("funding_drafting_workspace")({},f.producer)).rejects.toThrow();
 expect(f.updates).toEqual([]);expect(f.seen).toEqual([]);expect(f.wakeups.size).toBe(0);
});
it("does not revive blocked old producer for workspace or mutation",async()=>{
 const f=dependency();f.rows.producer.status="blocked";
 for(const [tool,args] of [["funding_drafting_workspace",{}],["save_funding_proposals",{workspace_hash:hash,proposals:[{}]}],["save_funding_gap_progress",{workspace_hash:hash,progress:{}}]] as const)
  await expect(f.tools.get(tool)(args,f.producer)).rejects.toThrow();
 expect(f.updates).toEqual([]);expect(f.seen).toEqual([]);
});
it("blocks only after authoritative run freeze, never emits a generic producer wake",async()=>{
 const f=dependency();f.bridge.call=async(op:any,params:any,c:any)=>{expect(op).toBe("checkpoint");expect(params).toEqual({replay_only:false});await c.context();return envelope();};
 expect((await f.tools.get("funding_drafting_checkpoint")({},f.producer)).data).toEqual(handoff());
 expect(f.rows.producer.status).toBe("blocked");expect(f.wakeups.size).toBe(0);expect(f.tools.size).toBe(6);
 expect(f.updates).toHaveLength(1);expect(f.updates[0][1]).toEqual({status:"blocked"});
});
it.each([false,undefined])("rejects a missing authoritative freeze acknowledgement %s",async(frozen)=>{
 const f=dependency();f.bridge.call=async()=>({...envelope(),producer_run_frozen:frozen});
 await expect(f.tools.get("funding_drafting_checkpoint")({},f.producer)).rejects.toThrow();expect(f.updates).toEqual([]);expect(f.docs.size).toBe(0);
});
it("lost blocked acknowledgement replays exact handoff without status reentry or new cycle",async()=>{
 const f=dependency();let calls=0;f.bridge.call=async(_:any,p:any,c:any)=>{await c.context();expect(p.replay_only).toBe(calls>0);return envelope(calls++>0);};
 const update=f.ctx.issues.update;f.ctx.issues.update=async(...args:any[])=>{await update(...args);throw Error("ack lost");};
 await expect(f.tools.get("funding_drafting_checkpoint")({},f.producer)).rejects.toThrow("ack lost");
 expect(f.rows.producer.status).toBe("blocked");
 expect((await f.tools.get("funding_drafting_checkpoint")({},f.producer)).data).toEqual(handoff());
 expect(f.updates).toHaveLength(1);expect(f.docs.size).toBe(1);expect(f.wakeups.size).toBe(0);
});
it("checkpoint replay after native recheckout cannot create another blocked cycle",async()=>{
 const f=dependency();f.bridge.call=async()=>envelope(true);
 expect((await f.tools.get("funding_drafting_checkpoint")({},f.producer)).data).toEqual(handoff());
 expect(f.updates).toEqual([]);expect(f.docs.size).toBe(0);expect(f.wakeups.size).toBe(0);
});
it.each(["supported","rejected"])("finishes review processing for %s without candidate acceptance or producer wake",async(state)=>{
 const f=dependency();f.rows.producer.status="blocked";
 f.bridge.call=async(_:any,__:any,c:any)=>{await c.context();return {request_id:requestId,state,pending_review_count:0};};
 await f.tools.get("review_funding_candidate")({request_id:requestId,artifact:{}},f.reviewer);
 expect(f.rows.reviewer.status).toBe("done");expect(f.wakeups.size).toBe(0);
 expect([...f.docs.values()][0].body).toContain(state);expect([...f.docs.values()][0].title).toContain("not human acceptance");
 await expect(f.tools.get("review_funding_candidate")({request_id:requestId,artifact:{}},f.reviewer)).rejects.toThrow();expect(f.updates).toHaveLength(1);
});
it("multiple pending reviews keep reviewer active and do not prematurely release producer",async()=>{
 const f=dependency();f.bridge.call=async()=>({request_id:requestId,state:"rejected",pending_review_count:2});
 await f.tools.get("review_funding_candidate")({request_id:requestId,artifact:{}},f.reviewer);
 expect(f.rows.reviewer.status).toBe("in_progress");expect(f.wakeups.size).toBe(0);
});
it.each(["running","queued"])("does not reopen done reviewer with prior %s run",async(status)=>{
 const f=dependency();f.rows.reviewer.status="done";f.runs.reviewer[0].status=status;
 f.bridge.call=async(_:any,__:any,c:any)=>({results:[await c.review({request_id:requestId})],packet:packet()});
 await expect(f.tools.get("save_funding_proposals")({workspace_hash:hash,proposals:[{}]},f.producer)).rejects.toThrow(/active|live|run/i);
 expect(f.rows.reviewer.status).toBe("done");expect(f.updates).toEqual([]);expect(f.wakeups.size).toBe(0);
});
it("reopens only idle configured reviewer for a committed pending request and preserves graph",async()=>{
 const f=dependency();f.rows.reviewer.status="done";f.runs.reviewer=[];f.relations.producer.blockedBy.push({id:"other",status:"done"});
 const before=structuredClone(f.relations);
 f.bridge.call=async(_:any,__:any,c:any)=>({results:[await c.review({request_id:requestId})],packet:packet()});
 await f.tools.get("save_funding_proposals")({workspace_hash:hash,proposals:[{}]},f.producer);
 expect(f.rows.reviewer.status).toBe("in_progress");expect(f.wakeups.size).toBe(1);expect(f.relations).toEqual(before);
 expect(f.updates.every(([,patch]:any)=>Object.keys(patch).join() === "status")).toBe(true);
});
it("rechecks reviewer live runs before reopening after intervening native reads",async()=>{
 const f=dependency();f.rows.reviewer.status="done";f.runs.reviewer=[];
 const subtree=f.ctx.issues.getSubtree;let reads=0;
 f.ctx.issues.getSubtree=async(...args:any[])=>{if(args[0]==="reviewer"&&++reads===2)f.runs.reviewer=[{id:"newly-running",issueId:"reviewer",agentId:"critic",status:"running",finishedAt:null}];return subtree(...args);};
 f.bridge.call=async(_:any,__:any,c:any)=>({results:[await c.review({request_id:requestId})],packet:packet()});
 await expect(f.tools.get("save_funding_proposals")({workspace_hash:hash,proposals:[{}]},f.producer)).rejects.toThrow();
 expect(f.rows.reviewer.status).toBe("done");expect(f.wakeups.size).toBe(0);
});
it("native checkout/pause denial remains a hard boundary and sends no domain call",async()=>{
 const f=dependency();f.ctx.issues.assertCheckoutOwner=async()=>{throw Error("native pause/finalization hold");};
 await expect(f.tools.get("funding_drafting_workspace")({},f.producer)).rejects.toThrow("native pause/finalization hold");
 expect(f.seen).toEqual([]);expect(f.updates).toEqual([]);expect(f.wakeups.size).toBe(0);
});
it("blocked transition after checkout cannot authorize a later domain write callback",async()=>{
 const f=dependency(),effects:string[]=[];let calls=0;const checkout=f.ctx.issues.assertCheckoutOwner;
 f.ctx.issues.assertCheckoutOwner=async(...args:any[])=>{const result=await checkout(...args);if(++calls===2)f.rows.producer.status="blocked";return result;};
 f.bridge.call=async(_:any,__:any,c:any)=>{await c.context();effects.push("domain-write");return {};};
 await expect(f.tools.get("funding_drafting_workspace")({},f.producer)).rejects.toThrow();
 expect(effects).toEqual([]);expect(f.updates).toEqual([]);
});
it("new native prerequisite during a domain callback revokes ordinary write authority",async()=>{
 const f=dependency(),effects:string[]=[];
 f.bridge.call=async(_:any,__:any,c:any)=>{f.relations.producer.blockedBy.push({id:"new-hold",status:"blocked"});await c.context();effects.push("domain-write");return {};};
 await expect(f.tools.get("funding_drafting_workspace")({},f.producer)).rejects.toThrow();
 expect(effects).toEqual([]);expect(f.updates).toEqual([]);
});
