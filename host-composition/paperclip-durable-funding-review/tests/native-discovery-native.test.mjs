/** Actual native SQL/authority/gateway tests; synthetic identities and plugin worker only. */
import test,{before,after}from'node:test';import assert from'node:assert/strict';import fs from'node:fs/promises';import path from'node:path';import{randomUUID}from'node:crypto';import{pathToFileURL}from'node:url';
if(process.env.QUALIFY_DISPOSABLE!=='1'){
 test('native SQL/runner qualification requires an explicit disposable environment',{skip:'Set QUALIFY_DISPOSABLE=1 only in the documented offline fixture'},()=>{});
}else{
const root=process.env.QUALIFICATION_NATIVE_ROOT,host=path.join(root,'@paperclipai/server');
const load=rel=>import(pathToFileURL(path.join(root,rel)).href),server=rel=>load('@paperclipai/server/dist/'+rel);
const schema=await load('@paperclipai/db/dist/schema/index.js');const{and,eq}=await load('drizzle-orm/index.js');
const{startEmbeddedPostgresTestDatabase,createDb}=await load('@paperclipai/db/dist/index.js');
const{PaperclipRunnerToolAuthority}=await server('services/native-runtime/paperclip-runner-tool-authority.js');
const{readNativeDiscoveryAdmission,DISCOVERY_CANONICAL_TOOLS,nativeDiscoveryToolNames}=await server('services/native-runtime/native-discovery-policy.mjs');
const{createAssignedMcpTools,registerAssignedMcpGateway,getAssignedMcpGateway}=await server('services/native-runtime/assigned-mcp-tools.js');
const{createPluginToolDispatcher}=await server('services/plugin-tool-dispatcher.js');const{createToolGatewayService}=await server('services/tool-gateway.js');
const{buildPaperclipRuntimeMcpServers}=await server('services/heartbeat.js');
const{manifest}=await import('file:///opt/inertia-reviewed/dist/src/manifest.js');
const draftRaw=['funding_drafting_workspace','save_funding_proposals','save_funding_gap_progress','funding_drafting_checkpoint'].map(n=>'netrxn.inertia:'+n);
const{nativeFundingToolNames}=await server('services/native-runtime/native-funding-policy.js');
let temporary,db;const singletonPluginId=randomUUID();
before(async()=>{temporary=await startEmbeddedPostgresTestDatabase('native-discovery-');db=createDb(temporary.connectionString);});
after(async()=>{await temporary?.cleanup();});
async function fixture(){
 const companyId=randomUUID(),projectId=randomUUID(),pluginId=singletonPluginId,organizationId=randomUUID();
 const scout={issueId:randomUUID(),agentId:randomUUID(),runId:randomUUID(),principalId:randomUUID()},diligence={issueId:randomUUID(),agentId:randomUUID(),runId:randomUUID(),principalId:randomUUID()},draft={issueId:randomUUID(),runId:randomUUID()};
 await db.insert(schema.companies).values({id:companyId,name:'Synthetic public discovery',issuePrefix:'W'+companyId.replaceAll('-','').slice(0,8).toUpperCase()});await db.insert(schema.projects).values({id:projectId,companyId,name:'Synthetic public mission'});
 for(const[role,actor]of Object.entries({scout,diligence})){
  actor.policy={version:1,role:role==='scout'?'producer':'reviewer',projectIds:[projectId],issueIds:[actor.issueId,draft.issueId].sort()};
  actor.adapter={provider:'codex',engine:'cli',disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never',nativeFunding:actor.policy};
  await db.insert(schema.agents).values({id:actor.agentId,companyId,name:'Synthetic '+role,role:'general',status:'idle',adapterType:'paperclip_runner',adapterConfig:actor.adapter});
  await db.insert(schema.issues).values({id:actor.issueId,companyId,projectId,title:'Synthetic public '+role,status:'in_progress',assigneeAgentId:actor.agentId});
  await db.insert(schema.heartbeatRuns).values({id:actor.runId,companyId,agentId:actor.agentId,nativeIssueId:actor.issueId,status:'running',runtimeMode:'native',contextSnapshot:{issueId:actor.issueId,projectId}});
  await db.update(schema.issues).set({executionRunId:actor.runId,checkoutRunId:actor.runId}).where(eq(schema.issues.id,actor.issueId));
 }
 await db.insert(schema.issues).values({id:draft.issueId,companyId,projectId,title:'Synthetic unchanged drafting task',status:'in_progress',assigneeAgentId:scout.agentId});
 await db.insert(schema.heartbeatRuns).values({id:draft.runId,companyId,agentId:scout.agentId,nativeIssueId:draft.issueId,status:'running',runtimeMode:'native',contextSnapshot:{issueId:draft.issueId,projectId}});
 await db.update(schema.issues).set({executionRunId:draft.runId,checkoutRunId:draft.runId}).where(eq(schema.issues.id,draft.issueId));
 const config={nativeFundingToolPreapproval:true,fundingDiscovery:{enabled:true,key:'public-synthetic-funding',organizationId,projectId,issueId:scout.issueId,agentId:scout.agentId,principalId:scout.principalId,urgentIssueId:draft.issueId,publicQueries:['public civic education grants'],capabilities:['public workshops'],maximumLeads:5,retryAfterMs:3600000,runBudgetMs:60000,process:{synthetic:true},diligence:{issueId:diligence.issueId,agentId:diligence.agentId,principalId:diligence.principalId,policyId:'synthetic-independent',process:{synthetic:true}}}};
 await db.insert(schema.plugins).values({id:pluginId,pluginKey:'netrxn.inertia',packageName:'synthetic-public-discovery',version:manifest.version,status:'ready',manifestJson:manifest}).onConflictDoNothing();await db.insert(schema.pluginConfig).values({pluginId,companyId,configJson:config});
 const calls=[];const dispatcher=createPluginToolDispatcher({workerManager:{isRunning:()=>true,call:async(_plugin,method,params)=>{assert.equal(method,'executeTool');calls.push(structuredClone(params));return{data:{synthetic:true,receipt:'synthetic-source-capture',sourceUrl:'https://official.example.invalid/program',retrievedAt:'2026-10-27T00:00:00Z'}};}}});dispatcher.registerPluginTools('netrxn.inertia',manifest,pluginId);const gateway=createToolGatewayService(db,{pluginToolDispatcher:dispatcher});registerAssignedMcpGateway(db,gateway);
 for(const[role,actor]of Object.entries({scout,diligence})){
  const tools=[...DISCOVERY_CANONICAL_TOOLS[role],...(role==='scout'?draftRaw:[])];
  await db.insert(schema.principalPermissionGrants).values({companyId,principalType:'agent',principalId:actor.agentId,permissionKey:'tools:use',scope:{allow:tools.map(t=>'tool:'+t)}});
  for(const toolName of tools)await db.insert(schema.toolPolicies).values({companyId,name:'Exact synthetic '+toolName,policyType:'allow',enabled:true,priority:10,selectors:{toolName},config:{}});
 }
 function binding(role='scout'){const a=role==='draft'?scout:{scout,diligence}[role];return{companyId,agentId:a.agentId,issueId:role==='draft'?draft.issueId:a.issueId,runId:role==='draft'?draft.runId:a.runId};}
 async function assigned(role='scout'){
  const a=role==='draft'?scout:{scout,diligence}[role],b=binding(role);
  const[server]=await buildPaperclipRuntimeMcpServers({db,agent:{id:a.agentId,companyId,name:'Synthetic scoped actor',adapterType:'paperclip_runner'},runId:b.runId});assert(server);
  const id=new URL(server.url).pathname.match(/\/mcp\/gateways\/([^/]+)$/)?.[1];assert(id);
  return createAssignedMcpTools({gateway,gatewayPublicId:id,bearerToken:server.token,workMode:'standard'});
 }
 async function authority(role='scout'){
  const a=role==='draft'?scout:{scout,diligence}[role],b=binding(role),admission=await readNativeDiscoveryAdmission(db,b,a.policy,null);
  return new PaperclipRunnerToolAuthority(db,{...b,nativeFundingPolicy:{...a.policy,companyId,agentId:a.agentId},...(admission?{nativeDiscoveryAdmission:admission}:{}),assignedMcpTools:await assigned(role)});
 }
 return{companyId,projectId,pluginId,scout,diligence,draft,config,calls,gateway,binding,assigned,authority,saveConfig:()=>db.update(schema.pluginConfig).set({configJson:config}).where(and(eq(schema.pluginConfig.pluginId,pluginId),eq(schema.pluginConfig.companyId,companyId)))};
}
for(const role of['scout','diligence'])test('actual native '+role+' authority uses exact catalog and real dispatcher persistence',async()=>{
 const f=await fixture(),a=await f.authority(role),actor=f[role],b=f.binding(role),admission=await readNativeDiscoveryAdmission(db,b,actor.policy,null),names=nativeDiscoveryToolNames(admission);
 assert.deepEqual((await a.definitions()).map(t=>t.name).sort(),names.sort());
 await assert.rejects(()=>a.execute({tool:'call_api',callId:randomUUID(),arguments:{}}),/native_discovery_admission_denied/);
 const result=await a.execute({tool:names.find(n=>n.includes(role==='scout'?'funding_discovery_context':'funding_diligence_context')),callId:randomUUID(),arguments:{binding:f.config.fundingDiscovery.key}});
 assert.equal(result.result?.data?.synthetic,true,JSON.stringify(result));assert.equal(f.calls.length,1);assert.equal(f.calls[0].runContext.fundingExecution,undefined,'No inherited drafting preapproval');
 const rows=await db.select().from(schema.toolInvocations).where(eq(schema.toolInvocations.agentId,actor.agentId));assert(rows.some(r=>r.status==='succeeded'));assert(rows.every(r=>r.issueId===actor.issueId&&r.runId===actor.runId));
});
test('actual current drafting task stays on original four-tool path despite enabled discovery elsewhere',async()=>{const f=await fixture();assert.equal(await readNativeDiscoveryAdmission(db,f.binding('draft'),f.scout.policy,null),null);assert.deepEqual((await(await f.authority('draft')).definitions()).map(t=>t.name).sort(),[...nativeFundingToolNames(f.scout.policy)].sort());});
test('cached authority rejects changed config, role confusion and owner/run changes',async()=>{const f=await fixture(),a=await f.authority();const original=structuredClone(f.config);f.config.fundingDiscovery.publicQueries=['changed approved facet'];await f.saveConfig();await assert.rejects(()=>a.definitions(),/native_discovery_admission_denied/);Object.assign(f.config,original);await f.saveConfig();await db.update(schema.issues).set({executionRunId:f.diligence.runId}).where(eq(schema.issues.id,f.scout.issueId));await assert.rejects(()=>a.definitions());await db.update(schema.issues).set({executionRunId:f.scout.runId}).where(eq(schema.issues.id,f.scout.issueId));await assert.rejects(()=>readNativeDiscoveryAdmission(db,f.binding(),f.diligence.policy,null));await assert.rejects(()=>readNativeDiscoveryAdmission(db,f.binding('diligence'),f.diligence.policy,{}));});
test('real gateway permission revocation stops cached discovery catalog and execution',async()=>{const f=await fixture(),a=await f.authority(),tools=await a.definitions();await db.delete(schema.principalPermissionGrants).where(eq(schema.principalPermissionGrants.principalId,f.scout.agentId));await db.delete(schema.toolPolicies).where(eq(schema.toolPolicies.companyId,f.companyId));await assert.rejects(()=>a.definitions(),/native_discovery_admission_denied/);await assert.rejects(()=>a.execute({tool:tools[0].name,callId:randomUUID(),arguments:{binding:f.config.fundingDiscovery.key}}));assert.equal(f.calls.length,0);});
test('exact actual executor construction seam selects discovery without fundingProducer metadata',async()=>{const f=await fixture(),b=f.binding(),[serverBinding]=await buildPaperclipRuntimeMcpServers({db,agent:{id:f.scout.agentId,companyId:f.companyId,name:'Synthetic scout',adapterType:'paperclip_runner'},runId:b.runId});const input={db,execution:{binding:b,provider:{kind:'codex',approvalPolicy:'never',nativeFundingPolicy:f.scout.policy},task:{workMode:'standard'},workspace:{cwd:'/tmp/not-used-by-seam'}},runnerEnvironment:{PAPERCLIP_NATIVE_MCP_NAME:serverBinding.name,PAPERCLIP_NATIVE_MCP_URL:serverBinding.url,PAPERCLIP_NATIVE_MCP_TOKEN:serverBinding.token}};
 const source=await fs.readFile(path.join(host,'dist/services/native-runtime/native-session-executor.js'),'utf8'),start=source.indexOf('    const nativeDiscoveryAdmission = await readNativeDiscoveryAdmission'),end=source.indexOf('    const coordinator =',start);assert(start>=0&&end>start);
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const seam=new AsyncFunction('input','remoteTarget','nativeReview','readNativeDiscoveryAdmission','publicScoutProjection','assertPublicScoutWorkspace','createAssignedMcpTools','getAssignedMcpGateway',source.slice(start,end)+'\nreturn {nativeDiscoveryAdmission,relayAssignedMcp,assignedMcpTools};');
 const{publicScoutProjection}=await server('vendor/paperclip-runner/drivers/public-scout-projection.mjs');
 // The empty-workspace gate is independently tested; this seam does not launch a provider.
 const output=await seam(input,null,null,readNativeDiscoveryAdmission,publicScoutProjection,()=>{},createAssignedMcpTools,getAssignedMcpGateway);assert.equal(output.nativeDiscoveryAdmission.role,'scout');assert.equal(output.relayAssignedMcp,true);assert((await output.assignedMcpTools.definitionsFresh()).length>=2);
});
test('actual native runner uses closed public projection and scout-only live materialization',{timeout:30000},async()=>{
 const{createRunnerdCodexTransport,defaultCapabilityRunnerdBinary}=await server('vendor/paperclip-runner/live/runnerd-codex-transport.js');
 const{publicScoutProjection}=await server('vendor/paperclip-runner/drivers/public-scout-projection.mjs');
 const work=await fs.mkdtemp('/tmp/native-scout-runner-'),cwd=path.join(work,'workspace');await fs.mkdir(cwd);
 const fake=path.join(work,'fake-codex.mjs');await fs.writeFile(fake,`#!/usr/bin/env node\nimport fs from 'node:fs';import path from 'node:path';import readline from 'node:readline';let done=false;const log=path.join(process.cwd(),'observed-native.jsonl');const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');readline.createInterface({input:process.stdin}).on('line',line=>{const x=JSON.parse(line);fs.appendFileSync(log,JSON.stringify({method:x.method,params:x.params,config:fs.existsSync(path.join(process.env.CODEX_HOME,'config.toml'))?fs.readFileSync(path.join(process.env.CODEX_HOME,'config.toml'),'utf8'):null})+'\\n');if(x.id===undefined)return;let result={};if(x.method==='initialize')result={user:{sessionId:'offline'}};if(x.method==='thread/start')result={thread:{id:'offline-public-thread'}};if(x.method==='thread/read')result={thread:{id:'offline-public-thread',turns:done?[{id:'offline-public-turn',status:'completed',items:[]}]:[]}};if(x.method==='turn/start'){result={turn:{id:'offline-public-turn',status:'inProgress'}};send({id:x.id,result});send({method:'turn/started',params:{threadId:'offline-public-thread',turn:{id:'offline-public-turn',status:'inProgress',items:[]}}});done=true;setTimeout(()=>send({method:'turn/completed',params:{threadId:'offline-public-thread',turn:{id:'offline-public-turn',status:'completed',items:[]}}}),30);return;}send({id:x.id,result});});`,{mode:0o755});
 let binary=defaultCapabilityRunnerdBinary();for(const candidate of['/opt/inertia-native-runner/paperclip-runnerd',binary]){try{await fs.access(candidate);binary=candidate;break;}catch{}}
 const publicScout=publicScoutProjection({version:1,role:'scout',key:'public-synthetic-funding',bindingHash:'a'.repeat(64),publicQueries:['public civic education grants']});let admissions=0;
 const bundle=createRunnerdCodexTransport({provider:'codex',runnerBinary:binary,codexCommand:fake,publicScout,authorizePublicScout:async()=>{admissions++;},stateDirectory:path.join(work,'state'),runtimeContext:null,closeGraceMs:3000,turnStartTimeoutMs:5000,environment:{PATH:process.env.PATH,HOME:work,CODEX_HOME:path.join(work,'unused'),PAPERCLIP_RUNNER_DISABLE_COMMAND_EXECUTION:'1'}});
 try{
  await bundle.transport.request('thread/start',{cwd,model:'gpt-5.4',approvalPolicy:'never',dynamicTools:[],developerInstructions:'SECRET_PRIVATE_INSTRUCTIONS'});
  await bundle.transport.request('turn/start',{input:[{type:'text',text:JSON.stringify({task:{prompt:'SECRET_PRIVATE_OBJECTIVE'},workspace:{cwd:'SECRET_SERVER_PATH'},completionContract:{revision:'r1',criteria:[{id:'c1',requirement:'SECRET_PRIVATE_CRITERION'}]},interactionResponses:['SECRET_PRIVATE_RESPONSE']})}]});
  const frames=(await fs.readFile(path.join(cwd,'observed-native.jsonl'),'utf8')).trim().split('\n').map(JSON.parse),start=frames.find(f=>f.method==='thread/start'),turn=frames.find(f=>f.method==='turn/start');assert(start&&turn);assert(!JSON.stringify(start.params).includes('SECRET'));assert(!JSON.stringify(turn.params).includes('SECRET'));assert(start.params.developerInstructions.includes('public civic education grants'));assert(start.config.includes('web_search = "live"'));assert(!start.config.includes('mcp_servers'));assert(admissions>=2);
  await assert.rejects(()=>bundle.transport.request('thread/resume',{threadId:'private-prior-thread'}),/public_scout_continuity_unqualified/);await assert.rejects(()=>bundle.transport.request('turn/steer',{input:[{type:'text',text:'SECRET_STEER'}]}),/public_scout_continuity_unqualified/);
 }catch(error){console.error('RUNNER_PRIMARY_FAILURE',error);throw error;}finally{try{await bundle.transport.close();}finally{await fs.rm(work,{recursive:true,force:true});}}
});

}
