/** Disposable actual native tasks, SQL, catalog and gateway. No providers or live state. */
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs/promises';import{randomUUID}from'node:crypto';import{pathToFileURL,fileURLToPath}from'node:url';
process.env.PAPERCLIP_API_URL='http://127.0.0.1:3100';
const native='/opt/host/node_modules',source='/qual/source',root='/tmp/case-native-sql',server=root+'/node_modules/@paperclipai/server';await fs.mkdir(server,{recursive:true});await fs.cp(native+'/@paperclipai/server/dist',server+'/dist',{recursive:true});await fs.copyFile(native+'/@paperclipai/server/package.json',server+'/package.json');await fs.cp('/qual/candidate/dist',server+'/dist',{recursive:true,force:true});
for(const from of[native+'/@paperclipai/server/node_modules',native])for(const name of await fs.readdir(from).catch(()=>[])){if(name==='@paperclipai'||name.startsWith('.'))continue;await fs.symlink(from+'/'+name,root+'/node_modules/'+name).catch(e=>{if(e.code!=='EEXIST')throw e;});}
for(const name of await fs.readdir(native+'/@paperclipai'))if(name!=='server')await fs.symlink(native+'/@paperclipai/'+name,root+'/node_modules/@paperclipai/'+name);
const load=p=>import(pathToFileURL(native+'/'+p)),local=p=>import(pathToFileURL(server+'/dist/'+p)),s=await load('@paperclipai/db/dist/schema/index.js'),{eq}=await load('drizzle-orm/index.js'),{startEmbeddedPostgresTestDatabase,createDb}=await load('@paperclipai/db/dist/index.js');
const{PaperclipRunnerToolAuthority}=await local('services/native-runtime/paperclip-runner-tool-authority.js');
const{readNativeDiscoveryAdmission,DISCOVERY_CANONICAL_TOOLS,nativeDiscoveryToolNames}=await local('services/native-runtime/native-discovery-policy.mjs');
const{resolveNativeInertiaExecutionPolicy,validateNativeInertiaExecutionPolicy}=await local('services/native-runtime/native-inertia-execution-policy.mjs');
const{createAssignedMcpTools,registerAssignedMcpGateway,getAssignedMcpGateway}=await local('services/native-runtime/assigned-mcp-tools.js');
const{createPluginToolDispatcher}=await local('services/plugin-tool-dispatcher.js');
const{createToolGatewayService}=await local('services/tool-gateway.js');
const{buildPaperclipRuntimeMcpServers}=await local('services/heartbeat.js');
const{manifest}=await import('file:///opt/inertia-reviewed/dist/src/manifest.js');
const{and}=await load('drizzle-orm/index.js');
const pg=await startEmbeddedPostgresTestDatabase('scout-deadline-'),db=createDb(pg.connectionString);test.after(async()=>pg.cleanup());
const pluginId=randomUUID();
async function fixture(workerManager){
 const companyId=randomUUID(),projectId=randomUUID(),organizationId=randomUUID(),calls=[];
 const scout={agentId:randomUUID(),issueId:randomUUID(),runId:randomUUID(),principalId:randomUUID()},diligence={agentId:randomUUID(),issueId:randomUUID(),runId:randomUUID(),principalId:randomUUID()};
 await db.insert(s.companies).values({id:companyId,name:'Synthetic public scout',issuePrefix:'S'+companyId.slice(0,7)});
 await db.insert(s.projects).values({id:projectId,companyId,name:'Synthetic public project'});
 for(const[role,a]of Object.entries({scout,diligence})){
  a.policy={version:1,role:role==='scout'?'producer':'reviewer',projectIds:[projectId],issueIds:[a.issueId]};
  a.adapter={provider:'codex',engine:'cli',disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never',nativeFunding:a.policy};
  await db.insert(s.agents).values({id:a.agentId,companyId,name:'Synthetic '+role,role:'general',status:'running',adapterType:'paperclip_runner',adapterConfig:a.adapter});
  await db.insert(s.issues).values({id:a.issueId,companyId,projectId,title:'Synthetic public '+role,status:'in_progress',assigneeAgentId:a.agentId});
  await db.insert(s.heartbeatRuns).values({id:a.runId,companyId,agentId:a.agentId,nativeIssueId:a.issueId,status:'running',runtimeMode:'native',contextSnapshot:{issueId:a.issueId,projectId}});
  await db.update(s.issues).set({executionRunId:a.runId,checkoutRunId:a.runId}).where(eq(s.issues.id,a.issueId));
  await db.insert(s.principalPermissionGrants).values({companyId,principalType:'agent',principalId:a.agentId,permissionKey:'tools:use',scope:{allow:DISCOVERY_CANONICAL_TOOLS[role].map(name=>'tool:'+name)}});
  for(const name of DISCOVERY_CANONICAL_TOOLS[role]){
   await db.insert(s.toolPolicies).values({companyId,name:'Synthetic exact '+name,policyType:'allow',enabled:true,priority:10,selectors:{toolName:name},config:{}});
  }
 }
 const config={fundingDiscovery:{enabled:true,key:'public-synthetic-deadline',organizationId,projectId,issueId:scout.issueId,agentId:scout.agentId,principalId:scout.principalId,publicQueries:['public civic education grants'],maximumLeads:5,retryAfterMs:3600000,runBudgetMs:60000,process:{timeoutMs:120000},diligence:{issueId:diligence.issueId,agentId:diligence.agentId,principalId:diligence.principalId,process:{timeoutMs:120000},policyId:'synthetic-independent'}}};
 await db.insert(s.plugins).values({id:pluginId,pluginKey:'netrxn.inertia',packageName:'synthetic-deadline',version:manifest.version,status:'ready',manifestJson:manifest}).onConflictDoNothing();
 await db.insert(s.pluginConfig).values({pluginId,companyId,configJson:config});
 const dispatcher=createPluginToolDispatcher({workerManager:{isRunning:()=>true,call:async(...args)=>{calls.push({method:args[1],params:structuredClone(args[2]),rpcTimeoutMs:args[3]});return workerManager?workerManager.call(...args):{content:'Synthetic bounded result',data:{synthetic:true}};}}});
 dispatcher.registerPluginTools('netrxn.inertia',manifest,pluginId);const gateway=createToolGatewayService(db,{pluginToolDispatcher:dispatcher});registerAssignedMcpGateway(db,gateway);
 const binding=(role='scout')=>({companyId,agentId:({scout,diligence})[role].agentId,issueId:({scout,diligence})[role].issueId,runId:({scout,diligence})[role].runId});
 async function assigned(role='scout',tag=true){
  const a=({scout,diligence})[role],b=binding(role),[serverBinding]=await buildPaperclipRuntimeMcpServers({db,agent:{id:a.agentId,companyId,name:'Synthetic role',adapterType:'paperclip_runner'},runId:b.runId});
  const gatewayPublicId=new URL(serverBinding.url).pathname.match(/\/mcp\/gateways\/([^/]+)$/)[1];
  if(!tag)return createAssignedMcpTools({gateway,gatewayPublicId,bearerToken:serverBinding.token,workMode:'standard'});
  const input={db,execution:{binding:b,provider:{kind:'codex'},task:{workMode:'standard'}},runnerEnvironment:{PAPERCLIP_NATIVE_MCP_NAME:serverBinding.name,PAPERCLIP_NATIVE_MCP_URL:serverBinding.url,PAPERCLIP_NATIVE_MCP_TOKEN:serverBinding.token}};
  const admission=await readNativeDiscoveryAdmission(db,b,a.policy,null);
  const source=await fs.readFile(server+'/dist/services/native-runtime/native-session-executor.js','utf8'),start=source.indexOf('    const relayAssignedMcp ='),end=source.indexOf('    const coordinator =',start);assert(start>=0&&end>start);
  const fn=new(Object.getPrototypeOf(async function(){}).constructor)('input','remoteTarget','nativeReview','nativeEntityAdmission','nativeTaskProjectAdmission','nativeDiscoveryAdmission','nativePrivatePreparationAdmission','effectiveFundingPolicy','createAssignedMcpTools','getAssignedMcpGateway',source.slice(start,end)+'\nreturn assignedMcpTools;');
  return fn(input,null,null,null,null,admission,null,a.policy,createAssignedMcpTools,getAssignedMcpGateway);
 }
 function policyInput(role='scout',toolName=DISCOVERY_CANONICAL_TOOLS[role][0]){
  const b=binding(role),names=[...DISCOVERY_CANONICAL_TOOLS[role]],startedAt=Date.now();return{companyId,agentId:b.agentId,runId:b.runId,toolName,invocationId:randomUUID(),startedAt,assignment:{valid:true,names,pinned:{version:1,agentId:b.agentId,connections:[],tools:[],pluginTools:names}},policyInput:{companyId,actor:{actorType:'agent',actorId:b.agentId,agentId:b.agentId},runContext:{heartbeatRunId:b.runId,issueId:b.issueId,projectId},request:{toolName,upstreamToolName:toolName,providerType:'paperclip_plugin',riskLevel:'destructive',sideEffecting:true,arguments:{binding:config.fundingDiscovery.key}}}};
 }
 return{companyId,projectId,scout,diligence,config,calls,gateway,binding,assigned,policyInput,saveConfig:()=>db.update(s.pluginConfig).set({configJson:config}).where(and(eq(s.pluginConfig.pluginId,pluginId),eq(s.pluginConfig.companyId,companyId)))};
}
test('actual executor scout catalog carries the configured deadline through assigned gateway and RPC',async()=>{
 const f=await fixture(),assigned=await f.assigned(),a=await readNativeDiscoveryAdmission(db,f.binding(),f.scout.policy,null),authority=new PaperclipRunnerToolAuthority(db,{...f.binding(),nativeFundingPolicy:{...f.scout.policy,companyId:f.companyId,agentId:f.scout.agentId},nativeDiscoveryAdmission:a,assignedMcpTools:assigned});
 const names=nativeDiscoveryToolNames(a);assert.deepEqual((await authority.definitions()).map(t=>t.name).sort(),names.sort());
 for(const tool of names)await authority.execute({tool,callId:randomUUID(),arguments:{binding:f.config.fundingDiscovery.key,...(tool.includes('submit')?{urls:[]}:{} )}});
 assert.equal(f.calls.length,2);for(const call of f.calls)assert(call.rpcTimeoutMs>60000&&call.rpcTimeoutMs<=100000,'configured research budget must replace old30s RPC');
 assert.equal(f.calls[0].params.runContext.fundingExecution,undefined);assert.equal(f.calls[0].params.runContext.nativeInertiaExecution,undefined,'resource metadata remains dispatcher-only');
});
test('configured scout budgets use source policy and retain exact overhead through validation',async()=>{
 const f=await fixture();for(const budget of[1000,600000,undefined]){if(budget===undefined)delete f.config.fundingDiscovery.runBudgetMs;else f.config.fundingDiscovery.runBudgetMs=budget;await f.saveConfig();for(const toolName of DISCOVERY_CANONICAL_TOOLS.scout){const i=f.policyInput('scout',toolName),p=await resolveNativeInertiaExecutionPolicy(db,i);assert(p);assert.equal(p.role,'scout');assert.equal(p.operationTimeoutMs,budget??120000);assert.equal(p.operationDeadlineAt,i.startedAt+(budget??120000));assert.equal(p.rpcDeadlineAt,p.operationDeadlineAt+40000);assert.equal(p.gatewayDeadlineAt,p.operationDeadlineAt+50000);assert.equal(validateNativeInertiaExecutionPolicy(p,toolName,{companyId:f.companyId,agentId:f.scout.agentId,runId:f.scout.runId,projectId:f.projectId}),p);}
 const assigned=await f.assigned(),name=assigned.definitions().find(t=>t.name.includes('funding_discovery_context')).name;await assigned.execute({tool:name,arguments:{binding:f.config.fundingDiscovery.key}});const timeout=f.calls.at(-1).rpcTimeoutMs;assert(timeout>(budget??120000)&&timeout<=(budget??120000)+40000);}
});
test('unadmitted diligence private and forged calls cannot acquire a scout deadline',async()=>{
 const f=await fixture();assert.equal(await resolveNativeInertiaExecutionPolicy(db,f.policyInput('diligence')),null);
 const original=structuredClone(f.config);for(const change of[c=>c.fundingDiscovery.enabled=false,c=>c.fundingDiscovery.runBudgetMs=600001,c=>c.fundingDiscovery.runBudgetMs=999,c=>c.fundingDiscovery.runBudgetMs=null,c=>c.fundingDiscovery.runBudgetMs='60000',c=>c.fundingDiscovery.agentId=randomUUID(),c=>c.fundingDiscovery.projectId=randomUUID()]){f.config=Object.assign(f.config,structuredClone(original));change(f.config);await f.saveConfig();let p;try{p=await resolveNativeInertiaExecutionPolicy(db,f.policyInput());}catch{p=null;}assert.equal(p,null);}
 Object.assign(f.config,original);await f.saveConfig();const i=f.policyInput();i.policyInput.request.arguments.binding='public-wrong-binding';assert.equal(await resolveNativeInertiaExecutionPolicy(db,i),null);
 for(const mutate of[i=>i.assignment.valid=false,i=>i.assignment.pinned.agentId=randomUUID(),i=>i.policyInput.runContext.issueId=randomUUID(),i=>i.policyInput.actor.agentId=randomUUID()]){const input=f.policyInput();mutate(input);assert.equal(await resolveNativeInertiaExecutionPolicy(db,input),null);}
 const untagged=await f.assigned('scout',false),name=untagged.definitions().find(t=>t.name.includes('funding_discovery_context')).name;await untagged.execute({tool:name,arguments:{binding:f.config.fundingDiscovery.key},nativeMcpExecution:true,nativeInertiaResources:true});assert.equal(f.calls.at(-1).rpcTimeoutMs,undefined,'model flags cannot create trusted native metadata');
 await db.delete(s.principalPermissionGrants).where(eq(s.principalPermissionGrants.principalId,f.scout.agentId));await db.delete(s.toolPolicies).where(eq(s.toolPolicies.companyId,f.companyId));await assert.rejects(()=>resolveNativeInertiaExecutionPolicy(db,f.policyInput()),/grant_denied/);
});
test('fresh private-preparation precedence denies an otherwise matching public scout admission',async()=>{
 const f=await fixture(),rootId=randomUUID();await db.insert(s.issues).values({id:rootId,companyId:f.companyId,projectId:f.projectId,title:'Synthetic private root',status:'in_progress'});await db.update(s.issues).set({parentId:rootId}).where(eq(s.issues.id,f.scout.issueId));
 f.scout.policy={version:1,role:'worker',projectIds:[f.projectId],issueIds:[rootId],portfolioRootIssueId:rootId};await db.update(s.agents).set({adapterConfig:{...f.scout.adapter,nativeFunding:f.scout.policy}}).where(eq(s.agents.id,f.scout.agentId));
 Object.assign(f.config.fundingDiscovery,{issueId:rootId,portfolioRootIssueId:rootId});f.config.fundingDiscovery.diligence.issueId=rootId;
 f.config.privatePreparation={enabled:true,projectId:f.projectId,portfolioRootIssueId:rootId,policyRevision:'synthetic-private',applicantSlug:'synthetic-applicant',matchId:randomUUID(),producer:{agentId:f.scout.agentId,principalId:f.scout.principalId,issueId:rootId},reviewer:{agentId:f.diligence.agentId,principalId:f.diligence.principalId,issueId:rootId}};await f.saveConfig();
 const{readPrivatePreparation}=await local('services/native-runtime/native-private-preparation.mjs');assert.equal((await readPrivatePreparation(db,f.binding(),f.scout.policy,null)).kind,'private-preparation');assert.equal((await readNativeDiscoveryAdmission(db,f.binding(),f.scout.policy,null)).role,'scout','overlap fixture must genuinely qualify discovery before precedence');assert.equal(await resolveNativeInertiaExecutionPolicy(db,f.policyInput()),null);
});
test('config changed between authoritative snapshots fails closed before dispatch',async()=>{
 const f=await fixture();let contexts=0;
 const racing=new Proxy(db,{get(target,key){if(key!=='select')return Reflect.get(target,key);return fields=>{const select=target.select(fields);if(fields?.actor!==s.agents||fields?.run!==s.heartbeatRuns)return select;const original=select.from.bind(select);select.from=(...args)=>{const query=original(...args),limit=query.limit.bind(query);query.limit=(...args)=>{if(++contexts!==2)return limit(...args);return(async()=>{f.config.fundingDiscovery.publicQueries=['changed synthetic public facet'];await f.saveConfig();return limit(...args);})();};return query;};return select;};}});
 await assert.rejects(()=>resolveNativeInertiaExecutionPolicy(racing,f.policyInput()),/scope_changed/);assert.equal(contexts,2);assert.equal(f.calls.length,0);
});
test('resource validator refuses forged scout identity, role and deadline without widening existing tools',async()=>{
 const f=await fixture(),i=f.policyInput(),p=await resolveNativeInertiaExecutionPolicy(db,i),run={companyId:f.companyId,agentId:f.scout.agentId,runId:f.scout.runId,projectId:f.projectId};assert(p);
 for(const change of[{role:'producer'},{agentId:randomUUID()},{operationTimeoutMs:600001},{rpcDeadlineAt:p.rpcDeadlineAt+1},{gatewayDeadlineAt:p.gatewayDeadlineAt+1},{extra:true},{toolName:'netrxn.inertia:funding-diligence-context'}])assert.throws(()=>validateNativeInertiaExecutionPolicy({...p,...change},i.toolName,run));
 for(const toolName of ['netrxn.inertia:funding-diligence-context','netrxn.inertia:funding_private_preparation','netrxn.inertia:unknown'])assert.equal(await resolveNativeInertiaExecutionPolicy(db,f.policyInput('scout',toolName)),null);
 assert.throws(()=>validateNativeInertiaExecutionPolicy(p,i.toolName,{...run,nativeInertiaExecution:p}));
 for(const toolName of ['netrxn.inertia:funding_case_work','netrxn.inertia:entity_context'])assert.throws(()=>validateNativeInertiaExecutionPolicy({...p,toolName,role:toolName.includes('entity')?'reader':'producer',operationTimeoutMs:600000,operationDeadlineAt:p.startedAt+600000,rpcDeadlineAt:p.startedAt+640000,gatewayDeadlineAt:p.startedAt+650000},toolName,run),'existing resource tools retain120s ceiling');
});
test('actual SDK harmless scout call beyond old10s gateway succeeds inside configured window',{timeout:25000},async()=>{
 const{createPluginWorkerManager}=await local('services/plugin-worker-manager.js'),wm=createPluginWorkerManager(),f=await fixture(wm),dir=await fs.mkdtemp('/tmp/scout-delayed-sdk-'),entrypointPath=dir+'/worker.mjs';
 await fs.writeFile(entrypointPath,`import{definePlugin,runWorker}from'/opt/host/node_modules/@paperclipai/plugin-sdk/dist/index.js';runWorker(definePlugin({setup(ctx){for(const name of ['funding-discovery-context','funding-discovery-submit'])ctx.tools.register(name,{displayName:name,description:'Synthetic harmless delayed call',parametersSchema:{type:'object',properties:{binding:{type:'string'},urls:{type:'array',items:{type:'string'}}},required:['binding'],additionalProperties:false}},async()=>{await new Promise(r=>setTimeout(r,11000));return{content:'Synthetic delayed success',data:{synthetic:true}};});}}),import.meta.url);`);
 f.config.fundingDiscovery.runBudgetMs=15000;await f.saveConfig();
 try{await wm.startWorker(pluginId,{entrypointPath,manifest,config:{},instanceInfo:{instanceId:'synthetic-scout-deadline',hostVersion:'2026.1012.0',deploymentMode:'local_trusted',deploymentExposure:'private'},apiVersion:1,hostHandlers:{},autoRestart:false});const assigned=await f.assigned(),name=assigned.definitions().find(t=>t.name.includes('funding_discovery_submit')).name,start=Date.now();const result=await assigned.execute({tool:name,arguments:{binding:f.config.fundingDiscovery.key,urls:[]}});assert.equal(result.result.data.synthetic,true);assert(Date.now()-start>=11000);assert(f.calls.at(-1).rpcTimeoutMs>15000);console.log(JSON.stringify({proof:'actual-sdk-scout-beyond-old-gateway',elapsedMs:Date.now()-start,providerStarted:false}));}finally{await wm.stopAll();await fs.rm(dir,{recursive:true,force:true});}
});

test('actual provider home keeps public scout live and private preparation web disabled',async()=>{
 const{prepareIsolatedCodexHome}=await local('vendor/paperclip-runner/drivers/runtime-context-materializer.js'),{publicScoutProjection}=await local('vendor/paperclip-runner/drivers/public-scout-projection.mjs');const dir=await fs.mkdtemp('/tmp/scout-web-regression-');try{for(const mode of['scout','private']){const home=dir+'/'+mode;await fs.mkdir(home);await prepareIsolatedCodexHome({codexHome:home,context:null,...(mode==='scout'?{publicScout:publicScoutProjection({version:1,role:'scout',key:'public-synthetic-deadline',bindingHash:'a'.repeat(64),publicQueries:['public civic grants']})}:{privatePreparation:{kind:'inertia-private-preparation-v1'}})});const text=await fs.readFile(home+'/config.toml','utf8');assert.equal(text.includes('web_search = "live"'),mode==='scout');assert.equal(text.includes('web_search = "disabled"'),mode==='private');assert(!text.includes('mcp_servers'));}}finally{await fs.rm(dir,{recursive:true,force:true});}
});
