/** Shared normal issue follow-up admission; callers supply current server-derived facts. */
export function issueResumeAdmission({issue,actor,resumeIntent,lowTrust=false,pauseHold,dependencyReadiness,canManage=false,mutationDecision}){
 const deny=(status,error,details)=>({status,error,...(details?{details}:{})});
 if(lowTrust)return deny(403,'Low-trust actors cannot use this control-plane surface');
 if(issue.status==='cancelled'&&resumeIntent!==true)return deny(409,'Cancelled issues must be restored through the dedicated restore flow',{issueId:issue.id,status:issue.status});
 if(!['done','cancelled','blocked','todo','in_progress'].includes(issue.status))return deny(409,'Issue is not resumable through comment follow-up intent',{issueId:issue.id,status:issue.status});
 if(pauseHold)return deny(409,'Issue follow-up blocked by active subtree pause hold',{issueId:issue.id,holdId:pauseHold.holdId,rootIssueId:pauseHold.rootIssueId,mode:pauseHold.mode});
 if(issue.status==='blocked'&&dependencyReadiness?.unresolvedBlockerCount>0)return deny(409,'Issue follow-up blocked by unresolved blockers',{issueId:issue.id,unresolvedBlockerIssueIds:dependencyReadiness.unresolvedBlockerIssueIds});
 if(actor.type!=='agent')return null;
 if(!actor.agentId)return deny(403,'Agent authentication required');
 if(!issue.assigneeAgentId)return deny(409,'Issue follow-up requires an assigned agent',{issueId:issue.id,actorAgentId:actor.agentId});
 if(issue.assigneeAgentId===actor.agentId||canManage||mutationDecision?.reason==='allow_visible_issue_write')return null;
 return deny(403,"Agent cannot request follow-up for another agent's issue",{issueId:issue.id,assigneeAgentId:issue.assigneeAgentId,actorAgentId:actor.agentId});
}
