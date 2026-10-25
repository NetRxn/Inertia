import { expect, it } from "vitest";
import { registerPublicDrafting, publicDraftingTools } from "../../src/drafting/host.js";

export function fixture() {
  const tools = new Map<string, any>(), docs = new Map<string, any>();
  const wakeups = new Map<string, any>(), events: string[] = [];
  let current = true;
  const rows: any = {
    producer: { id:"producer", companyId:"company", projectId:"project", assigneeAgentId:"author", status:"in_progress" },
    reviewer: { id:"reviewer", companyId:"company", projectId:"project", assigneeAgentId:"critic", status:"in_progress" },
  };
  const runs: any = {
    producer: [{id:"run-author", issueId:"producer", agentId:"author", status:"running", finishedAt:null}],
    reviewer: [{id:"run-critic", issueId:"reviewer", agentId:"critic", status:"running", finishedAt:null}],
  };
  const agents: any = {author:{id:"author",status:"running"},critic:{id:"critic",status:"running"}};
  const ctx: any = {
    tools: { register: (name: string, _: any, fn: any) => tools.set(name,fn) },
    issues: {
      get: async (id: string) => { events.push("get:"+id); return rows[id] ?? null; },
      getSubtree: async (id: string, companyId: string) => { events.push("runs:"+id); return {rootIssueId:id,companyId,issues:[rows[id]],activeRuns:{[id]:runs[id]},assignees:agents}; },
      assertCheckoutOwner: async ({issueId}: any) => { events.push("checkout:"+issueId); return {}; },
      documents: {
        list: async (id: string) => [...docs.values()].filter(d=>d.issueId===id),
        get: async (id: string, key: string) => docs.get(id+":"+key) ?? null,
        upsert: async (d: any) => { docs.set(d.issueId+":"+d.key,d); return d; },
      },
      requestWakeup: async (id: string, companyId: string, options: any) => {wakeups.set(options.idempotencyKey,{id,companyId,...options});return {queued:true,runId:null};},
    },
  };
  const seen: any[] = [];
  const bridge: any = { call: async (op: string, params: any, callbacks: any) => {seen.push({op,params,context:await callbacks.context()});return {workspace_hash:"a".repeat(64)};} };
  const binding: any = {enabled:true,companyId:"company",projectId:"project",applicantSlug:"dao",matchId:"match", producer:{issueId:"producer",agentId:"author",principalId:"producer-principal"},reviewer:{issueId:"reviewer",agentId:"critic",principalId:"reviewer-principal"},authorize:async()=>current,bridge};
  const owner: any = { own: async (_:any,work:any)=>work() };
  registerPublicDrafting(ctx,[binding],owner);
  const producer = {companyId:"company",projectId:"project",agentId:"author",runId:"run-author"};
  const reviewer = {...producer,agentId:"critic",runId:"run-critic"};
  return {ctx,tools,docs,wakeups,events,rows,runs,agents,bridge,binding,seen,producer,reviewer,revoke:()=>{current=false;}};
}
it("registers only three public operations and reviewer completion; scope is separate from args",async()=>{
  const f=fixture();
  expect([...f.tools.keys()]).toEqual(publicDraftingTools.map(t=>t.name));
  await f.tools.get("funding_drafting_workspace")({},f.producer);
  expect(f.seen[0]).toEqual({op:"workspace",params:{},context:{company_id:"company",applicant_slug:"dao",match_id:"match",principal_id:"producer-principal",run_id:"run-author",role:"producer"}});
  expect(f.events.indexOf("runs:producer")).toBeLessThan(f.events.indexOf("checkout:producer"));
});
it("rejects identity arguments and role spoofing before bridge I/O",async()=>{
  const f=fixture();
  for(const field of ["company_id","principal_id","run_id","role","issueId","applicant_slug","database_url"])
    await expect(f.tools.get("funding_drafting_workspace")({[field]:"forged"},f.producer)).rejects.toThrow();
  await expect(f.tools.get("funding_drafting_workspace")({},f.reviewer)).rejects.toThrow();
  await expect(f.tools.get("review_funding_candidate")({request_id:"a".repeat(64),artifact:{}},f.producer)).rejects.toThrow();
  expect(f.seen).toHaveLength(0);
});
it("rejects wrong company/project/run, stale and reassigned native issue before checkout adoption",async()=>{
  for(const change of [
    (f:any)=>({...f.producer,companyId:"other"}),
    (f:any)=>({...f.producer,projectId:"other"}),
    (f:any)=>({...f.producer,runId:"stale"}),
    (f:any)=>{f.runs.producer[0].status="queued";return f.producer;},
    (f:any)=>{f.runs.producer[0].issueId="other";return f.producer;},
    (f:any)=>{f.rows.producer.assigneeAgentId="other";return f.producer;},
    (f:any)=>{f.rows.producer.status="done";return f.producer;},
    (f:any)=>{f.agents.author.status="paused";return f.producer;},
    (f:any)=>{f.revoke();return f.producer;},
  ]) {const f=fixture();await expect(f.tools.get("funding_drafting_workspace")({},change(f))).rejects.toThrow();expect(f.events.some(e=>e.startsWith("checkout:"))).toBe(false);expect(f.seen).toHaveLength(0);}
});
it("refreshes native context at every synchronous child callback",async()=>{
  const f=fixture();
  f.bridge.call=async (_:any,__:any,c:any)=>{await c.context();f.rows.producer.assigneeAgentId="replacement";return c.context();};
  await expect(f.tools.get("funding_drafting_workspace")({},f.producer)).rejects.toThrow(/binding|actor|assignment/i);
});
it("persists public native request and replays wakeup with stable request id, never reviewer identity",async()=>{
  const f=fixture(),request={request_id:"b".repeat(64),candidate:{text:"public evidence"}};
  f.bridge.call=async (_:any,__:any,c:any)=>c.review(request);
  for(let i=0;i<2;i++) expect((await f.tools.get("save_funding_proposals")({workspace_hash:"a".repeat(64),proposals:[{}]},f.producer)).data).toEqual({state:"pending",request_id:request.request_id});
  expect(f.docs.size).toBe(1);expect(f.wakeups.size).toBe(1);expect(f.wakeups.get(request.request_id).id).toBe("reviewer");
  const body=[...f.docs.values()][0].body;expect(body).toContain("public evidence");expect(body).not.toContain("producer-principal");
});
it("only authenticated reviewer completion wakes producer with a stable key",async()=>{
  const f=fixture(),request_id="c".repeat(64);
  f.bridge.call=async (_:any,__:any,c:any)=>{expect((await c.context()).role).toBe("reviewer");return {request_id,state:"supported"};};
  for(let i=0;i<2;i++) await f.tools.get("review_funding_candidate")({request_id,artifact:{}},f.reviewer);
  expect(f.wakeups.size).toBe(1);expect([...f.wakeups.values()][0].id).toBe("producer");
});
it("does not dispatch or wake after revocation, wrong target assignment, or failed authoritative completion",async()=>{
  const f=fixture();f.bridge.call=async (_:any,__:any,c:any)=>{f.revoke();return c.review({request_id:"a".repeat(64)});};
  await expect(f.tools.get("save_funding_proposals")({workspace_hash:"a".repeat(64),proposals:[{}]},f.producer)).rejects.toThrow();expect(f.docs.size).toBe(0);expect(f.wakeups.size).toBe(0);
  const g=fixture();g.bridge.call=async()=>({request_id:"wrong",state:"supported"});
  await expect(g.tools.get("review_funding_candidate")({request_id:"a".repeat(64),artifact:{}},g.reviewer)).rejects.toThrow();expect(g.wakeups.size).toBe(0);
});
it("rejects revoked configuration during native reads before claiming checkout",async()=>{
  const f=fixture(),read=f.ctx.issues.getSubtree;
  f.ctx.issues.getSubtree=async(...args:any[])=>{const tree=await read(...args);f.revoke();return tree;};
  await expect(f.tools.get("funding_drafting_workspace")({},f.producer)).rejects.toThrow();
  expect(f.events.some(e=>e.startsWith("checkout:"))).toBe(false);
});
it("fails closed on checkout denial and reviewer target reassignment",async()=>{
  const f=fixture();f.ctx.issues.assertCheckoutOwner=async()=>{throw Error("Other active run owns checkout");};
  await expect(f.tools.get("funding_drafting_workspace")({},f.producer)).rejects.toThrow(/checkout/);expect(f.seen).toHaveLength(0);
  const g=fixture();g.rows.reviewer.assigneeAgentId="replacement";g.bridge.call=async (_:any,__:any,c:any)=>c.review({request_id:"a".repeat(64)});
  await expect(g.tools.get("save_funding_proposals")({workspace_hash:"a".repeat(64),proposals:[{}]},g.producer)).rejects.toThrow();expect(g.docs.size).toBe(0);expect(g.wakeups.size).toBe(0);
});
