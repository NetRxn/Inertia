import type { PluginContext } from '@paperclipai/plugin-sdk';
import type { ContributionBinding, NativeObservation } from './contracts.js';
import { contributionHash } from './artifacts.js';
type Issue = NonNullable<Awaited<ReturnType<PluginContext['issues']['get']>>>;
export type NativeScope = Pick<ContributionBinding,'companyId'|'projectId'|'issueId'|'agentId'>;
/** Conservative native revision: any native issue change invalidates prior work. */
export function nativeTaskRevision(issue: Issue): string {
  return contributionHash(JSON.stringify([issue.id,issue.companyId,issue.projectId,issue.title,issue.description,issue.status,issue.assigneeAgentId,issue.checkoutRunId,issue.executionRunId,issue.updatedAt]));
}
/** Concrete pinned SDK projection. Never expose this privileged client to members. */
export function createNativeContributionReader(ctx: Pick<PluginContext,'issues'|'agents'>, configured: NativeScope) {
  const {companyId,projectId,issueId,agentId}=configured;
  const scope={companyId,projectId,issueId,agentId};
  return async (b: ContributionBinding): Promise<NativeObservation|null> => {
    if (Object.entries(scope).some(([key,value])=>b[key as keyof NativeScope]!==value)) return null;
    const issue=await ctx.issues.get(scope.issueId,scope.companyId);
    if (!issue || issue.id!==scope.issueId || issue.companyId!==scope.companyId || issue.projectId!==scope.projectId || issue.assigneeAgentId!==scope.agentId ||
      issue.status!=='in_progress' || issue.checkoutRunId!==b.checkoutRunId || issue.executionRunId!==b.runId) return null;
    const agent=await ctx.agents.get(scope.agentId,scope.companyId);
    if (!agent || agent.id!==scope.agentId || agent.companyId!==scope.companyId || !['idle','running'].includes(agent.status)) return null;
    const summary=await ctx.issues.summaries.getOrchestration({issueId:scope.issueId,companyId:scope.companyId,includeSubtree:false});
    const run=summary.runs.find(r=>r.id===b.runId && r.agentId===scope.agentId && r.issueId===scope.issueId && r.status==='running' && !r.finishedAt);
    if (summary.issueId!==scope.issueId || summary.companyId!==scope.companyId || !run) return null;
    return {companyId:scope.companyId,projectId:scope.projectId,issueId:scope.issueId,taskRevision:nativeTaskRevision(issue),agentId:scope.agentId,runId:run.id,checkoutRunId:issue.checkoutRunId,running:true};
  };
}
