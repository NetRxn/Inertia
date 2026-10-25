import { expect, it } from "vitest";
import { assertNativeTaskRun, resolveNativeDescendantTask } from "../../src/paperclip/context.js";
function fixture() {
  const events: string[] = [];
  let admitted = true;
  const row: any = {id:"task",companyId:"company",projectId:"project",assigneeAgentId:"agent",status:"in_progress"};
  const active: any = {id:"run",issueId:"task",agentId:"agent",status:"running",finishedAt:null};
  const agent: any = {id:"agent",status:"running"};
  const ctx: any = {issues:{
    get: async()=>{events.push("issue");return row;},
    getSubtree: async()=>{events.push("run");return {rootIssueId:"task",companyId:"company",issueIds:["task"],issues:[row],activeRuns:{task:[active]},assignees:{agent}};},
    assertCheckoutOwner:async()=>{events.push("checkout");},
  }};
  const binding={companyId:"company",projectId:"project",issueId:"task",agentId:"agent",authorize:async()=>admitted};
  const run={companyId:"company",projectId:"project",agentId:"agent",runId:"run"};
  return {ctx,binding,run,events,row,active,agent,revoke:()=>{admitted=false;}};
}
it("authenticates exact running native task before a checkout can be adopted",async()=>{
  const f=fixture();await assertNativeTaskRun(f.ctx,f.binding,f.run);
  expect(f.events).toEqual(["issue","run","checkout","issue","run"]);
});
it.each(["company","project","run","agent","stopped","reassigned","paused","done"])("rejects %s identity mismatch before checkout",async mode=>{
  const f=fixture();
  if(mode==="company")f.run.companyId="other";
  if(mode==="project")f.run.projectId="other";
  if(mode==="run")f.run.runId="other";
  if(mode==="agent")f.run.agentId="other";
  if(mode==="stopped")f.active.status="succeeded";
  if(mode==="reassigned")f.row.assigneeAgentId="other";
  if(mode==="paused")f.agent.status="paused";
  if(mode==="done")f.row.status="done";
  await expect(assertNativeTaskRun(f.ctx,f.binding,f.run)).rejects.toThrow();expect(f.events).not.toContain("checkout");
});
it("rechecks admission after native reads and after checkout",async()=>{
  const f=fixture(),read=f.ctx.issues.getSubtree;
  f.ctx.issues.getSubtree=async()=>{const out=await read();f.revoke();return out;};
  await expect(assertNativeTaskRun(f.ctx,f.binding,f.run)).rejects.toThrow();expect(f.events).not.toContain("checkout");
  const g=fixture();g.ctx.issues.assertCheckoutOwner=async()=>g.revoke();
  await expect(assertNativeTaskRun(g.ctx,g.binding,g.run)).rejects.toThrow();
});
it("suppresses protected results if assignment changes while checkout is asserted",async()=>{
 const f=fixture();f.ctx.issues.assertCheckoutOwner=async()=>{f.row.assigneeAgentId="other";};
 await expect(assertNativeTaskRun(f.ctx,f.binding,f.run)).rejects.toThrow();
});
it.each(["paused","missing","wrong-id"])("source ancestry suppresses a %s assignee even when its run still reports running",async mode=>{
 const f=fixture(),read=f.ctx.issues.getSubtree;
 f.ctx.issues.getSubtree=async()=>{const tree=await read();if(mode==="missing")tree.assignees={};else tree.assignees.agent={id:mode==="wrong-id"?"other":"agent",status:mode==="paused"?"paused":"running"};return tree;};
 await expect(resolveNativeDescendantTask(f.ctx,{companyId:"company",projectId:"project",rootIssueId:"task",allowedAgentIds:["agent"],authorize:async()=>true},f.run)).rejects.toThrow();
});
