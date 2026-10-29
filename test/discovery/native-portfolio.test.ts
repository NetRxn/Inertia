import{expect,it}from'vitest';
import{discoveryPortfolioBinding}from'../../src/discovery/native-portfolio.js';
for(const role of['scout','diligence']as const)it('dynamic '+role+' reads exact direct source child with distinct mapped actor and no checkout',async()=>{
 const root:any={id:'root',companyId:'company',projectId:'funding',status:'in_progress'},agent=role==='scout'?'alpha':'beta',child:any={id:'child',parentId:'root',companyId:'company',projectId:'sources',assigneeAgentId:agent,status:'in_progress',executionRunId:'run'};
 const run:any={companyId:'company',projectId:'sources',agentId:agent,runId:'run'};
 const b:any={enabled:true,companyId:'company',projectId:'sources',rootProjectId:'funding',issueId:'root',portfolioRootIssueId:'root',agentId:'alpha',diligence:{issueId:'root',agentId:'beta'},authorize:async()=>true};
 const ctx:any={issues:{get:async(id:string)=>id==='root'?root:child,getSubtree:async(id:string)=>({companyId:'company',rootIssueId:id,issueIds:id==='root'?['root','child']:['child'],issues:id==='root'?[root,child]:[child],activeRuns:{child:[{id:'run',issueId:'child',agentId:agent,status:'running',finishedAt:null}]},assignees:{[agent]:{id:agent,status:'running'}}}),assertCheckoutOwner:async()=>{throw Error('No checkout mutation');}}};
 const current=await discoveryPortfolioBinding(ctx,b,run,role);expect(current.issueId).toBe('child');expect(current.diligence?.issueId).toBe('child');
 child.parentId='foreign';await expect(current.authorize!()).rejects.toThrow();child.parentId='root';root.hiddenAt='withdrawn';await expect(discoveryPortfolioBinding(ctx,b,run,role)).rejects.toThrow();
});
