// Actual pinned runtime construction, Codex config generation and gateway dispatch.
// All identities/grants are synthetic and confined to an in-memory database.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
process.env.PAPERCLIP_API_URL='http://127.0.0.1:3100';
const publicRoot=process.env.QUALIFICATION_PUBLIC_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const {nativeDatabase,nativeIdentityFixture,loadNative,schema,eq}=await import(pathToFileURL(path.join(publicRoot,'scripts/drafting-qualification/native-fixture.mjs')).href);
const {buildPaperclipRuntimeMcpServers,createManagedMcpRunConfig}=await loadNative('@paperclipai/server/dist/services/heartbeat.js');
const {resolveNativeRuntimeMcpSnapshot}=await loadNative('@paperclipai/server/dist/services/native-runtime/runtime-context.js');
const {registerAssignedMcpGateway,createAssignedMcpTools}=await loadNative('@paperclipai/server/dist/services/native-runtime/assigned-mcp-tools.js');
const {createToolGatewayService}=await loadNative('@paperclipai/server/dist/services/tool-gateway.js');
const {createPluginToolDispatcher}=await loadNative('@paperclipai/server/dist/services/plugin-tool-dispatcher.js');
const {mergeManagedCodexMcpGateways,writeManagedCodexMcpConfig}=await loadNative('@paperclipai/adapter-codex-local/dist/server/codex-home.js');

const pluginKey='netrxn.runtime-fixture';
const allowedTool=`${pluginKey}:read-workspace`;
const otherTool=`${pluginKey}:read-other`;
async function fixture(){
 const database=await nativeDatabase();
 const identity=await nativeIdentityFixture(database.db);
 const {db}=database;
 await db.delete(schema.toolPolicies).where(eq(schema.toolPolicies.companyId,identity.companyId));
 const pluginId=randomUUID(),calls=[];
 const manifest={id:pluginKey,apiVersion:1,version:'0.0.0',capabilities:['agent.tools.register'],tools:[
  {name:'read-workspace',displayName:'Read workspace',description:'Fixture read',parametersSchema:{type:'object',additionalProperties:false,properties:{purpose:{type:'string'}}}},
  {name:'read-other',displayName:'Read other',description:'Unassigned fixture read',parametersSchema:{type:'object',additionalProperties:false,properties:{purpose:{type:'string'}}}},
 ]};
 await db.insert(schema.plugins).values({id:pluginId,pluginKey,packageName:'fixture-runtime',version:'0.0.0',status:'ready',manifestJson:manifest});
 // The only substitute is the remote worker boundary. Registry, policy, run binding,
 // assignment, bearer minting and gateway invocation are real pinned implementations.
 const dispatcher=createPluginToolDispatcher({workerManager:{isRunning:id=>id===pluginId,call:async(id,method,params)=>{
  assert.equal(id,pluginId);assert.equal(method,'executeTool');calls.push(structuredClone(params));return {content:'Fixture workspace',data:{native:params.runContext}};
 }}});
 dispatcher.registerPluginTools(pluginKey,manifest,pluginId);
 const gateway=createToolGatewayService(db,{pluginToolDispatcher:dispatcher,toolActionSigningSecret:'fixture-only-not-a-real-secret-0123456789'});
 registerAssignedMcpGateway(db,gateway);
 const agent={id:identity.producer.agentId,companyId:identity.companyId,name:'Fixture producer',adapterType:'codex_local'};
 const input={db,agent,runId:identity.producer.runId};
 const grant=async(tool=allowedTool)=>{const [row]=await db.insert(schema.principalPermissionGrants).values({companyId:identity.companyId,principalType:'agent',principalId:agent.id,permissionKey:'tools:use',scope:{allow:[`tool:${tool}`]}}).returning();return row;};
 return {...database,...identity,agent,input,gateway,dispatcher,calls,grant};
}
function serverBinding(server){return {gatewayPublicId:new URL(server.url).pathname.split('/').at(-1),bearerToken:server.token};}

