import type {PluginContext,ToolRunContext} from "@paperclipai/plugin-sdk";
import {resolveNativeDescendantTask,validateNativeTaskRun} from "../paperclip/context.js";
import type {DiscoveryBinding} from "./host.js";
/** Native scope projection only. No grants, checkout, status or wake. */
export async function discoveryPortfolioBinding(ctx:Pick<PluginContext,"issues">,b:DiscoveryBinding,run:ToolRunContext,role:"scout"|"diligence"):Promise<DiscoveryBinding>{
 if(!b.portfolioRootIssueId)return b;
 const rootIssueId=b.portfolioRootIssueId,agentId=role==="scout"?b.agentId:b.diligence?.agentId;
 if(!agentId||typeof rootIssueId!=="string"||!rootIssueId.trim())throw Error("Native discovery portfolio template unavailable");
 const resolve=async()=>{
  const issueId=await resolveNativeDescendantTask(ctx,{companyId:b.companyId,projectId:b.projectId,rootIssueId,...(b.rootProjectId?{rootProjectId:b.rootProjectId}:{}),allowedAgentIds:[agentId],authorize:async()=>b.enabled===true&&(!b.authorize||await b.authorize())},run);
  const row=issueId?await ctx.issues.get(issueId,b.companyId):null;
  if(!row||row.parentId!==rootIssueId||row.id===rootIssueId||row.executionRunId!==run.runId||row.status!=="in_progress"||(row.checkoutRunId!=null&&row.checkoutRunId!==run.runId))throw Error("Native discovery portfolio child unavailable");
  await validateNativeTaskRun(ctx,{companyId:b.companyId,projectId:b.projectId,issueId:row.id,agentId,authorize:async()=>b.enabled===true&&(!b.authorize||await b.authorize())},run);
  return row.id;
 };
 const issueId=await resolve();
 return {...b,issueId,...(b.diligence?{diligence:{...b.diligence,issueId}}:{}),authorize:async()=>{if(await resolve()!==issueId)throw Error("Native discovery portfolio changed");return true;}};
}
