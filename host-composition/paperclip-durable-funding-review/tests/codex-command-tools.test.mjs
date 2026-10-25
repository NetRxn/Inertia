import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const composition=fileURLToPath(new URL('../',import.meta.url));
const native=process.env.CODEX_COMMAND_NATIVE_ROOT??path.join(composition,'node_modules');
const argsModule=await import(pathToFileURL(path.join(native,'@paperclipai/adapter-codex-local/dist/server/codex-args.js')).href);
const {resolveCodexExecutionEngineForRun}=await import(pathToFileURL(path.join(native,'@paperclipai/adapter-codex-local/dist/server/acp.js')).href);
const {assertManagedAiProjectAuth}=await import(pathToFileURL(path.join(native,'@paperclipai/server/dist/services/ai-connection-runtime.js')).href);
const base={engine:'cli',dangerouslyBypassApprovalsAndSandbox:false,model:'gpt-5.4'};
const restricted={...base,disableCommandExecution:true};
const plain=['exec','--json','-c','sandbox_mode="workspace-write"','-c','sandbox_workspace_write.network_access=true','--model','gpt-5.4'];
const restrictive=['-c','features.shell_tool=false','-c','features.shell_snapshot=false'];
for(const mode of ['fresh','resume'])test(`fixed command restriction reaches ${mode} CLI builder without changing sandbox`,()=>{
 const options=mode==='resume'?{resumeSessionId:'fixture-session'}:{};
 assert.deepEqual(argsModule.buildCodexExecArgs(restricted,options).args,[...plain,...restrictive,...(mode==='resume'?['resume','fixture-session','-']:['-'])]);
});
test('omitted and false preserve existing argument behavior',()=>{
 for(const config of[base,{...base,disableCommandExecution:false}])assert.deepEqual(argsModule.buildCodexExecArgs(config).args,[...plain,'-']);
});
test('target network denial and generated git option remain enforced',()=>{
 const actual=argsModule.buildCodexExecArgs(restricted,{networkAccess:false,skipGitRepoCheck:true}).args;
 assert(actual.includes('--skip-git-repo-check'));assert(!actual.includes('sandbox_workspace_write.network_access=true'));
 assert(actual.includes('sandbox_workspace_write.network_access=false'));assert(!actual.some(v=>v.includes('dangerously-bypass')));
 assert.deepEqual(actual.slice(-5),[...restrictive,'-']);
});
for(const value of[null,'true','false',0,1,{},[]])test(`invalid boolean fails closed: ${JSON.stringify(value)}`,()=>{
 assert.throws(()=>argsModule.buildCodexExecArgs({...base,disableCommandExecution:value}),/disableCommandExecution.*boolean/);
});
for(const engine of[undefined,null,'auto','acp','bogus','CLI'])test(`restriction rejects unsupported engine ${String(engine)}`,()=>{
 assert.throws(()=>argsModule.buildCodexExecArgs({...restricted,engine}),/disableCommandExecution.*cli/);
});
for(const bypass of[undefined,true,'false',0])test(`restriction requires explicit bypass false: ${String(bypass)}`,()=>{
 assert.throws(()=>argsModule.buildCodexExecArgs({...restricted,dangerouslyBypassApprovalsAndSandbox:bypass}),/disableCommandExecution.*bypass/i);
});
for(const value of[true,'false',null])test(`legacy bypass conflict fails closed: ${String(value)}`,()=>{
 assert.throws(()=>argsModule.buildCodexExecArgs({...restricted,dangerouslyBypassSandbox:value}),/disableCommandExecution.*bypass/i);
});
for(const field of['extraArgs','args'])for(const value of[['--enable','shell_tool'],['--sandbox','danger-full-access'],['-c','features.shell_tool=true'],'--enable shell_tool',[123]])test(`raw ${field} conflicts rejected: ${JSON.stringify(value)}`,()=>{
 assert.throws(()=>argsModule.buildCodexExecArgs({...restricted,[field]:value}),/disableCommandExecution.*arguments/i);
});
test('empty raw arrays and explicit legacy bypass false are supported',()=>{
 assert.deepEqual(argsModule.buildCodexExecArgs({...restricted,extraArgs:[],args:[],dangerouslyBypassSandbox:false}).args,[...plain,...restrictive,'-']);
});
test('unsupported engine rejected before execution-target or ACP preparation',async()=>{
 const input={config:{...restricted,engine:'acp'},get executionTarget(){throw Error('execution target must not be inspected');}};
 await assert.rejects(()=>resolveCodexExecutionEngineForRun(input),/disableCommandExecution.*cli/);
});
test('invalid option rejected on normal CLI engine-selection path',async()=>{
 await assert.rejects(()=>resolveCodexExecutionEngineForRun({config:{...restricted,disableCommandExecution:'true'}}),/disableCommandExecution.*boolean/);
});
test('managed-auth guard accepts typed restriction but still rejects raw configuration/auth flags',async()=>{
 const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'codex-auth-guard-fixture-'));
 try{
  await assertManagedAiProjectAuth({...restricted,cwd},'openai');
  for(const field of['extraArgs','args'])for(const flag of['-c','--config','--settings','--setting-sources','--api-key','--auth-token'])await assert.rejects(()=>assertManagedAiProjectAuth({...restricted,cwd,[field]:[flag,'fixture']},'openai'),e=>e.status===422&&e.details?.code==='ai_connection_incompatible');
  await fs.mkdir(path.join(cwd,'.codex'));await fs.writeFile(path.join(cwd,'.codex/config.toml'),'model_provider = "synthetic-conflict"\n');
  await assert.rejects(()=>assertManagedAiProjectAuth({...restricted,cwd},'openai'),e=>e.status===422&&e.details?.code==='ai_connection_incompatible');
 }finally{await fs.rm(cwd,{recursive:true,force:true});}
});