test('plugin-only granted tools reach actual runtime assignment and generated Codex MCP config',async()=>{
 const f=await fixture();const home=await fs.mkdtemp(path.join(os.tmpdir(),'plugin-only-codex-'));
 try{
  await f.grant();
  const snapshot=await resolveNativeRuntimeMcpSnapshot(f.input);
  const servers=await buildPaperclipRuntimeMcpServers(f.input);
  assert.equal(servers.length,1,'plugin-only runtime must produce its existing aggregate MCP delivery');
  assert.equal(snapshot.bindingId,`native-mcp:${f.input.runId}`);
  assert.equal(servers[0].connectionId,`assignment:${snapshot.digest}`);
  const managed=await createManagedMcpRunConfig({...f.input,config:{},projectId:f.projectId,issueId:f.producer.issueId});
  assert.equal(managed,null,'ordinary managed gateways must not become wildcard plugin delivery');
  const gateways=mergeManagedCodexMcpGateways(servers.map(s=>({name:s.name,endpointPath:s.url,bearerToken:s.token})),managed?.gateways??[]);
  const result=await writeManagedCodexMcpConfig({codexHome:home,apiBaseUrl:'http://127.0.0.1:3100',gateways});
  const config=await fs.readFile(result.configPath,'utf8');
  assert.ok(config.includes(servers[0].url));assert.ok(config.includes('Bearer '+servers[0].token));
  const binding=serverBinding(servers[0]);
  const visible=await f.gateway.listToolsForNamedGateway(binding);
  assert.deepEqual(visible.map(t=>t.name),[allowedTool]);
  const response=await f.gateway.executeTool({gatewayPublicId:binding.gatewayPublicId,sessionToken:binding.bearerToken,tool:allowedTool,parameters:{},runContext:{companyId:'caller-company',agentId:'caller-agent',runId:'caller-run',projectId:'caller-project'}});
  assert.equal(response.status,'completed');
  assert.deepEqual(f.calls[0].runContext,{agentId:f.agent.id,runId:f.producer.runId,companyId:f.companyId,projectId:f.projectId});
  const runner=await createAssignedMcpTools({gateway:f.gateway,...binding});
  assert.equal(runner.definitions().length,1);
 }finally{await fs.rm(home,{recursive:true,force:true});await f.client.close();}
});

async function profileGrant(f,entries){
 const [profile]=await f.db.insert(schema.toolProfiles).values({companyId:f.companyId,profileKey:randomUUID(),name:'Fixture profile '+randomUUID(),status:'active',defaultAction:'deny'}).returning();
 await f.db.insert(schema.toolProfileEntries).values(entries.map(entry=>({...entry,companyId:f.companyId,profileId:profile.id})));
 await f.db.insert(schema.toolProfileBindings).values({companyId:f.companyId,profileId:profile.id,targetType:'agent',targetId:f.agent.id});
 return profile;
}
async function connectionFixture(f,{grant=false,full=false,installed=true}={}){
 const [app]=await f.db.insert(schema.toolApplications).values({companyId:f.companyId,name:'Fixture remote',applicationKey:'fixture',type:'mcp_http'}).returning();
 const [connection]=await f.db.insert(schema.toolConnections).values({companyId:f.companyId,applicationId:app.id,name:'Fixture remote',uid:randomUUID(),transport:'mcp_remote',status:'active',enabled:true,healthStatus:'healthy',config:{url:'https://fixture.invalid/mcp'}}).returning();
 const entries=await f.db.insert(schema.toolCatalogEntries).values(['first','second'].map(name=>({companyId:f.companyId,applicationId:app.id,connectionId:connection.id,name,toolName:name,versionHash:'fixture-v1',inputSchema:{type:'object',properties:{}}}))).returning();
 if(installed)await f.db.insert(schema.toolConnectionInstalls).values({companyId:f.companyId,connectionId:connection.id,targetType:'agent',targetId:f.agent.id});
 if(grant)await profileGrant(f,[{selectorType:full?'connection':'catalog_entry',effect:'include',applicationId:app.id,connectionId:connection.id,...(!full?{catalogEntryId:entries[0].id}:{})}]);
 return {connection,entries,app};
}
async function broadPolicy(f){return f.db.insert(schema.toolPolicies).values({companyId:f.companyId,name:'Fixture broad policy',policyType:'allow',enabled:true,priority:1,selectors:{},config:{}});}
async function bindingFor(f){return serverBinding((await buildPaperclipRuntimeMcpServers(f.input))[0]);}
async function list(f,binding){return (await f.gateway.listToolsForNamedGateway(binding)).map(t=>t.name).sort();}
async function call(f,binding,tool=allowedTool,extra={}){return f.gateway.executeTool({gatewayPublicId:binding.gatewayPublicId,sessionToken:binding.bearerToken,tool,parameters:{},...extra});}

