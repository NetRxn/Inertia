/** Protected direct-child native scope. Task text never supplies routing authority. */
export function scopeForIssue(scope,issue){
 if(!scope||issue?.companyId!==scope.companyId)return null;
 if(scope.portfolioRootIssueId!==undefined){
  if(issue.projectId!==scope.projectId)return null;
  if(scope.portfolioRootIssueId!==scope.issueId||issue.parentId!==scope.portfolioRootIssueId||issue.id===scope.issueId)return null;
  return {...scope,issueId:issue.id};
 }
 return issue.id===scope.issueId?scope:null;
}
export function templateMatches(scope,template){
 return scope&&template&&Object.keys(template).every(k=>k==='issueId'&&template.portfolioRootIssueId!==undefined
  ?typeof scope.issueId==='string'&&scope.issueId!==template.portfolioRootIssueId:scope[k]===template[k]);
}
