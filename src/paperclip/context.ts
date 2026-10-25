import type { PluginContext, ToolRunContext } from "@paperclipai/plugin-sdk";
export interface NativeTaskBinding {
  companyId: string;
  projectId: string;
  issueId: string;
  agentId: string;
  authorize: () => Promise<boolean>;
}
const text = (value: unknown) => typeof value === "string" && !!value.trim() && value.length <= 128;
async function admitted(binding: Pick<NativeTaskBinding,"authorize">, signal?: AbortSignal) {
  if (signal?.aborted || !(await binding.authorize()) || signal?.aborted)
    throw Error("Native task disabled or configuration changed");
}
/** Read-only current authority check. Safe after a protected source read; never adopts checkout. */
export async function validateNativeTaskRun(ctx: Pick<PluginContext,"issues">, binding: NativeTaskBinding, run: ToolRunContext, signal?:AbortSignal):Promise<void> {
  const b={...binding},r=structuredClone(run);
  if(![b.companyId,b.projectId,b.issueId,b.agentId,r.runId].every(text) || r.companyId!==b.companyId || r.projectId!==b.projectId || r.agentId!==b.agentId)
    throw Error("Native task actor denied");
  await admitted(b,signal);
  const matches=(row:Awaited<ReturnType<PluginContext["issues"]["get"]>>)=>!!row && row.id===b.issueId && row.companyId===b.companyId && row.projectId===b.projectId && row.assigneeAgentId===b.agentId && ["todo","in_progress","blocked"].includes(row.status);
  if(!matches(await ctx.issues.get(b.issueId,b.companyId)))throw Error("Native task assignment unavailable");
  const tree=await ctx.issues.getSubtree(b.issueId,b.companyId,{includeActiveRuns:true,includeAssignees:true});
  const active=tree.activeRuns?.[b.issueId]?.find(active=>active.id===r.runId),agent=tree.assignees?.[b.agentId];
  if(tree.companyId!==b.companyId || tree.rootIssueId!==b.issueId || !matches(tree.issues.find(i=>i.id===b.issueId)??null) ||
    !active || active.issueId!==b.issueId || active.agentId!==b.agentId || active.status!=="running" || active.finishedAt!==null ||
    !agent || agent.id!==b.agentId || !["idle","running"].includes(agent.status))throw Error("Native task active run binding unavailable");
  await admitted(b,signal);
}
/** Authentication precedes assertCheckoutOwner: checkout may adopt stale ownership. */
export async function assertNativeTaskRun(ctx:Pick<PluginContext,"issues">,binding:NativeTaskBinding,run:ToolRunContext,signal?:AbortSignal):Promise<void> {
  await validateNativeTaskRun(ctx,binding,run,signal);
  await ctx.issues.assertCheckoutOwner({issueId:binding.issueId,companyId:binding.companyId,actorAgentId:run.agentId,actorRunId:run.runId});
  await validateNativeTaskRun(ctx,binding,run,signal);
}
/** Reuses native parent/child ancestry, not a new delegation or permission system. */
export async function resolveNativeDescendantTask(ctx:Pick<PluginContext,"issues">,binding:{companyId:string;projectId:string;rootIssueId:string;allowedAgentIds:string[];authorize:()=>Promise<boolean>},run:ToolRunContext):Promise<string|null> {
  const b=binding;
  if(run.companyId!==b.companyId || run.projectId!==b.projectId || !b.allowedAgentIds.includes(run.agentId) || !text(run.runId))return null;
  await admitted(b);
  const tree=await ctx.issues.getSubtree(b.rootIssueId,b.companyId,{includeRoot:true,includeActiveRuns:true,includeAssignees:true});
  const root=tree.issues.find(i=>i.id===b.rootIssueId);
  if(tree.rootIssueId!==b.rootIssueId || tree.companyId!==b.companyId || tree.issues.length>10000 || new Set(tree.issueIds).size!==tree.issueIds.length ||
    !root || root.companyId!==b.companyId || root.projectId!==b.projectId)throw Error("Native source ancestry unavailable");
  if(["done","cancelled"].includes(root.status))return null;
  const candidates=tree.issues.filter(i=>i.companyId===b.companyId && i.projectId===b.projectId && i.assigneeAgentId===run.agentId && ["todo","in_progress","blocked"].includes(i.status) && tree.issueIds.includes(i.id) &&
    tree.activeRuns?.[i.id]?.some(r=>r.id===run.runId && r.issueId===i.id && r.agentId===run.agentId && r.status==="running" && r.finishedAt===null));
  if(!candidates.length)return null;
  if(candidates.length!==1)throw Error("Native source ancestry ambiguous");
  const agent=tree.assignees?.[run.agentId];
  if(!agent || agent.id!==run.agentId || !["idle","running"].includes(agent.status))throw Error("Native source assignee unavailable");
  const candidate=candidates[0]!,seen=new Set<string>();let current:typeof candidate|undefined=candidate;
  while(current && !seen.has(current.id)) {
    if(current.companyId!==b.companyId || current.projectId!==b.projectId || !tree.issueIds.includes(current.id))throw Error("Native source ancestry unavailable");
    if(current.id===b.rootIssueId){await admitted(b);return candidate.id;}
    seen.add(current.id);current=tree.issues.find(i=>i.id===current!.parentId);
  }
  throw Error("Native source ancestry unavailable");
}
