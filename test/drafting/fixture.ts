import { registerPublicDrafting } from "../../src/drafting/host.js";
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
      assertCheckoutOwner: async ({issueId}: any) => { events.push("checkout:"+issueId); if(rows[issueId].status!=="in_progress")throw Error("Issue run ownership conflict"); return {}; },
      documents: {
        list: async (id: string) => [...docs.values()].filter(d=>d.issueId===id),
        get: async (id: string, key: string) => docs.get(id+":"+key) ?? null,
        upsert: async (d: any) => { docs.set(d.issueId+":"+d.key,d); return d; },
      },
      update: async (id: string, patch: any) => {Object.assign(rows[id],patch);return rows[id];},
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
