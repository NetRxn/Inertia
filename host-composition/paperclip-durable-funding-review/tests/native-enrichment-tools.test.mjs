import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectEnrichmentAdmission,isTaskProjectTool,taskProjectDefinitions} from '../transport/native/native-enrichment-tools.mjs';
const policy={version:1,role:'worker',projectIds:['P','Q'],issueIds:['root'],portfolioRootIssueId:'root'};
function fixture(){
 const c={enabled:true,applicantSlug:'applicant',projectId:'Q',rootProjectId:'P',rootIssueId:'root',producer:{agentId:'alpha',principalId:'a'},reviewer:{agentId:'beta',principalId:'b'}};
 const binding={companyId:'company',issueId:'research',agentId:'alpha',runId:'run'};
 const actor={id:'alpha',companyId:'company',role:'general',adapterType:'paperclip_runner',status:'running',adapterConfig:{provider:'codex',engine:'cli',disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never',nativeFunding:structuredClone(policy)}};
 const context={actor,issue:{id:'research',companyId:'company',projectId:'Q',parentId:'root',assigneeAgentId:'alpha',executionRunId:'run',workMode:'standard',status:'in_progress'},run:{id:'run',companyId:'company',agentId:'alpha',nativeIssueId:'research',runtimeMode:'native',status:'running'}};
 return{rows:[{pluginKey:'netrxn.inertia',companyId:'company',status:'ready',config:{generalEnrichment:c}}],binding,context,root:{id:'root',companyId:'company',projectId:'P',status:'in_progress'}};
}
const select=f=>selectEnrichmentAdmission(f.rows,f.binding,policy,null,f.context,f.root);
test('current researcher and distinct configured reviewer get one finite enrichment catalog',()=>{
 const f=fixture();assert.equal(select(f).role,'researcher');
 f.binding.agentId=f.context.actor.id=f.context.issue.assigneeAgentId=f.context.run.agentId='beta';
 assert.equal(select(f).role,'reviewer');
 const b={nativeTaskProjectAdmission:select(f)};
 assert.equal(isTaskProjectTool(b,'call_api'),false);assert.equal(isTaskProjectTool(b,'reassign_task'),false);
});
test('preparation and independent packet review retain original catalogs',()=>{
 const f=fixture();f.context.issue.projectId='P';assert.equal(select(f),null);
 assert.equal(selectEnrichmentAdmission(f.rows,f.binding,policy,{},f.context,f.root),null);
});
for(const [name,mutate] of Object.entries({
 hiddenRoot:f=>f.root.hiddenAt=new Date(),terminalRoot:f=>f.root.status='done',
 foreignRoot:f=>f.root.companyId='other',wrongParent:f=>f.context.issue.parentId='other',
 reassigned:f=>f.context.issue.assigneeAgentId='beta',oldRun:f=>f.context.run.finishedAt=new Date(),
 shellEnabled:f=>f.context.actor.adapterConfig.disableCommandExecution=false,
 hiddenChild:f=>f.context.issue.hiddenAt=new Date(),pluginDisabled:f=>{f.rows[0].settingsPresent=true;f.rows[0].enabled=false;},
 sameReviewer:f=>f.rows[0].config.generalEnrichment.reviewer.principalId='a',
 extraArgument:f=>f.context.actor.adapterConfig.extraArgs=['--dangerously-bypass-approvals-and-sandbox'],
}))test('revokes on '+name,()=>{const f=fixture();mutate(f);assert.throws(()=>select(f),/denied/);});
test('definitions require an actual fresh native gateway grant and recheck before returning',async()=>{
 const f=fixture(),binding={nativeTaskProjectAdmission:select(f),assignedMcpTools:{definitionsFresh:async()=>[]}};
 await assert.rejects(()=>taskProjectDefinitions(binding,async()=>{}),/denied/);
 let checks=0;binding.assignedMcpTools.definitionsFresh=async()=>[{name:'app_netrxn_inertia_funding_enrichment_8fae92bcbdaf'}];
 // An invented projected name cannot stand in for an actual finite tool declaration.
 await assert.rejects(()=>taskProjectDefinitions(binding,async()=>{checks++;}),/denied/);assert.ok(checks>0);
});

test('equivalent normalized native policy ordering does not deny current researcher',()=>{const f=fixture();f.context.actor.adapterConfig.nativeFunding.projectIds.reverse();assert.equal(select(f).role,'researcher');});