test('no tools and missing registered gateway deliver nothing; wrong agent/run cannot mint plugin delivery',async()=>{
 const f=await fixture();try{
  assert.deepEqual(await buildPaperclipRuntimeMcpServers(f.input),[]);
  const snapshot=await resolveNativeRuntimeMcpSnapshot(f.input);assert.equal(snapshot.bindingId,null);
  const original=createHash('sha256').update(JSON.stringify({version:1,agentId:f.agent.id,connections:[],tools:[]})).digest('hex');assert.equal(snapshot.digest,original);
  await f.grant();
  await assert.rejects(buildPaperclipRuntimeMcpServers({...f.input,runId:f.reviewer.runId}));
  await assert.rejects(resolveNativeRuntimeMcpSnapshot({...f.input,runId:f.reviewer.runId}));
  registerAssignedMcpGateway(f.db,undefined);
  assert.deepEqual(await buildPaperclipRuntimeMcpServers(f.input),[]);
 }finally{await f.client.close();}
});

test('profile revocation, block policy and dispatcher unload apply to already-issued tokens',async()=>{
 const f=await fixture();try{
  const profile=await profileGrant(f,[{selectorType:'tool_name',effect:'include',toolName:allowedTool}]);
  const binding=await bindingFor(f);assert.deepEqual(await list(f,binding),[allowedTool]);
  await f.db.delete(schema.toolProfileBindings).where(eq(schema.toolProfileBindings.profileId,profile.id));
  assert.deepEqual(await list(f,binding),[]);await assert.rejects(call(f,binding));assert.equal(f.calls.length,0);
  await f.grant();assert.deepEqual(await list(f,binding),[allowedTool]);
  const [policy]=await f.db.insert(schema.toolPolicies).values({companyId:f.companyId,name:'Fixture block',policyType:'block',enabled:true,priority:0,selectors:{toolName:allowedTool},config:{}}).returning();
  assert.deepEqual(await list(f,binding),[]);await assert.rejects(call(f,binding));
  await f.db.delete(schema.toolPolicies).where(eq(schema.toolPolicies.id,policy.id));
  f.dispatcher.unregisterPluginTools(pluginKey);
  assert.deepEqual(await list(f,binding),[]);await assert.rejects(call(f,binding));assert.equal(f.calls.length,0);
 }finally{await f.client.close();}
});

test('plugin-only assignment excludes new tools, builtins and ordinary connections even under broad policy',async()=>{
 const f=await fixture();try{
  await f.grant();const snapshot=await resolveNativeRuntimeMcpSnapshot(f.input);const binding=await bindingFor(f);
  const {entries}=await connectionFixture(f,{grant:true});
  await broadPolicy(f);
  assert.deepEqual(await list(f,binding),[allowedTool]);
  await assert.rejects(call(f,binding,otherTool),error=>error.reasonCode==='deny_runtime_assignment');
  const ordinarySession=await f.gateway.createSession({companyId:f.companyId,agentId:f.agent.id,runId:f.producer.runId});
  const outside=(await f.gateway.listToolsForSession(ordinarySession.token)).find(tool=>tool.catalogEntryId===entries[0].id);
  assert.ok(outside,'fixture ordinary tool exists and is currently authorized outside this pin');
  await assert.rejects(call(f,binding,outside.name),error=>error.reasonCode==='deny_runtime_assignment');
  const newServers=await buildPaperclipRuntimeMcpServers({...f.input,expectedAssignmentDigest:snapshot.digest});assert.deepEqual(newServers,[],'changed assignments cannot realize against the old snapshot');
  const [gateway]=await f.db.select().from(schema.toolMcpGateways).where(eq(schema.toolMcpGateways.gatewayPublicId,binding.gatewayPublicId));
  for(const pin of [[],null,'*']){
   await f.db.update(schema.toolMcpGateways).set({metadata:{...gateway.metadata,runtimePluginTools:pin}}).where(eq(schema.toolMcpGateways.id,gateway.id));
   assert.deepEqual(await list(f,binding),[]);await assert.rejects(call(f,binding));
  }
  assert.equal(f.calls.length,0);assert.equal(entries.length,2);
 }finally{await f.client.close();}
});

test('mixed assignment keeps catalog-only connection scope and excludes sibling tools',async()=>{
 const f=await fixture();try{
  await f.grant();const {connection,entries}=await connectionFixture(f,{grant:true});
  const snapshot=await resolveNativeRuntimeMcpSnapshot(f.input);const servers=await buildPaperclipRuntimeMcpServers({...f.input,expectedAssignmentDigest:snapshot.digest});
  assert.equal(servers.length,1);assert.equal(servers[0].connectionId,`assignment:${snapshot.digest}`);
  const binding=serverBinding(servers[0]);
  let tools=await f.gateway.listToolsForNamedGateway(binding);
  assert.equal(tools.length,2);assert.equal(tools.filter(t=>t.connectionId===connection.id).length,1);assert.equal(tools.find(t=>t.connectionId)?.catalogEntryId,entries[0].id);
  await broadPolicy(f);tools=await f.gateway.listToolsForNamedGateway(binding);
  assert.equal(tools.length,2);assert.ok(!tools.some(t=>t.catalogEntryId===entries[1].id));
  const ordinaryName=tools.find(t=>t.connectionId).name;
  const siblingName=ordinaryName.replace(/:first$/,':second');
  await assert.rejects(call(f,binding,siblingName),error=>error.reasonCode==='deny_runtime_assignment');
 }finally{await f.client.close();}
});

