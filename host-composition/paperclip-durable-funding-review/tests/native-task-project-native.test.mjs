/** Actual pinned native SQL and tool gateway; synthetic identities/worker response, no providers. */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
if(process.env.QUALIFY_DISPOSABLE!=='1'){
 test('actual native task/project qualification requires isolated disposable target',{skip:'Set QUALIFY_DISPOSABLE=1 in the documented offline container only'},()=>{});
}else{
 process.env.PAPERCLIP_API_URL='http://127.0.0.1:3100';
 const native=process.env.QUALIFICATION_NATIVE_ROOT??'/opt/host/node_modules';
 const load=p=>import(pathToFileURL(native+'/'+p));
 const source=process.env.QUALIFICATION_PUBLIC_ROOT??'/qual/source';
 const root='/tmp/inertia-native-task-project';await fs.mkdir(root,{recursive:true});
 await fs.symlink(native,root+'/node_modules').catch(e=>{if(e.code!=='EEXIST')throw e;});
 await fs.copyFile(source+'/host-composition/paperclip-durable-funding-review/transport/native/native-task-project-tools.mjs',root+'/native-task-project-tools.mjs');
 const m=await import(pathToFileURL(root+'/native-task-project-tools.mjs'));
 let PaperclipRunnerToolAuthority,installedServer;
 if(process.env.NATIVE_TASK_PROJECT_CANDIDATE){
  const installed=root+'/installed',server=installed+'/node_modules/@paperclipai/server';
  await fs.mkdir(server,{recursive:true});
  await fs.cp(native+'/@paperclipai/server/dist',server+'/dist',{recursive:true});
  await fs.copyFile(native+'/@paperclipai/server/package.json',server+'/package.json');
  for(const dependencyRoot of[native+'/@paperclipai/server/node_modules',native]){
   for(const name of await fs.readdir(dependencyRoot)){
    if(name==='@paperclipai'||name.startsWith('.'))continue;
    await fs.symlink(dependencyRoot+'/'+name,installed+'/node_modules/'+name).catch(e=>{if(e.code!=='EEXIST')throw e;});
   }
  }
  for(const name of await fs.readdir(native+'/@paperclipai'))if(name!=='server')await fs.symlink(native+'/@paperclipai/'+name,installed+'/node_modules/@paperclipai/'+name);
  await fs.cp(process.env.NATIVE_TASK_PROJECT_CANDIDATE+'/dist',server+'/dist',{recursive:true,force:true});
  installedServer=server;
  ({PaperclipRunnerToolAuthority}=await import(pathToFileURL(server+'/dist/services/native-runtime/paperclip-runner-tool-authority.js')));
 }
 const schema=await load('@paperclipai/db/dist/schema/index.js'),{and,eq,sql}=await load('drizzle-orm/index.js');
 const{startEmbeddedPostgresTestDatabase,createDb}=await load('@paperclipai/db/dist/index.js');
 const{createAssignedMcpTools,registerAssignedMcpGateway}=await load('@paperclipai/server/dist/services/native-runtime/assigned-mcp-tools.js');
 const{createPluginToolDispatcher}=await load('@paperclipai/server/dist/services/plugin-tool-dispatcher.js');
 const{createToolGatewayService}=await load('@paperclipai/server/dist/services/tool-gateway.js');
 const{buildPaperclipRuntimeMcpServers}=await load('@paperclipai/server/dist/services/heartbeat.js');
 const{manifest}=await import('file:///opt/inertia-reviewed/dist/src/manifest.js');
 let temporary,db;const pluginId=randomUUID();
 before(async()=>{temporary=await startEmbeddedPostgresTestDatabase('meeting-catalog-');db=createDb(temporary.connectionString);});
 after(async()=>{await temporary?.cleanup();});
 async function fixture(){
  const companyId=randomUUID(),projectId=randomUUID(),agentId=randomUUID(),issueId=randomUUID(),runId=randomUUID();
  const policy={version:1,role:'worker',projectIds:[randomUUID()],issueIds:[randomUUID()]};
  const adapterConfig={provider:'codex',engine:'cli',disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never',nativeFunding:policy,nativeTaskProjectTools:{version:1,projectIds:[projectId]}};
  await db.insert(schema.companies).values({id:companyId,name:'Synthetic meeting catalog',issuePrefix:'M'+companyId.replaceAll('-','').slice(0,8).toUpperCase()});
  await db.insert(schema.projects).values({id:projectId,companyId,name:'Controlled meeting follow-through'});
  await db.insert(schema.agents).values({id:agentId,companyId,name:'Reusable worker',role:'general',status:'running',adapterType:'paperclip_runner',adapterConfig});
  await db.insert(schema.issues).values({id:issueId,companyId,projectId,title:'Controlled source extraction',status:'in_progress',assigneeAgentId:agentId});
  await db.insert(schema.heartbeatRuns).values({id:runId,companyId,agentId,nativeIssueId:issueId,runtimeMode:'native',status:'running',contextSnapshot:{issueId,projectId}});
  await db.update(schema.issues).set({executionRunId:runId,checkoutRunId:runId}).where(eq(schema.issues.id,issueId));
  const config={roundtable:{enabled:true,admission:'synthetic-canary',origin:'https://controlled.example',principalId:'fixture-only',meetings:[{meetingId:'synthetic-meeting',fileId:'synthetic-document',withdrawn:false,nativeExtraction:{projectId,issueId,agentId}}]}};
  const names=m.TASK_PROJECT_CANONICAL_TOOLS.extractor;
  assert(manifest.tools.length>names.length,'Use the actual complete plugin manifest, not a reduced meeting-only catalog');
  await db.insert(schema.plugins).values({id:pluginId,pluginKey:'netrxn.inertia',packageName:'synthetic-meeting-catalog',version:'0.1.0',status:'ready',manifestJson:manifest}).onConflictDoNothing();
  await db.insert(schema.pluginConfig).values({pluginId,companyId,configJson:config});
  await db.insert(schema.principalPermissionGrants).values({companyId,principalType:'agent',principalId:agentId,permissionKey:'tools:use',scope:{allow:names.map(n=>'tool:'+n)}});
  for(const toolName of names)await db.insert(schema.toolPolicies).values({companyId,name:'Exact meeting fixture '+toolName,policyType:'allow',enabled:true,priority:10,selectors:{toolName},config:{}});
  const calls=[];
  const dispatcher=createPluginToolDispatcher({workerManager:{isRunning:()=>true,call:async(_plugin,method,params)=>{assert.equal(method,'executeTool');calls.push(params);return{data:{synthetic:true}};}}});
  dispatcher.registerPluginTools('netrxn.inertia',manifest,pluginId);
  const gateway=createToolGatewayService(db,{pluginToolDispatcher:dispatcher});registerAssignedMcpGateway(db,gateway);
  const[server]=await buildPaperclipRuntimeMcpServers({db,agent:{id:agentId,companyId,name:'Reusable worker',adapterType:'paperclip_runner'},runId});assert(server);
  const gatewayPublicId=new URL(server.url).pathname.match(/\/mcp\/gateways\/([^/]+)$/)?.[1];assert(gatewayPublicId);
  const assignedMcpTools=await createAssignedMcpTools({gateway,gatewayPublicId,bearerToken:server.token,workMode:'standard'});
  const binding={companyId,projectId,issueId,agentId,runId};
  const admission=await m.readTaskProjectAdmission(db,binding,policy,null);
  const bound={...binding,nativeTaskProjectAdmission:admission,assignedMcpTools};
  const current=async()=>{
   const[actor]=await db.select().from(schema.agents).where(eq(schema.agents.id,agentId));
   const[issue]=await db.select().from(schema.issues).where(eq(schema.issues.id,issueId));
   const[run]=await db.select().from(schema.heartbeatRuns).where(eq(schema.heartbeatRuns.id,runId));
   return m.assertFreshTaskProject(db,bound,{actor,issue,run});
  };
  return{...binding,policy,adapterConfig,config,calls,bound,current,server,gateway,save:()=>db.update(schema.pluginConfig).set({configJson:config}).where(and(eq(schema.pluginConfig.pluginId,pluginId),eq(schema.pluginConfig.companyId,companyId)))};
 }
 test('real native SQL selection and projected gateway catalog dispatch use the current actor/task/run',async()=>{
  const f=await fixture(),tools=await m.taskProjectDefinitions(f.bound,f.current);assert.equal(tools.length,2);
  const call={tool:tools[0].name,callId:randomUUID(),arguments:{meetingId:'synthetic-meeting'}};
  const authority=PaperclipRunnerToolAuthority?new PaperclipRunnerToolAuthority(db,{...f.bound,nativeFundingPolicy:{...f.policy,role:'producer',companyId:f.companyId,agentId:f.agentId}}):null;
  if(authority){assert.deepEqual((await authority.definitions()).map(t=>t.name),tools.map(t=>t.name));await assert.rejects(()=>authority.execute({tool:'call_api',callId:randomUUID(),arguments:{}}));}
  const result=authority?await authority.execute(call):await m.executeTaskProjectTool(f.bound,call,f.current);
  assert.equal(result.result?.data?.synthetic,true,JSON.stringify(result));assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].runContext.companyId,f.companyId);assert.equal(f.calls[0].runContext.agentId,f.agentId);assert.equal(f.calls[0].runContext.runId,f.runId);assert.equal(f.calls[0].runContext.fundingExecution,undefined);
  const rows=await db.select().from(schema.toolInvocations).where(eq(schema.toolInvocations.agentId,f.agentId));assert(rows.some(r=>r.status==='succeeded'&&r.issueId===f.issueId&&r.runId===f.runId));
 });
 test('actual gateway revocation and source withdrawal remove the active catalog',async()=>{
  const f=await fixture();assert.equal((await m.taskProjectDefinitions(f.bound,f.current)).length,2);
  await db.delete(schema.principalPermissionGrants).where(eq(schema.principalPermissionGrants.principalId,f.agentId));
  await db.delete(schema.toolPolicies).where(eq(schema.toolPolicies.companyId,f.companyId));
  await assert.rejects(()=>m.taskProjectDefinitions(f.bound,f.current),/native_task_project_admission_denied/);assert.equal(f.calls.length,0);
  f.config.roundtable.meetings[0].withdrawn=true;await f.save();await assert.rejects(()=>f.current(),/native_task_project_admission_denied/);
 });
 test('existing persisted objective mapping grants GENERAL Coordinator only read-only source context',async()=>{
  const f=await fixture(),adapter={...f.adapterConfig,nativeFunding:undefined,nativeCoordinator:{version:1,projectIds:[f.projectId]}};
  delete adapter.nativeFunding;await db.update(schema.agents).set({role:'ceo',adapterConfig:adapter}).where(eq(schema.agents.id,f.agentId));
  const c=f.config.roundtable;c.meetings[0].nativeExtraction={projectId:f.projectId,issueId:randomUUID(),agentId:randomUUID()};
  c.nativeIntake={organizationId:'synthetic-org',projectId:f.projectId,intakeAgentId:f.agentId,referenceOnly:true,sourceAccess:true};await f.save();
  const [key]=m.taskProjectMappingKeys(f.companyId,c),marker='a'.repeat(64),{createHash}=await import('node:crypto');
  const sourceId=createHash('sha256').update(JSON.stringify([f.companyId,c.origin,c.principalId,c.meetings[0].meetingId])).digest('hex');
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "plugin_netrxn_inertia_e936d62b87"`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS "plugin_netrxn_inertia_e936d62b87".objective_intake (mapping_key text PRIMARY KEY, record jsonb)`);
  const record={key,companyId:f.companyId,nativeIssueId:f.issueId,pending:false,marker,snapshot:{organizationId:'synthetic-org',sourceSystem:'inertia-roundtable',sourceId,audience:'restricted',withdrawn:false}};
  await db.execute(sql`INSERT INTO "plugin_netrxn_inertia_e936d62b87".objective_intake (mapping_key,record) VALUES (${key},${JSON.stringify(record)}::jsonb)`);
  await db.update(schema.issues).set({originKind:'plugin:netrxn.inertia:objective',originId:key,description:'Objective source revision: '+marker}).where(eq(schema.issues.id,f.issueId));
  const admission=await m.readTaskProjectAdmission(db,f,null,null);assert.equal(admission.role,'reader');assert.equal(m.taskProjectToolNames(admission).length,1);
  if(PaperclipRunnerToolAuthority){
   const authority=new PaperclipRunnerToolAuthority(db,{...f.bound,nativeTaskProjectAdmission:admission,nativeCoordinatorPolicy:{...adapter.nativeCoordinator,companyId:f.companyId,agentId:f.agentId}});
   const tools=await authority.definitions();assert(tools.some(t=>t.name==='create_task'));assert(tools.some(t=>t.name==='get_task_context'));
   assert(!tools.some(t=>['call_api','hire_agent','search_api'].includes(t.name)));assert.equal(tools.filter(t=>t.name.startsWith('app_')).length,1);
   assert(tools.find(t=>t.name==='get_task_context').inputSchema.properties.targetTaskId,'Existing Coordinator target-task read schema must remain intact');
   await authority.execute({tool:m.taskProjectToolNames(admission)[0],callId:randomUUID(),arguments:{meetingRef:sourceId}});assert.equal(f.calls.length,1);
   await assert.rejects(()=>authority.execute({tool:m.taskProjectToolNames({role:'extractor'})[1],callId:randomUUID(),arguments:{}}));
  }
  record.pending=true;await db.execute(sql`UPDATE "plugin_netrxn_inertia_e936d62b87".objective_intake SET record=${JSON.stringify(record)}::jsonb WHERE mapping_key=${key}`);
  assert.equal(await m.readTaskProjectAdmission(db,f,null,null),null);
 });
 test('actual executor construction exposes local meeting tools and removes duplicate raw MCP launch binding',{skip:!installedServer},async()=>{
  const f=await fixture();
  const executor=await fs.readFile(installedServer+'/dist/services/native-runtime/native-session-executor.js','utf8');
  const start=executor.indexOf('    const rawFundingPolicy ='),end=executor.indexOf('    const coordinator =',start);assert(start>=0&&end>start);
  const{getAssignedMcpGateway}=await load('@paperclipai/server/dist/services/native-runtime/assigned-mcp-tools.js');
  const{readNativeDiscoveryAdmission}=await import(pathToFileURL(installedServer+'/dist/services/native-runtime/native-discovery-policy.mjs'));
  const input={db,execution:{binding:f,provider:{kind:'codex',approvalPolicy:'never',nativeFundingPolicy:f.policy},task:{workMode:'standard'}},runnerEnvironment:{PAPERCLIP_NATIVE_MCP_NAME:f.server.name,PAPERCLIP_NATIVE_MCP_URL:f.server.url,PAPERCLIP_NATIVE_MCP_TOKEN:f.server.token}};
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const seam=await new AsyncFunction('input','remoteTarget','nativeReview','readTaskProjectAdmission','readNativeDiscoveryAdmission','createAssignedMcpTools','getAssignedMcpGateway',executor.slice(start,end)+'\nreturn {relayAssignedMcp,assignedMcpTools,nativeTaskProjectAdmission};')(input,null,null,m.readTaskProjectAdmission,readNativeDiscoveryAdmission,createAssignedMcpTools,getAssignedMcpGateway);
  assert.equal(seam.relayAssignedMcp,true);assert.equal(seam.nativeTaskProjectAdmission.role,'extractor');assert.equal((await seam.assignedMcpTools.definitionsFresh()).length,2);
  const scrubStart=executor.indexOf('    if (relayAssignedMcp || funding?.role === "reviewer")'),scrubEnd=executor.indexOf('    // This authority bit',scrubStart);assert(scrubStart>=0&&scrubEnd>scrubStart);
  const env={PAPERCLIP_NATIVE_MCP_NAME:'synthetic',PAPERCLIP_NATIVE_MCP_URL:'http://private.invalid',PAPERCLIP_NATIVE_MCP_TOKEN:'synthetic',KEEP:'yes'};
  new Function('effectiveRunnerEnvironmentBase','relayAssignedMcp','funding',executor.slice(scrubStart,scrubEnd))(env,true,{role:'producer'});assert.deepEqual(env,{KEEP:'yes'});
 });
 test('actual SQL project purpose selects research children and preserves preparation/review routing',{skip:!installedServer},async()=>{
  const f=await fixture(),rootId=randomUUID(),rootProjectId=randomUUID();
  await db.insert(schema.projects).values({id:rootProjectId,companyId:f.companyId,name:'Synthetic funding purpose'});
  await db.insert(schema.issues).values({id:rootId,companyId:f.companyId,projectId:rootProjectId,title:'Synthetic portfolio',status:'in_progress'});
  const policy={version:1,role:'worker',projectIds:[rootProjectId,f.projectId].sort(),issueIds:[rootId],portfolioRootIssueId:rootId};
  await db.update(schema.agents).set({adapterConfig:{...f.adapterConfig,nativeFunding:policy}}).where(eq(schema.agents.id,f.agentId));
  await db.update(schema.issues).set({parentId:rootId}).where(eq(schema.issues.id,f.issueId));
  f.config.fundingDiscovery={enabled:true,key:'synthetic-research',organizationId:'synthetic-org',projectId:f.projectId,rootProjectId,issueId:rootId,portfolioRootIssueId:rootId,agentId:f.agentId,principalId:'synthetic-alpha',process:{fixture:true},publicQueries:['public grants']};await f.save();
  const{readNativeDiscoveryAdmission}=await import(pathToFileURL(installedServer+'/dist/services/native-runtime/native-discovery-policy.mjs'));
  const read=(review=null)=>readNativeDiscoveryAdmission(db,f,policy,review);
  assert.equal((await read()).role,'scout');assert.equal(await read({nativeReviewInteractionId:'fixture'}),null);
  await db.update(schema.issues).set({projectId:rootProjectId}).where(eq(schema.issues.id,f.issueId));assert.equal(await read(),null,'Funding purpose retains preparation route');
  await db.update(schema.issues).set({projectId:f.projectId}).where(eq(schema.issues.id,f.issueId));
  delete f.config.fundingDiscovery.rootProjectId;await f.save();await assert.rejects(read,/denied/);
  f.config.fundingDiscovery.rootProjectId=rootProjectId;await f.save();
  await db.update(schema.issues).set({hiddenAt:new Date()}).where(eq(schema.issues.id,rootId));await assert.rejects(read,/denied/);
 });


 test('actual enrichment catalog dispatch binds current direct child and revokes without raw API',{skip:!installedServer},async()=>{
  const f=await fixture(),rootId=randomUUID(),rootProjectId=randomUUID();
  await db.insert(schema.projects).values({id:rootProjectId,companyId:f.companyId,name:'Controlled enrichment root purpose'});
  await db.insert(schema.issues).values({id:rootId,companyId:f.companyId,projectId:rootProjectId,title:'Controlled full portfolio',status:'in_progress'});
  const policy={version:1,role:'worker',projectIds:[rootProjectId,f.projectId].sort(),issueIds:[rootId],portfolioRootIssueId:rootId};
  await db.update(schema.agents).set({adapterConfig:{...f.adapterConfig,nativeFunding:policy}}).where(eq(schema.agents.id,f.agentId));
  await db.update(schema.issues).set({parentId:rootId}).where(eq(schema.issues.id,f.issueId));
  f.config.generalEnrichment={enabled:true,applicantSlug:'synthetic',projectId:f.projectId,rootIssueId:rootId,rootProjectId,producer:{agentId:f.agentId,principalId:f.agentId},reviewer:{agentId:randomUUID(),principalId:randomUUID()},process:{fixture:true}};await f.save();
  const toolName='netrxn.inertia:funding_enrichment';assert(manifest.tools.some(t=>t.name==='funding_enrichment'),'Actual complete installed manifest must declare the new tool');
  await db.update(schema.principalPermissionGrants).set({scope:{allow:['tool:'+toolName]}}).where(eq(schema.principalPermissionGrants.principalId,f.agentId));
  await db.insert(schema.toolPolicies).values({companyId:f.companyId,name:'Exact controlled enrichment',policyType:'allow',enabled:true,priority:10,selectors:{toolName},config:{}});
  const e=await import(pathToFileURL(installedServer+'/dist/services/native-runtime/native-enrichment-tools.mjs'));
  const admission=await e.readTaskProjectAdmission(db,f,policy,null);assert.equal(admission.kind,'enrichment');
  const [freshServer]=await buildPaperclipRuntimeMcpServers({db,agent:{id:f.agentId,companyId:f.companyId,name:'Reusable worker',adapterType:'paperclip_runner'},runId:f.runId});
  const freshGatewayId=new URL(freshServer.url).pathname.match(/\/mcp\/gateways\/([^/]+)$/)?.[1];assert(freshGatewayId);
  const assigned=await createAssignedMcpTools({gateway:f.gateway,gatewayPublicId:freshGatewayId,bearerToken:freshServer.token,workMode:'standard'});
  const bound={...f.bound,assignedMcpTools:assigned,nativeTaskProjectAdmission:admission,nativeFundingPolicy:{...policy,role:'producer',companyId:f.companyId,agentId:f.agentId}};
  const authority=new PaperclipRunnerToolAuthority(db,bound),tools=await authority.definitions();assert.equal(tools.length,1);assert.match(tools[0].name,/funding_enrichment/);
  await assert.rejects(()=>authority.execute({tool:'call_api',callId:randomUUID(),arguments:{}}));
  const result=await authority.execute({tool:tools[0].name,callId:randomUUID(),arguments:{operation:'context',parameters:{}}});assert.equal(result.result.data.synthetic,true);assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].runContext.runId,f.runId);assert.equal(f.calls[0].runContext.agentId,f.agentId);
  const calls=await db.select().from(schema.toolInvocations).where(eq(schema.toolInvocations.agentId,f.agentId));assert(calls.some(c=>c.status==='succeeded'&&c.issueId===f.issueId&&c.runId===f.runId));
  await db.update(schema.issues).set({hiddenAt:new Date()}).where(eq(schema.issues.id,rootId));await assert.rejects(()=>authority.definitions(),/denied/);assert.equal(f.calls.length,1);
 });

}
