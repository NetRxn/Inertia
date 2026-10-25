import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {spawn,execFileSync}from'node:child_process';
import {fileURLToPath,pathToFileURL}from'node:url';
import {createHash}from'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)),native=process.env.CODEX_COMMAND_NATIVE_ROOT??path.join(root,'node_modules');
const cli=process.env.CODEX_COMMAND_CLI;
const {buildCodexExecArgs}=await import(pathToFileURL(path.join(native,'@paperclipai/adapter-codex-local/dist/server/codex-args.js')).href);
const commandNames=new Set(['exec_command','write_stdin','shell','shell_command','local_shell','terminal']);
function toolNames(tools,prefix=''){return tools.flatMap(t=>{const n=typeof t.name==='string'?prefix+t.name:null;return [...(n?[n]:[]),...toolNames(Array.isArray(t.tools)?t.tools:[],t.type==='namespace'&&n?n+'.':prefix)];});}
const isCommand=n=>commandNames.has(n.split('.').at(-1));
test('actual Codex advertises no command tools under typed restriction while preserving MCP',{skip:!cli?'Set CODEX_COMMAND_CLI to a qualified existing binary; no download/login is performed':false,timeout:120000},async()=>{
 const work=await fs.mkdtemp(path.join(os.tmpdir(),'codex-tool-schema-')),requests=[];
 const server=http.createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  if(req.url?.split('?')[0]!=='/v1/responses'){res.writeHead(404);res.end('fixture endpoint only');return;}
  assert(!req.headers.authorization,'Fixture must not receive any authentication');
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));requests.push(body);
  const searchOutput=(body.input??[]).find(i=>i.type==='tool_search_output');
  const searchSchema=(body.tools??[]).find(t=>t.type==='tool_search');
  if(!searchOutput)assert(searchSchema?.parameters?.properties?.query,'Expected the pinned CLI client-search query contract: '+JSON.stringify(searchSchema));
  const search={id:'search-fixture-'+requests.length,type:'tool_search_call',call_id:'search-call-'+requests.length,execution:'client',status:'completed',arguments:{query:'schema_fixture read_fixture'}};
  const message={id:'message-fixture',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'CAPABILITY_FIXTURE_ONLY',annotations:[]}]};
  const output=searchOutput?message:search;
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});
  for(const [event,data]of[
   ['response.created',{type:'response.created',response:{id:'response-fixture',status:'in_progress',output:[]}}],
   ['response.output_item.done',{type:'response.output_item.done',output_index:0,item:output}],
   ['response.completed',{type:'response.completed',response:{id:'response-fixture',object:'response',status:'completed',model:'gpt-5.4',output:[output],usage:{input_tokens:0,output_tokens:0,total_tokens:0}}}],
  ])res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  res.end();
 });
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
  await fs.mkdir(path.join(work,'version-home'));
  const version=execFileSync(cli,['--version'],{encoding:'utf8',env:{PATH:process.env.PATH,HOME:work,CODEX_HOME:path.join(work,'version-home')}}).trim();
  assert.equal(version,'codex-cli 0.156.1','Requalify the schema fixture explicitly for another CLI version');
  const launcher=await fs.realpath(cli),triplet=process.arch==='arm64'?'aarch64-unknown-linux-musl':'x86_64-unknown-linux-musl';
  const binary=process.env.CODEX_COMMAND_BINARY??path.join(native,'@openai','codex-linux-'+(process.arch==='arm64'?'arm64':'x64'),'vendor',triplet,'bin/codex');
  const fingerprints={launcher_sha256:createHash('sha256').update(await fs.readFile(launcher)).digest('hex'),binary_sha256:createHash('sha256').update(await fs.readFile(binary)).digest('hex')};
  const inventories=[];
  for(const disabled of[false,true]){
   const home=path.join(work,disabled?'restricted':'control'),cwd=path.join(home,'workspace'),codexHome=path.join(home,'codex');
   await fs.mkdir(cwd,{recursive:true});await fs.mkdir(codexHome,{recursive:true});
   await fs.writeFile(path.join(codexHome,'config.toml'),`model_provider="fixture"\nmodel="gpt-5.4"\nweb_search="disabled"\napproval_policy="never"\n[features]\nshell_snapshot=false\nhooks=false\nplugins=false\nremote_plugin=false\nenable_request_compression=false\n[model_providers.fixture]\nname="Deterministic unauthenticated fixture"\nbase_url="http://127.0.0.1:${port}/v1"\nwire_api="responses"\nrequires_openai_auth=false\nsupports_websockets=false\n[mcp_servers.schema_fixture]\ncommand=${JSON.stringify(process.execPath)}\nargs=[${JSON.stringify(path.join(root,'tests/fixtures/codex-schema-mcp.mjs'))}]\n`,{mode:0o600});
   const config={engine:'cli',dangerouslyBypassApprovalsAndSandbox:false,disableCommandExecution:disabled,model:'gpt-5.4'};
   const args=buildCodexExecArgs(config,{skipGitRepoCheck:true,networkAccess:false}).args;
   const env={PATH:process.env.PATH,HOME:home,CODEX_HOME:codexHome,XDG_CONFIG_HOME:path.join(home,'config'),XDG_DATA_HOME:path.join(home,'data'),LANG:'C.UTF-8',OTEL_SDK_DISABLED:'true',NO_PROXY:'127.0.0.1,localhost'};
   const before=requests.length;
   const child=spawn(cli,args,{cwd,env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
   child.stdout.on('data',b=>{stdout+=b;if(stdout.length>1024*1024)child.kill('SIGKILL');});child.stderr.on('data',b=>{stderr+=b;if(stderr.length>1024*1024)child.kill('SIGKILL');});
   const timeout=setTimeout(()=>child.kill('SIGKILL'),45000);child.stdin.end('Return a short acknowledgement. Do not call any tool.');
   const [code,signal]=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve([code,signal]));});clearTimeout(timeout);
   assert.equal(signal,null,stderr);assert.equal(code,0,stderr+'\n'+stdout);assert.equal(requests.length,before+2,'Exactly one local tool-discovery step and final fixture response');
   const observed=requests.slice(before);const names=[...new Set(observed.flatMap(r=>[...toolNames(r.tools??[]),...(r.input??[]).filter(i=>i.type==='tool_search_output').flatMap(i=>toolNames(i.tools??[]))]))].sort();assert(names.some(n=>n.includes('schema_fixture')&&n.includes('read_fixture')),'Read-only MCP tool must still be exposed: '+JSON.stringify({names,stderr,toolShapes:(requests.at(-1).tools??[]).map(t=>({type:t.type,name:t.name,functionName:t.function?.name,keys:Object.keys(t)}))}));
   if(disabled)assert.deepEqual(names.filter(n=>isCommand(n)),[]);else assert(names.some(n=>isCommand(n)),'Positive baseline must expose command execution tools');
   assert(!stdout.includes('"type":"command_execution"'),'Fixture must never request or execute a command');
   inventories.push({disableCommandExecution:disabled,names,commandTools:names.filter(n=>isCommand(n))});
  }
  const receipt={scope:'Actual pinned CLI outgoing tool schema; deterministic provider response, no model inference, no personal credentials',version,fingerprints,fixtureToolSearch:"native client-executed discovery",requests:requests.length,inventories};
  if(process.env.CODEX_COMMAND_CAPABILITY_OUTPUT)await fs.writeFile(process.env.CODEX_COMMAND_CAPABILITY_OUTPUT,JSON.stringify(receipt,null,2));
  console.log(JSON.stringify(receipt));
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(work,{recursive:true,force:true});}
});