test('connection-only assignment preserves digest and managed-gateway delivery; uninstalled connections stay excluded',async()=>{
 const f=await fixture();try{
  const {connection,entries}=await connectionFixture(f,{grant:true});
  const snapshot=await resolveNativeRuntimeMcpSnapshot(f.input);
  const expected=createHash('sha256').update(JSON.stringify({version:1,agentId:f.agent.id,connections:[connection.id],tools:[entries[0].id]})).digest('hex');assert.equal(snapshot.digest,expected);
  const servers=await buildPaperclipRuntimeMcpServers(f.input);assert.equal(servers[0].connectionId,`assignment:${expected}`);
  const binding=serverBinding(servers[0]);assert.equal((await list(f,binding)).length,1);
  const [profile]=await f.db.select().from(schema.toolProfiles).where(eq(schema.toolProfiles.profileKey,`native:${f.agent.id}:${expected}`));
  assert.ok(!Object.hasOwn(profile.metadata,'runtimePluginTools'));
  const shared=await profileGrant(f,[{selectorType:'catalog_entry',effect:'include',applicationId:connection.applicationId,connectionId:connection.id,catalogEntryId:entries[0].id}]);
  await f.gateway.createNamedGateway({companyId:f.companyId,body:{name:'Fixture explicit gateway',slug:'fixture-explicit',profileId:shared.id,defaultProfileMode:'gateway_only',agentId:f.agent.id},actor:{agentId:f.agent.id}});
  const managed=await createManagedMcpRunConfig({...f.input,config:{},projectId:f.projectId,issueId:f.producer.issueId});assert.equal(managed.gateways.length,1);
  await f.db.delete(schema.toolConnectionInstalls).where(eq(schema.toolConnectionInstalls.connectionId,connection.id));
  assert.equal(await createManagedMcpRunConfig({...f.input,config:{},projectId:f.projectId,issueId:f.producer.issueId}),null);
 }finally{await f.client.close();}
});

test('run-scoped token rejects revocation, expiry, stopped run and another agent run',async()=>{
 const f=await fixture();try{
  await f.grant();const binding=await bindingFor(f);
  const [gateway]=await f.db.select().from(schema.toolMcpGateways).where(eq(schema.toolMcpGateways.gatewayPublicId,binding.gatewayPublicId));
  const [token]=await f.db.select().from(schema.toolMcpGatewayTokens).where(eq(schema.toolMcpGatewayTokens.gatewayId,gateway.id));
  const denied=async()=>{await assert.rejects(list(f,binding));await assert.rejects(call(f,binding));};
  await f.db.update(schema.toolMcpGatewayTokens).set({revokedAt:new Date()}).where(eq(schema.toolMcpGatewayTokens.id,token.id));await denied();
  await f.db.update(schema.toolMcpGatewayTokens).set({revokedAt:null,expiresAt:new Date(0)}).where(eq(schema.toolMcpGatewayTokens.id,token.id));await denied();
  await f.db.update(schema.toolMcpGatewayTokens).set({expiresAt:new Date(Date.now()+60000),subjectId:f.reviewer.runId}).where(eq(schema.toolMcpGatewayTokens.id,token.id));await denied();
  await f.db.update(schema.toolMcpGatewayTokens).set({subjectId:f.producer.runId}).where(eq(schema.toolMcpGatewayTokens.id,token.id));
  await f.db.update(schema.heartbeatRuns).set({status:'succeeded'}).where(eq(schema.heartbeatRuns.id,f.producer.runId));await denied();
  assert.equal(f.calls.length,0);
 }finally{await f.client.close();}
});

