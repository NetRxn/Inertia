import {afterAll,beforeAll,expect,it} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import type {PluginDatabaseClient} from "@paperclipai/plugin-sdk";
import {BRIDGE_NAMESPACE} from "../../src/store/postgres.js";
import {createRuntimeOwner} from "../../src/bridge/ownership.js";
import {discoveryHash} from "../../src/discovery/service.js";
import {registerPublicDrafting} from "../../src/drafting/host.js";
import {fixture} from "./fixture.js";

let pg:PGlite;
beforeAll(async()=>{pg=new PGlite();await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);await pg.exec(await readFile(new URL("../../migrations/004_runtime_state.sql",import.meta.url),"utf8"));},60000);
afterAll(async()=>pg.close());
function deferred<T=void>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve};}
function execution(f:ReturnType<typeof fixture>,toolName:string,remaining=5000){
 const role=toolName==="funding_review_context"||toolName==="review_funding_candidate"?"reviewer":"producer",run=f[role],startedAt=Date.now()-(120000-remaining);
 return {...run,fundingExecution:{version:1,role,companyId:run.companyId,projectId:run.projectId,agentId:run.agentId,runId:run.runId,issueId:f.binding[role].issueId,toolName:"netrxn.inertia:"+toolName,invocationId:randomUUID(),startedAt,operationDeadlineAt:startedAt+120000,rpcDeadlineAt:startedAt+160000,gatewayDeadlineAt:startedAt+170000}};
}
function nativeFixture(){
 const f=fixture({matchId:randomUUID()}),conflict=deferred();let attempts=0,failRelease=false;
 const db:PluginDatabaseClient={namespace:BRIDGE_NAMESPACE,query:async<T>(q:string,p?:unknown[])=>(await pg.query<T>(q,p)).rows,execute:async(q,p)=>{
  if(q.startsWith("DELETE")&&failRelease)throw Error("Synthetic unknown release result");
  const r=await pg.query(q,p);if(q.startsWith("INSERT")){attempts++;if(r.affectedRows===0)conflict.resolve();}return{rowCount:r.affectedRows??0};
 }};
 const owner=createRuntimeOwner(db,{workerId:randomUUID(),runId:"fixture-plugin-worker"});registerPublicDrafting(f.ctx,[f.binding],owner);
 const scope={companyId:f.binding.companyId,namespaceScope:"inertia:public-drafting",key:discoveryHash([f.binding.projectId,f.binding.applicantSlug,f.binding.matchId])};
 return {...f,owner,scope,conflict,attempts:()=>attempts,failRelease:()=>{failRelease=true;}};
}
async function hold(f:ReturnType<typeof nativeFixture>){const entered=deferred(),release=deferred();const pending=f.owner.own(f.scope,async()=>{entered.resolve();await release.promise;return "holder complete";});await entered.promise;return{release:()=>release.resolve(),pending};}
const packet={status:"public_machine_reviewed_draft_not_human_accepted",workspace_hash:"a".repeat(64),pending_review_count:1,draft_candidates:[],remaining_work:[]};

it("waits for producer ownership release when the review callback wakes the reviewer before producer completion",async()=>{
 const f=nativeFixture(),calls:string[]=[],request={request_id:"b".repeat(64),candidate:{text:"public"}};let reviewer:Promise<any>|undefined,reviewDeadline:number|undefined;
 f.bridge.call=async(op:string,_:any,c:any)=>{calls.push(op);await c.context();if(op==="save"){await c.review(request);return{packet};}reviewDeadline=c.operationDeadlineAt;return{requests:[]};};
 const reviewerRun=execution(f,"funding_review_context");
 f.ctx.issues.requestWakeup=async()=>{
  reviewer=f.tools.get("funding_review_context")({},reviewerRun).then((data:any)=>({data}),(error:any)=>({error}));
  await f.conflict.promise;expect(calls).toEqual(["save"]);expect(f.events).not.toContain("checkout:reviewer");return{queued:true,runId:f.reviewer.runId};
 };
 await f.tools.get("save_funding_proposals")({workspace_hash:"a".repeat(64),proposals:[{}]},execution(f,"save_funding_proposals"));
 const completed=await reviewer;expect(completed.error).toBeUndefined();expect(completed.data.data).toEqual({requests:[]});expect(calls).toEqual(["save","review_context"]);
 expect(reviewDeadline).toBe(reviewerRun.fundingExecution.operationDeadlineAt);expect(await f.owner.inspect(f.scope)).toBeNull();
});