test('actual execute and environment entry points reject unsupported mode before target access',async()=>{
 const {execute}=await import(pathToFileURL(path.join(native,'@paperclipai/adapter-codex-local/dist/server/execute.js')).href);
 const {testEnvironment}=await import(pathToFileURL(path.join(native,'@paperclipai/adapter-codex-local/dist/server/test.js')).href);
 for(const run of[execute,testEnvironment]){
  const ctx={config:{...restricted,engine:'acp'},get executionTarget(){throw Error('fixture target must not be inspected');}};
  await assert.rejects(()=>run(ctx),/disableCommandExecution.*cli/);
 }
});

test('actual native hello probe carries the same restrictive settings with a synthetic executable',async()=>{
 const {testEnvironment}=await import(pathToFileURL(path.join(native,'@paperclipai/adapter-codex-local/dist/server/test.js')).href);
 const work=await fs.mkdtemp(path.join(os.tmpdir(),'codex-hello-argv-fixture-'));
 try{
  const command=path.join(work,'codex'),receipt=path.join(work,'argv.json'),home=path.join(work,'home'),codexHome=path.join(home,'codex');
  await fs.mkdir(codexHome,{recursive:true});
  await fs.writeFile(command,`#!${process.execPath}\nimport fs from 'node:fs';\nif(process.env.OPENAI_API_KEY||process.env.CODEX_API_KEY)throw Error('No credential allowed in fixture');\nfs.writeFileSync(process.env.FIXTURE_ARGV_PATH,JSON.stringify(process.argv.slice(2)));\nconsole.log(JSON.stringify({type:'thread.started',thread_id:'synthetic-fixture'}));\nconsole.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'hello'}}));\nconsole.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:0,output_tokens:0}}));\n`,{mode:0o755});
  const result=await testEnvironment({adapterType:'codex_local',companyId:'fixture-company',config:{...restricted,cwd:work,command,env:{HOME:home,CODEX_HOME:codexHome,OPENAI_API_KEY:'',CODEX_API_KEY:'',FIXTURE_ARGV_PATH:receipt}}});
  assert(result.checks.some(c=>c.code==='codex_hello_probe_passed'),JSON.stringify(result.checks));
  const args=JSON.parse(await fs.readFile(receipt));
  for(const setting of['features.shell_tool=false','features.shell_snapshot=false'])assert.equal(args.filter(a=>a===setting).length,1,JSON.stringify(args));
  assert(args.includes('sandbox_mode="workspace-write"'));assert(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
  assert(args.includes('features.plugins=false'));assert(args.includes('features.remote_plugin=false'));assert(args.includes('--ephemeral'));
 }finally{await fs.rm(work,{recursive:true,force:true});}
});
