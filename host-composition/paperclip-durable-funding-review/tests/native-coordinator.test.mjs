import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';import os from 'node:os';import{spawnSync}from'node:child_process';
const root=process.env.NATIVE_COORDINATOR_ROOT??fileURLToPath(new URL('../node_modules/',import.meta.url));
const host=path.join(root,'@paperclipai/server/dist');
const {PaperclipRunnerToolAuthority}=await import(pathToFileURL(path.join(host,'services/native-runtime/paperclip-runner-tool-authority.js')));
const {createIsolatedCodexAppServerArgs,createSecuredCodexThreadParams}=await import(pathToFileURL(path.join(host,'vendor/paperclip-runner/drivers/codex/codex-security-config.js')));
const ids={companyId:'11111111-1111-4111-8111-111111111111',agentId:'22222222-2222-4222-8222-222222222222',runId:'33333333-3333-4333-8333-333333333333',issueId:'44444444-4444-4444-8444-444444444444'};
const policy={version:1,companyId:ids.companyId,agentId:ids.agentId,projectIds:['55555555-5555-4555-8555-555555555555']};
const allowed=['get_task_context','get_task_history','search_tasks','list_projects','list_agents','get_agent','list_documents','read_document','list_document_revisions','create_task','reassign_task','set_dependencies','report_progress','write_document','request_human_input'].sort();
const boundary=await import(pathToFileURL(path.join(host,'services/native-runtime/native-coordinator-policy.js'))).catch(()=>null);
test('pinned unauthenticated Codex accepts and reports command features disabled',{skip:process.env.QUALIFY_NATIVE_CODEX!=='1'},async()=>{
 const home=await fs.mkdtemp(path.join(os.tmpdir(),'no-auth-codex-'));try{
  const env={PATH:process.env.PATH,HOME:home,CODEX_HOME:home};
  const version=spawnSync('codex',['--version'],{encoding:'utf8',env});assert.equal(version.status,0,version.stderr);assert.match(version.stdout,/codex-cli 0\.156\.1/);
  const r=spawnSync('codex',['features','list','-c','features.shell_tool=false','-c','features.shell_snapshot=false'],{encoding:'utf8',env});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/^shell_tool\s+stable\s+false$/m);assert.match(r.stdout,/^shell_snapshot\s+stable\s+false$/m);
 }finally{await fs.rm(home,{recursive:true,force:true});}
});
test('actual native entry rejects alternate backends and remote or GitHub activation before side effects',async()=>{
 const {executePaperclipNativeSession}=await import(pathToFileURL(path.join(host,'services/native-runtime/native-session-executor.js')));
 const execution={provider:{kind:'codex',approvalPolicy:'never',nativeCoordinatorPolicy:{version:1,projectIds:policy.projectIds}}};
 for(const option of[{useRunnerd:false},{useRunnerd:true,backend:{}},{useRunnerd:true,runnerExecutionTarget:{kind:'remote'}},{useRunnerd:true,managedGitHub:{}}])await assert.rejects(()=>executePaperclipNativeSession({execution,...option}),/native_coordination_execution_denied/);
});
test('restrictive policy survives actual provider builder and persisted native parser round trips',async()=>{
 const {resolvePaperclipRunnerNativeProviderInput}=await import(pathToFileURL(path.join(host,'services/native-runtime/provider-profile.js')));
 const {buildNativeExecutionInput}=await import(pathToFileURL(path.join(host,'services/native-runtime/native-execution-input.js')));
 const {parseNativeExecutionInput}=await import(pathToFileURL(path.join(host,'vendor/paperclip-runner/contracts/native-execution.js')));
 const {nativeRuntimeContextFixture}=await import(pathToFileURL(path.join(host,'services/native-runtime/runtime-context.test-fixture.js')));
 const profile=resolvePaperclipRunnerNativeProviderInput({backend:'codex_app_server',adapterConfig:{provider:'codex',nativeCoordinator:{version:1,projectIds:policy.projectIds},disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never'}});
 const input=buildNativeExecutionInput({...profile,companyId:ids.companyId,runId:ids.runId,agentId:ids.agentId,issue:{id:ids.issueId,identifier:'SYN-1',title:'Synthetic coordination',description:null,workMode:'standard'},taskPrompt:'Inspect synthetic task only',workspace:{id:ids.runId,cwd:'/work/project',repoUrl:null,repoRef:null,branchName:null},normalizedSessionId:null,planningContext:null,completionContract:{id:'77777777-7777-4777-8777-777777777777',sha256:'sha256:'+'a'.repeat(64),schemaVersion:'paperclip.run-result.v1',contract:{revision:'1',objective:'Inspect synthetic task',criteria:[{id:'result',requirement:'Inspect synthetic task'}]}},runtimeContext:nativeRuntimeContextFixture()});
 assert.deepEqual(input.provider.nativeCoordinatorPolicy,{version:1,projectIds:policy.projectIds});
 assert.deepEqual(parseNativeExecutionInput(JSON.parse(JSON.stringify(input))).provider.nativeCoordinatorPolicy,input.provider.nativeCoordinatorPolicy);
 for(const patch of[{version:2,projectIds:policy.projectIds},{version:1,projectIds:policy.projectIds,tools:['hire_agent']},{version:1,projectIds:[]}])assert.throws(()=>parseNativeExecutionInput({...input,provider:{...input.provider,nativeCoordinatorPolicy:patch}}),/nativeCoordinator|native_coordination/);
 assert.throws(()=>parseNativeExecutionInput({...input,provider:{...input.provider,approvalPolicy:'on-request'}}),/nativeCoordinator|native_coordination/);
});
test('typed policy rejects unsupported fields and requires explicit restrictive configuration',()=>{
 assert.equal(typeof boundary?.normalizeNativeCoordinatorPolicy,'function');
 const config={nativeCoordinator:{version:1,projectIds:policy.projectIds},disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never'};
 assert.deepEqual(boundary.normalizeNativeCoordinatorPolicy(config),{version:1,projectIds:policy.projectIds});
 for(const patch of [{disableCommandExecution:false},{dangerouslyBypassApprovalsAndSandbox:undefined},{codexPermissionMode:'on-request'},{extraArgs:['--config','anything']},{nativeCoordinator:{...config.nativeCoordinator,tools:['hire_agent']}},{nativeCoordinator:{version:1,projectIds:[]}}])assert.throws(()=>boundary.normalizeNativeCoordinatorPolicy({...config,...patch}),/native_coordination/);
 assert.equal(boundary.normalizeNativeCoordinatorPolicy({}),null);
});
test('scope is copied, immutable, and revalidated against current actor and project',()=>{
 assert.equal(typeof boundary?.assertNativeCoordinatorContext,'function');
 const config={nativeCoordinator:{version:1,projectIds:[...policy.projectIds]},disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never'};
 const current={...ids,nativeCoordinatorPolicy:policy};
 const context={actor:{id:ids.agentId,companyId:ids.companyId,role:'ceo',adapterType:'paperclip_runner',adapterConfig:config},issue:{companyId:ids.companyId,projectId:policy.projectIds[0]}};
 boundary.assertNativeCoordinatorContext(current,context);
 for(const patch of [{role:'general'},{adapterConfig:{}},{companyId:'other'}])assert.throws(()=>boundary.assertNativeCoordinatorContext(current,{...context,actor:{...context.actor,...patch}}),/native_coordination/);
 assert.throws(()=>boundary.assertNativeCoordinatorContext(current,{...context,issue:{...context.issue,projectId:'other'}}),/native_coordination/);
 const normalized=boundary.normalizeNativeCoordinatorPolicy(config);config.nativeCoordinator.projectIds.push('66666666-6666-4666-8666-666666666666');assert.equal(normalized.projectIds.length,1);assert(Object.isFrozen(normalized.projectIds));
});
test('coordinator advertises exactly authorized semantic tools, excluding connection and plugin catalogs',()=>{
 const authority=new PaperclipRunnerToolAuthority({}, {...ids,nativeCoordinatorPolicy:policy,connectorAssignments:[{tools:[{name:'fixture_connector'}]}],assignedMcpTools:{definitions:()=>[{name:'fixture_assigned'}]}});
 assert.deepEqual(authority.definitions().map(x=>x.name).sort(),allowed);
});
test('only scoped coordinator read tools advertise an optional target task',()=>{
 const a=new PaperclipRunnerToolAuthority({}, {...ids,nativeCoordinatorPolicy:policy});
 for(const name of ['get_task_context','get_task_history','list_documents','read_document','list_document_revisions'])assert.equal(a.definitions().find(t=>t.name===name).inputSchema.properties.targetTaskId.type,'string');
 for(const t of a.definitions().filter(t=>!['get_task_context','get_task_history','list_documents','read_document','list_document_revisions'].includes(t.name)))assert.equal(t.inputSchema.properties?.targetTaskId,undefined);
 const ordinary=new PaperclipRunnerToolAuthority({},ids);assert.equal(ordinary.definitions().find(t=>t.name==='read_document').inputSchema.properties.targetTaskId,undefined);
});
for(const tool of ['hire_agent','call_api','search_api','create_skill','update_agent_instructions','connections_search','fixture_assigned','unknown'])test(`coordinator dispatch denies ${tool} before ambient tools or database access`,async()=>{
 const authority=new PaperclipRunnerToolAuthority({}, {...ids,nativeCoordinatorPolicy:policy,assignedMcpTools:{has:n=>n==='fixture_assigned',execute:()=>{throw Error('Assigned tool must not execute');}}});
 await assert.rejects(()=>authority.execute({tool,callId:'synthetic',arguments:{}}),/native_coordination_tool_denied/);
});
test('native Codex command restriction emits fixed disabling settings and retains workspace sandbox',()=>{
 const source={PATH:'/usr/bin',HOME:'/work/home',CODEX_HOME:'/work/codex',PAPERCLIP_WORKSPACE_CWD:'/work/project',PAPERCLIP_RUNNER_DISABLE_COMMAND_EXECUTION:'1'};
 const args=createIsolatedCodexAppServerArgs(source);
 for(const v of ['features.shell_tool=false','features.shell_snapshot=false'])assert.equal(args.filter(x=>x===v).length,1);
 assert(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
 assert.equal(createSecuredCodexThreadParams('/work/project','default',true,false,source).permissions,'paperclip-runner-workspace-only');
});
test('command-disabled native mode refuses external-sandbox bypass selection',()=>{
 assert.throws(()=>createIsolatedCodexAppServerArgs({HOME:'/work/home',CODEX_HOME:'/work/codex',PAPERCLIP_WORKSPACE_CWD:'/work/project',PAPERCLIP_RUNNER_DISABLE_COMMAND_EXECUTION:'1',PAPERCLIP_RUNNER_EXTERNAL_SANDBOX:'1'}),/native_coordination.*sandbox/);
});
test('ordinary native execution remains unchanged when restriction is not selected',()=>{
 const args=createIsolatedCodexAppServerArgs({HOME:'/work/home',CODEX_HOME:'/work/codex',PAPERCLIP_WORKSPACE_CWD:'/work/project'});
 assert(!args.includes('features.shell_tool=false'));
});
