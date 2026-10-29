import test from'node:test';import assert from'node:assert/strict';import{pathToFileURL}from'node:url';
const root=process.env.INERTIA_ROLE_CANDIDATE??'/tmp/inertia-native-role-fixture-20261029/candidate';const d=await import(pathToFileURL(root+'/dist/services/native-runtime/native-discovery-policy.mjs')),c=await import(pathToFileURL(root+'/dist/services/native-runtime/native-case-work-tools.mjs'));
test('normal project routing separates isolated public discovery from existing internal Alpha reconciliation',()=>{
 const ids=Array.from({length:10},(_,i)=>`${(i+1).toString(16).repeat(8)}-1111-4111-8111-111111111111`),[companyId,P,Q,D,rootId,issueId,A,B,C,runId]=ids;
 const policy={version:1,role:'worker',projectIds:[P,Q,D],issueIds:[rootId],portfolioRootIssueId:rootId},binding={companyId,issueId,agentId:A,runId},rootIssue={id:rootId,companyId,projectId:P,status:'blocked'};
 const config={enabled:true,key:'synthetic-scout',organizationId:'synthetic',projectId:D,rootProjectId:P,principalId:'alpha',agentId:A,issueId:rootId,portfolioRootIssueId:rootId,process:{synthetic:true},publicQueries:['public nonprofit grants']};
 const cfg={enabled:true,projectId:Q,researchProjectId:Q,rootIssueId:rootId,rootProjectId:P,researcher:{agentId:A,principalId:'alpha'},producer:{agentId:B,principalId:'beta'},reviewer:{agentId:C,principalId:'charlie'}};
 const actor={id:A,companyId,role:'general',adapterType:'paperclip_runner',status:'running',adapterConfig:{provider:'codex',engine:'cli',disableCommandExecution:true,codexPermissionMode:'never',dangerouslyBypassApprovalsAndSandbox:false,nativeFunding:policy}};
 const context={actor,rootIssue,issue:{id:issueId,companyId,projectId:D,parentId:rootId,status:'in_progress',assigneeAgentId:A,executionRunId:runId,workMode:'standard'},run:{id:runId,companyId,agentId:A,nativeIssueId:issueId,runtimeMode:'native',status:'running'}};
 const rows=[{pluginKey:'netrxn.inertia',status:'ready',companyId,config:{fundingDiscovery:config,nativeCaseWork:cfg}}];
 assert.equal(d.selectNativeDiscoveryAdmission(rows,binding,policy,context,null).role,'scout');
 // Existing normal issue project move; no model-selected trust level or new capability.
 context.issue.projectId=Q;
 assert.equal(d.selectNativeDiscoveryAdmission(rows,binding,policy,context,null),null);
 const internal=c.selectCaseWorkAdmission(rows,binding,policy,null,context,rootIssue,{kind:'enrichment',role:'researcher'});assert.equal(internal.role,'researcher');assert.equal(internal.kind,'case-work');assert.equal(internal.issueId,issueId);
});
