import test from 'node:test';import assert from 'node:assert/strict';
import * as m from '../transport/native/native-portfolio-funding-policy.mjs';
const company='11111111-1111-4111-8111-111111111111',agent='22222222-2222-4222-8222-222222222222',root='33333333-3333-4333-8333-333333333333',project='44444444-4444-4444-8444-444444444444',child='55555555-5555-4555-8555-555555555555';
const config={provider:'codex',engine:'cli',disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never',nativeFunding:{version:1,role:'worker',projectIds:[project],issueIds:[root],portfolioRootIssueId:root}};
test('worker role derives from trusted native review while scope stays the configured direct child',()=>{
 const policy=m.normalizeNativeFundingPolicy(config);
 for(const review of [false,true]){
  const binding={companyId:company,agentId:agent,issueId:child,runId:'run',...(review?{nativeReview:{nativeReviewInteractionId:'review'}}:{}),nativeFundingPolicy:{...policy,role:review?'reviewer':'producer',companyId:company,agentId:agent}};
  const context={actor:{id:agent,companyId:company,role:'general',adapterType:'paperclip_runner',status:'running',adapterConfig:config},issue:{id:child,parentId:root,projectId:project,companyId:company},run:{id:'run',companyId:company,agentId:agent,nativeIssueId:child,runtimeMode:'native',status:'running'}};
  m.assertNativeFundingContext(binding,context);
  assert.throws(()=>m.assertNativeFundingContext(binding,{...context,issue:{...context.issue,parentId:'foreign'}}),/revoked/);
  assert.throws(()=>m.assertNativeFundingContext({...binding,nativeReview:review?undefined:{}},context),/revoked/);
 }
});
test('worker switches between configured scout and diligence catalogs without a role claim',async()=>{
 const {readFile}=await import('node:fs/promises');const{pathToFileURL}=await import('node:url');
 const path=process.env.PORTFOLIO_DISCOVERY_SOURCE??new URL('../transport/native/native-discovery-policy.mjs',import.meta.url);
 const source=(await readFile(path,'utf8')).replace("'./native-funding-policy.js'",JSON.stringify(new URL('../transport/native/native-portfolio-funding-policy.mjs',import.meta.url).href));
 const d=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 for(const role of ['scout','diligence']){
  const policy={version:1,role:'worker',projectIds:[project],issueIds:[child]};
  const c={enabled:true,key:'research',organizationId:'org',projectId:project,issueId:role==='scout'?child:root,agentId:role==='scout'?agent:company,principalId:role==='scout'?'alpha':'beta',process:{fixture:true},publicQueries:['public training grants']};
  if(role==='diligence')c.diligence={issueId:child,agentId:agent,principalId:'alpha',process:{fixture:true}};
  const binding={companyId:company,issueId:child,agentId:agent,runId:'run'};
  const context={actor:{id:agent,companyId:company,role:'general',adapterType:'paperclip_runner',status:'running',adapterConfig:{...config,nativeFunding:policy}},issue:{id:child,companyId:company,projectId:project,assigneeAgentId:agent,executionRunId:'run',workMode:'standard'},run:{id:'run',companyId:company,agentId:agent,nativeIssueId:child,runtimeMode:'native',status:'running'}};
  const admission=d.selectNativeDiscoveryAdmission([{pluginKey:'netrxn.inertia',status:'ready',companyId:company,config:{fundingDiscovery:c}}],binding,policy,context,null);
  assert.equal(admission.role,role);assert.equal(d.nativeDiscoveryToolNames(admission).length,role==='scout'?2:4);
 }
});
test('portfolio scout selects only authenticated direct child and revokes on root or actor change',async()=>{
 const{readFile}=await import('node:fs/promises');
 const source=(await readFile(new URL('../transport/native/native-discovery-policy.mjs',import.meta.url),'utf8')).replace("'./native-funding-policy.js'",JSON.stringify(new URL('../transport/native/native-portfolio-funding-policy.mjs',import.meta.url).href));
 const d=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const policy=structuredClone(config.nativeFunding),binding={companyId:company,issueId:child,agentId:agent,runId:'run'};
 const c={enabled:true,key:'research',organizationId:'org',projectId:project,issueId:root,portfolioRootIssueId:root,agentId:agent,principalId:'alpha',process:{fixture:true},publicQueries:['public training grants']};
 const context={actor:{id:agent,companyId:company,role:'general',adapterType:'paperclip_runner',status:'running',adapterConfig:{...config,nativeFunding:policy}},rootIssue:{id:root,companyId:company,projectId:project,status:'in_progress'},issue:{id:child,parentId:root,companyId:company,projectId:project,assigneeAgentId:agent,executionRunId:'run',workMode:'standard',status:'in_progress'},run:{id:'run',companyId:company,agentId:agent,nativeIssueId:child,runtimeMode:'native',status:'running'}};
 const rows=[{pluginKey:'netrxn.inertia',status:'ready',companyId:company,config:{fundingDiscovery:c}}];
 const select=()=>d.selectNativeDiscoveryAdmission(rows,binding,policy,context,null);
 assert.equal(select().role,'scout');
 const purpose='66666666-6666-4666-8666-666666666666';c.rootProjectId=purpose;context.rootIssue.projectId=purpose;policy.projectIds.push(purpose);
 assert.equal(select().role,'scout','Protected cross-project child is admitted');
 delete c.rootProjectId;assert.throws(select,/denied/,'Omitted root project retains same-project default');c.rootProjectId='foreign';assert.throws(select,/denied/);c.rootProjectId=purpose;
 assert.equal(d.selectNativeDiscoveryAdmission(rows,binding,policy,{...context,issue:{...context.issue,projectId:purpose}},null),null,'Preparation project does not select research catalog');
 assert.equal(d.selectNativeDiscoveryAdmission(rows,{...binding,agentId:company},policy,context,null),null,'Beta preparation retains drafting route');
 assert.equal(d.selectNativeDiscoveryAdmission(rows,binding,policy,context,{nativeReviewInteractionId:'review'}),null,'Alpha attention retains independent review route');
 for(const alter of [x=>x.rootIssue.status='done',x=>x.issue.parentId='foreign',x=>x.issue.assigneeAgentId='foreign',x=>x.rootIssue.projectId='foreign']){const saved=structuredClone(context);alter(context);assert.throws(select,/denied/);Object.assign(context,saved);}
});
