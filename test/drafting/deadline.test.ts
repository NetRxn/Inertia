import {expect,it} from "vitest";
import {randomUUID} from "node:crypto";
import {registerPublicDrafting} from "../../src/drafting/host.js";
import {fixture} from "./fixture.js";

function execution(f:ReturnType<typeof fixture>,toolName="funding_drafting_workspace",remaining=120000) {
  const role=toolName==="review_funding_candidate"||toolName==="funding_review_context"?"reviewer":"producer";
  const run=role==="producer"?f.producer:f.reviewer;
  const startedAt=Date.now()-(120000-remaining);
  return {version:1,role,companyId:run.companyId,projectId:run.projectId,agentId:run.agentId,runId:run.runId,
    issueId:f.binding[role].issueId,toolName:"netrxn.inertia:"+toolName,invocationId:randomUUID(),startedAt,
    operationDeadlineAt:startedAt+120000,rpcDeadlineAt:startedAt+160000,gatewayDeadlineAt:startedAt+170000};
}

it("propagates the exact trusted operation deadline without leaking execution metadata into model parameters",async()=>{
  const f=fixture(),fundingExecution=execution(f);let captured:any;
  f.bridge.call=async (_:any,params:any,callbacks:any)=>{captured=callbacks.operationDeadlineAt;expect(params).toEqual({});await callbacks.context();return {};};
  await f.tools.get("funding_drafting_workspace")({}, {...f.producer,fundingExecution});
  expect(captured).toBe(fundingExecution.operationDeadlineAt);
  expect(f.binding).not.toHaveProperty("fundingExecution");
});

it("rejects forged, malformed, expired or incorrectly budgeted metadata before native preflight",async()=>{
  const changes=[{version:2},{role:"reviewer"},{companyId:"other"},{projectId:"other"},{agentId:"other"},
    {runId:"other"},{issueId:"other"},{toolName:"netrxn.inertia:save_funding_proposals"},{invocationId:"not-a-uuid"},
    {operationDeadlineAt:Date.now()+240000},{rpcDeadlineAt:Date.now()+159000},{gatewayDeadlineAt:Date.now()+171000},
    {startedAt:Date.now()+100000},{extra:true}];
  for(const change of changes) {
    const f=fixture();
    await expect(f.tools.get("funding_drafting_workspace")({}, {...f.producer,fundingExecution:{...execution(f),...change}})).rejects.toThrow(/funding.*execution|deadline/i);
    expect(f.events).toEqual([]);expect(f.seen).toEqual([]);
  }
  for(const fundingExecution of [null,"metadata",[],{...execution(fixture(),"funding_drafting_workspace",-1)}]) {
    const f=fixture();await expect(f.tools.get("funding_drafting_workspace")({}, {...f.producer,fundingExecution})).rejects.toThrow(/funding.*execution|deadline/i);
    expect(f.events).toEqual([]);
  }
});

it("never accepts host deadline metadata as model arguments and keeps absent metadata compatible",async()=>{
  const f=fixture();
  await expect(f.tools.get("funding_drafting_workspace")({fundingExecution:execution(f)},f.producer)).rejects.toThrow(/parameters/);
  await expect(f.tools.get("funding_drafting_workspace")({},f.producer)).resolves.toHaveProperty("data");
});

it("never extends the six-tool deadline contract to the optional gap-review tool",async()=>{
  const f=fixture({nativeCaseProgression:true,nativeDependencyHandoff:true,nativeGapPlanReview:true});
  const fundingExecution={...execution(f,"funding_review_context"),toolName:"netrxn.inertia:review_funding_gap_plan"};
  await expect(f.tools.get("review_funding_gap_plan")({operation:"context"},{...f.reviewer,fundingExecution})).rejects.toThrow(/funding.*execution|deadline/i);
  expect(f.events).toEqual([]);
});

it("expires during native preflight without checkout, child invocation or lifecycle writes",async()=>{
  const f=fixture(),fundingExecution=execution(f,"funding_drafting_workspace",150);
  const get=f.ctx.issues.get;let updates=0;
  f.ctx.issues.get=async(...args:any[])=>{await new Promise(r=>setTimeout(r,200));return get(...args);};
  f.ctx.issues.update=async()=>{updates++;throw Error("No lifecycle write allowed");};
  await expect(f.tools.get("funding_drafting_workspace")({}, {...f.producer,fundingExecution})).rejects.toThrow(/deadline|expired/i);
  expect(f.events.some(e=>e.startsWith("checkout:"))).toBe(false);expect(f.seen).toEqual([]);expect(updates).toBe(0);
});

it("holds durable ownership through a late committed native snapshot and reports uncertainty without a following wake",async()=>{
  const f=fixture(),fundingExecution=execution(f,"review_funding_candidate",300);
  let release!:()=>void,entered!:()=>void,held=false,settled=false;
  const gate=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{entered=r;});
  const owner:any={own:async(_:any,work:any)=>{held=true;try{return await work();}finally{held=false;}}};
  registerPublicDrafting(f.ctx,[f.binding],owner);
  f.bridge.call=async()=>({request_id:"a".repeat(64),state:"supported",pending_review_count:0});
  const upsert=f.ctx.issues.documents.upsert;
  f.ctx.issues.documents.upsert=async(d:any)=>{entered();await gate;return upsert(d);};
  const pending=f.tools.get("review_funding_candidate")({request_id:"a".repeat(64),artifact:{}},{...f.reviewer,fundingExecution}).then(
    ()=>{settled=true;return null;},(e:any)=>{settled=true;return e;});
  await started;await new Promise(r=>setTimeout(r,400));
  try{expect(held).toBe(true);expect(settled).toBe(false);}finally{release();}
  const error=await pending;expect(error).toBeInstanceOf(Error);expect(error.message).toMatch(/outcome unconfirmed/);
  expect(f.docs.size).toBe(1);expect(f.wakeups.size).toBe(0);expect(held).toBe(false);
});

it("expires during snapshot preparation before native upsert or following lifecycle writes",async()=>{
  const f=fixture(),fundingExecution=execution(f,"review_funding_candidate",150);let writes=0;
  f.bridge.call=async()=>({request_id:"a".repeat(64),state:"supported",pending_review_count:0});
  const list=f.ctx.issues.documents.list;
  f.ctx.issues.documents.list=async(...args:any[])=>{await new Promise(r=>setTimeout(r,200));return list(...args);};
  f.ctx.issues.update=async()=>{writes++;throw Error("No lifecycle write allowed");};
  await expect(f.tools.get("review_funding_candidate")({request_id:"a".repeat(64),artifact:{}},{...f.reviewer,fundingExecution})).rejects.toThrow(/outcome unconfirmed/);
  expect(f.docs.size).toBe(0);expect(f.wakeups.size).toBe(0);expect(writes).toBe(0);
});