test('fresh require-approval remains restrictive despite immutable profile inclusion',async()=>{
 const f=await fixture();try{
  await f.grant();const binding=await bindingFor(f);
  await f.db.insert(schema.toolPolicies).values({companyId:f.companyId,name:'Fixture require approval',policyType:'require_approval',enabled:true,priority:0,selectors:{toolName:allowedTool},config:{}});
  const tools=await f.gateway.listToolsForNamedGateway(binding);assert.equal(tools.length,1);assert.match(tools[0].description,/approval/i);
  await assert.rejects(call(f,binding),error=>error.reasonCode==='tool_approval_required'||error.reasonCode==='approval_required'||/approval|review/i.test(error.message));
  assert.equal(f.calls.length,0);
 }finally{await f.client.close();}
});

test('editing or removing both metadata markers cannot broaden an issued plugin token',async()=>{
 const f=await fixture();try{
  await f.grant();const binding=await bindingFor(f);await broadPolicy(f);
  const [gateway]=await f.db.select().from(schema.toolMcpGateways).where(eq(schema.toolMcpGateways.gatewayPublicId,binding.gatewayPublicId));
  const [profile]=await f.db.select().from(schema.toolProfiles).where(eq(schema.toolProfiles.id,gateway.profileId));
  const names=[allowedTool,otherTool].sort();
  await f.db.update(schema.toolMcpGateways).set({metadata:{...gateway.metadata,runtimePluginTools:names}}).where(eq(schema.toolMcpGateways.id,gateway.id));
  await f.db.update(schema.toolProfiles).set({metadata:{...profile.metadata,runtimePluginTools:names}}).where(eq(schema.toolProfiles.id,profile.id));
  await f.db.insert(schema.toolProfileEntries).values({companyId:f.companyId,profileId:profile.id,selectorType:'tool_name',effect:'include',toolName:otherTool});
  assert.deepEqual(await list(f,binding),[],'changed snapshot metadata must fail digest validation');
  const gm={...gateway.metadata},pm={...profile.metadata};delete gm.runtimePluginTools;delete pm.runtimePluginTools;delete gm.runtimeAssignment;delete pm.runtimeAssignment;
  await f.db.update(schema.toolMcpGateways).set({metadata:gm}).where(eq(schema.toolMcpGateways.id,gateway.id));
  await f.db.update(schema.toolProfiles).set({metadata:pm}).where(eq(schema.toolProfiles.id,profile.id));
  assert.deepEqual(await list(f,binding),[],'issued token must retain the plugin-aware ceiling after metadata removal');
  await assert.rejects(call(f,binding,otherTool));assert.equal(f.calls.length,0);
 }finally{await f.client.close();}
});

test('approved retry rechecks signed stored arguments rather than benign caller arguments',async()=>{
 const f=await fixture();try{
  await f.grant();const binding=await bindingFor(f);
  const {canonicalToolArguments,signToolArguments,hashToolValue,summarizeToolValue}=await loadNative('@paperclipai/server/dist/services/tool-content-guards.js');
  const invocationId=randomUUID(),interactionId=randomUUID(),actionId=randomUUID(),stored={purpose:'now-blocked'};
  await f.db.insert(schema.issueThreadInteractions).values({id:interactionId,companyId:f.companyId,issueId:f.producer.issueId,kind:'request_confirmation',status:'accepted',payload:{}});
  await f.db.insert(schema.toolInvocations).values({id:invocationId,companyId:f.companyId,actorType:'agent',actorId:f.agent.id,agentId:f.agent.id,runId:f.producer.runId,issueId:f.producer.issueId,toolName:allowedTool,providerType:'paperclip_plugin',status:'awaiting_approval',approvalState:'approved'});
  const signedArguments=signToolArguments({invocationId,toolName:allowedTool,canonicalArguments:canonicalToolArguments(stored),executionOnApprove:true,approvalSnapshot:null,signingSecret:'fixture-only-not-a-real-secret-0123456789'});
  await f.db.insert(schema.toolActionRequests).values({id:actionId,companyId:f.companyId,invocationId,issueId:f.producer.issueId,interactionId,status:'approved',canonicalArgumentsHash:summarizeToolValue(stored).sha256,canonicalArgumentsSummary:{},signedArguments,requestedByAgentId:f.agent.id});
  await f.db.insert(schema.toolPolicies).values({companyId:f.companyId,name:'Fixture argument block',policyType:'block',enabled:true,priority:0,selectors:{toolName:allowedTool},conditions:{arguments:{fieldEquals:{purpose:'now-blocked'}}},config:{}});
  await assert.rejects(call(f,binding,allowedTool,{parameters:{purpose:'benign'},approvedActionRequestId:actionId}),error=>error.reasonCode==='deny_policy_block');
  assert.equal(f.calls.length,0,'signed blocked payload must never reach the worker');
 }finally{await f.client.close();}
});