it("waits for reviewer release when completion wakes producer workspace before the reviewer lifecycle write",async()=>{
 const f=nativeFixture(),calls:string[]=[];let producer:Promise<any>|undefined;
 f.bridge.call=async(op:string,_:any,c:any)=>{calls.push(op);await c.context();return op==="review"?{request_id:"c".repeat(64),state:"supported",pending_review_count:0}:{workspace_hash:"a".repeat(64)};};
 f.ctx.issues.requestWakeup=async()=>{producer=f.tools.get("funding_drafting_workspace")({},execution(f,"funding_drafting_workspace")).then((data:any)=>({data}),(error:any)=>({error}));await f.conflict.promise;expect(calls).toEqual(["review"]);expect(f.events).not.toContain("checkout:producer");return{queued:true,runId:f.producer.runId};};
 await f.tools.get("review_funding_candidate")({request_id:"c".repeat(64),artifact:{}},execution(f,"review_funding_candidate"));
 const completed=await producer;expect(completed.error).toBeUndefined();expect(completed.data.data.workspace_hash).toBe("a".repeat(64));expect(calls).toEqual(["review","workspace"]);expect(f.rows.reviewer.status).toBe("in_review");expect(await f.owner.inspect(f.scope)).toBeNull();
});

it("expires waiting for admission without checkout, bridge invocation, or alteration of the held owner",async()=>{
 const f=nativeFixture(),holder=await hold(f),before=await f.owner.inspect(f.scope);let calls=0;f.bridge.call=async()=>{calls++;return{};};
 try{const error=await f.tools.get("funding_review_context")({},execution(f,"funding_review_context",150)).catch((e:any)=>e);expect(error.message).toMatch(/deadline|expired/i);expect(calls).toBe(0);expect(f.events.some(e=>e.startsWith("checkout:"))).toBe(false);expect(f.docs.size).toBe(0);expect(f.wakeups.size).toBe(0);expect(await f.owner.inspect(f.scope)).toEqual(before);}finally{holder.release();await holder.pending;}
});

for(const change of ["configuration","run"] as const)it("revalidates fresh "+change+" authority before another ownership acquisition attempt",async()=>{
 const f=nativeFixture(),holder=await hold(f);let calls=0;f.bridge.call=async()=>{calls++;return{};};
 const waiting=f.tools.get("funding_review_context")({},execution(f,"funding_review_context")).catch((e:any)=>e);
 try{await f.conflict.promise;if(change==="configuration")f.revoke();else f.runs.reviewer[0].status="cancelled";holder.release();await holder.pending;const error=await waiting;expect(error.message).toMatch(/disabled|configuration|binding|active run/i);expect(f.attempts()).toBe(2);expect(calls).toBe(0);expect(f.events.some(e=>e.startsWith("checkout:"))).toBe(false);expect(await f.owner.inspect(f.scope)).toBeNull();}finally{holder.release();await holder.pending;}
});

it("keeps the immediate busy result for an ordinary call without trusted execution metadata",async()=>{
 const f=nativeFixture(),holder=await hold(f),before=await f.owner.inspect(f.scope);
 try{await expect(f.tools.get("funding_review_context")({},f.reviewer)).rejects.toThrow(/already owned/);expect(f.attempts()).toBe(2);expect(f.seen).toHaveLength(0);expect(await f.owner.inspect(f.scope)).toEqual(before);}finally{holder.release();await holder.pending;}
});

it("does not replay work that returned null after callback entry",async()=>{
 const f=nativeFixture();let calls=0;f.bridge.call=async()=>{calls++;return null;};
 const error=await f.tools.get("funding_drafting_workspace")({},execution(f,"funding_drafting_workspace",400)).catch((e:any)=>e);
 expect(error).toBeInstanceOf(Error);expect(error.message).toMatch(/outcome unconfirmed.*reconcile/i);expect(error.message).not.toMatch(/already owned|retry later/i);
 expect(calls).toBe(1);expect(f.attempts()).toBe(1);expect(await f.owner.inspect(f.scope)).toBeNull();
});

it("preserves the legacy busy wording for null work output without trusted metadata",async()=>{
 const f=nativeFixture();let calls=0;f.bridge.call=async()=>{calls++;return null;};
 await expect(f.tools.get("funding_drafting_workspace")({},f.producer)).rejects.toThrow(/already owned; retry later/);expect(calls).toBe(1);expect(f.attempts()).toBe(1);expect(await f.owner.inspect(f.scope)).toBeNull();
});

it("does not retry a private operation error after work started",async()=>{
 const f=nativeFixture();let calls=0;f.bridge.call=async()=>{calls++;throw Error("Synthetic write outcome unknown");};
 await expect(f.tools.get("funding_drafting_workspace")({},execution(f,"funding_drafting_workspace"))).rejects.toThrow(/write outcome unknown/);expect(calls).toBe(1);expect(f.attempts()).toBe(1);expect(await f.owner.inspect(f.scope)).toBeNull();
});

it("does not retry an ownership acquisition error before callback entry",async()=>{
 const f=fixture();let attempts=0;registerPublicDrafting(f.ctx,[f.binding],{own:async()=>{attempts++;throw Error("Native ownership unavailable.");}});
 await expect(f.tools.get("funding_drafting_workspace")({},execution(f,"funding_drafting_workspace"))).rejects.toThrow(/ownership unavailable/);expect(attempts).toBe(1);expect(f.seen).toHaveLength(0);
});

it("never retries or removes an owner when release of completed work is unconfirmed",async()=>{
 const f=nativeFixture();let calls=0;f.bridge.call=async()=>{calls++;f.failRelease();return{};};
 try{await expect(f.tools.get("funding_drafting_workspace")({},execution(f,"funding_drafting_workspace"))).rejects.toThrow(/release unconfirmed/);expect(calls).toBe(1);expect(f.attempts()).toBe(1);expect(await f.owner.inspect(f.scope)).not.toBeNull();}
 finally{await pg.query(`DELETE FROM "${BRIDGE_NAMESPACE}".bridge_runtime WHERE company_id=$1 AND relay=$2 AND state_key=$3`,[f.scope.companyId,f.scope.namespaceScope,"exclusive-owner:"+f.scope.key]);}
});

for(const tool of ["funding_drafting_workspace","save_funding_proposals","save_funding_gap_progress","funding_drafting_checkpoint","funding_review_context","review_funding_candidate"])it("uses admission-only waiting for the exact qualified tool "+tool,async()=>{
 const f=fixture();let attempts=0,calls=0;
 registerPublicDrafting(f.ctx,[f.binding],{own:async<T>(_:any,work:()=>Promise<T>)=>++attempts===1?null:work()});
 f.bridge.call=async(op:string,_:any,c:any)=>{calls++;await c.context();return op==="review"?{request_id:"d".repeat(64),state:"supported",pending_review_count:0}:{workspace_hash:"a".repeat(64),packet};};
 const params=tool==="save_funding_proposals"?{workspace_hash:"a".repeat(64),proposals:[{}]}:tool==="save_funding_gap_progress"?{workspace_hash:"a".repeat(64),progress:{}}:tool==="review_funding_candidate"?{request_id:"d".repeat(64),artifact:{}}:{};
 await expect(f.tools.get(tool)(params,execution(f,tool))).resolves.toHaveProperty("data");expect(attempts).toBe(2);expect(calls).toBe(1);
});
