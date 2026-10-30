// Real complete public manifest and native policy/assignment/HTTP MCP; no model or domain writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

process.env.PAPERCLIP_API_URL='http://127.0.0.1:3100';
const publicRoot=process.env.QUALIFICATION_PUBLIC_ROOT??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const {nativeDatabase,nativeIdentityFixture,loadNative,schema,eq}=await import(pathToFileURL(path.join(publicRoot,'scripts/drafting-qualification/native-fixture.mjs')));
const {manifest}=await import(pathToFileURL(process.env.QUALIFICATION_FULL_MANIFEST??path.join(publicRoot,'dist/src/manifest.js')));
const {buildPaperclipRuntimeMcpServers}=await loadNative('@paperclipai/server/dist/services/heartbeat.js');
const {createToolGatewayService}=await loadNative('@paperclipai/server/dist/services/tool-gateway.js');
const {createPluginToolDispatcher}=await loadNative('@paperclipai/server/dist/services/plugin-tool-dispatcher.js');
const {registerAssignedMcpGateway}=await loadNative('@paperclipai/server/dist/services/native-runtime/assigned-mcp-tools.js');
const {mcpGatewayProtocolRoutes}=await loadNative('@paperclipai/server/dist/routes/tool-gateway.js');
const {default:express}=await loadNative('express/index.js');
const roles={producer:['funding_drafting_workspace','save_funding_proposals','save_funding_gap_progress','funding_drafting_checkpoint'],reviewer:['funding_review_context','review_funding_candidate']};
const names=role=>roles[role].map(name=>'netrxn.inertia:'+name).sort();
const all=manifest.tools.map(tool=>manifest.id+':'+tool.name).sort();
const facade=['paperclip_get_prompt','paperclip_list_prompts','paperclip_list_resources','paperclip_read_resource'];
function assertMcpCatalog(tools,expected){assert.deepEqual(tools.map(t=>t.name).sort(),[...expected,...facade].sort());}
assert.equal(manifest.id,'netrxn.inertia');
assert.equal(all.length,21,'Use the complete compiled public manifest, never a reduced synthetic catalog');

async function fixture(){
 const database=await nativeDatabase(),identity=await nativeIdentityFixture(database.db),{db}=database,pluginId=randomUUID(),calls=[];
 for(const role of ['producer','reviewer']){
  const a=identity[role];
  await db.update(schema.agents).set({adapterType:'codex_local',adapterConfig:{disableCommandExecution:true,engine:'cli',dangerouslyBypassApprovalsAndSandbox:false}}).where(eq(schema.agents.id,a.agentId));
  await db.insert(schema.principalPermissionGrants).values({companyId:identity.companyId,principalType:'agent',principalId:a.agentId,permissionKey:'tools:use',scope:{allow:names(role).map(n=>'tool:'+n)}});
 }
 await db.insert(schema.plugins).values({id:pluginId,pluginKey:manifest.id,packageName:'synthetic-full-manifest',version:manifest.version,status:'ready',manifestJson:manifest});
 const dispatcher=createPluginToolDispatcher({workerManager:{isRunning:()=>true,call:async(_id,method,params)=>{assert.equal(method,'executeTool');calls.push(structuredClone(params));return {content:'Synthetic worker receipt',data:{fixture:true}};}}});
 dispatcher.registerPluginTools(manifest.id,manifest,pluginId);
 const gateway=createToolGatewayService(db,{pluginToolDispatcher:dispatcher});registerAssignedMcpGateway(db,gateway);
 const app=express();app.use(express.json());app.use(mcpGatewayProtocolRoutes(gateway));const listener=app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
 const input=role=>({db,agent:{id:identity[role].agentId,companyId:identity.companyId,name:'Synthetic '+role,adapterType:'codex_local'},runId:identity[role].runId});
 const rpc=async(server,method,params)=>{const response=await fetch('http://127.0.0.1:'+listener.address().port+new URL(server.url).pathname,{method:'POST',headers:{authorization:'Bearer '+server.token,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,...(params?{params}:{})})});return response.json();};
 const direct=(role,tool)=>gateway.executePluginTool({actor:{type:'agent',companyId:identity.companyId,agentId:identity[role].agentId,runId:identity[role].runId},tool,parameters:{},runContext:{companyId:identity.companyId,projectId:identity.projectId,agentId:identity[role].agentId,runId:identity[role].runId}});
 const close=async()=>{listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));await database.client.close();};
 return {...database,...identity,calls,gateway,input,rpc,direct,close};
}

for(const role of ['producer','reviewer'])test('full 21-tool manifest yields only '+role+' catalog and denies every unassigned tool directly and through HTTP MCP',async()=>{
 const f=await fixture();try{
  const a=f[role],visible=await f.gateway.listPluginToolsForAgent({companyId:f.companyId,agentId:a.agentId,runId:a.runId});
  assert.deepEqual(visible.map(t=>t.name).sort(),names(role));
  assert.equal((await f.db.select().from(schema.principalPermissionGrants)).length,2);
  const [server]=await buildPaperclipRuntimeMcpServers(f.input(role));assert(server);
  const listed=await f.rpc(server,'tools/list');assertMcpCatalog(listed.result.tools,names(role));
  for(const tool of all.filter(n=>!names(role).includes(n))){
   await assert.rejects(f.direct(role,tool),error=>error.reasonCode==='deny_default');
   const denied=await f.rpc(server,'tools/call',{name:tool,arguments:{}});assert.equal(denied.error?.data?.reasonCode,'deny_runtime_assignment',tool);
  }
  assert.equal(f.calls.length,0,'Policy must reject before the worker receives any unassigned operation');
  const tool=names(role).find(n=>n.endsWith(role==='producer'?':funding_drafting_workspace':':funding_review_context'));
  await f.direct(role,tool);const admitted=await f.rpc(server,'tools/call',{name:tool,arguments:{}});assert.equal(admitted.result?.isError,false);assert.equal(f.calls.length,2);
 }finally{await f.close();}
});

test('revoking exact native grants fences direct calls and already issued role MCP gateways',async()=>{
 const f=await fixture();try{
  const servers={};for(const role of ['producer','reviewer'])[servers[role]]=await buildPaperclipRuntimeMcpServers(f.input(role));
  await f.db.delete(schema.principalPermissionGrants).where(eq(schema.principalPermissionGrants.companyId,f.companyId));
  for(const role of ['producer','reviewer']){
   const listed=await f.rpc(servers[role],'tools/list');assertMcpCatalog(listed.result.tools,[]);
   for(const tool of names(role)){
    await assert.rejects(f.direct(role,tool),error=>error.reasonCode==='deny_default');
    const denied=await f.rpc(servers[role],'tools/call',{name:tool,arguments:{}});assert.equal(denied.error?.data?.reasonCode,'deny_default');
   }
  }
  assert.equal(f.calls.length,0);
 }finally{await f.close();}
});

test('broad native grant exposes the complete manifest despite a narrow profile; narrowing revokes the old broad gateway',async()=>{
 const f=await fixture();try{
  const [profile]=await f.db.insert(schema.toolProfiles).values({companyId:f.companyId,profileKey:'fixture-producer-only',name:'Synthetic narrow profile',status:'active',defaultAction:'deny'}).returning();
  await f.db.insert(schema.toolProfileEntries).values(names('producer').map(toolName=>({companyId:f.companyId,profileId:profile.id,selectorType:'tool_name',effect:'include',toolName})));
  await f.db.insert(schema.toolProfileBindings).values({companyId:f.companyId,profileId:profile.id,targetType:'agent',targetId:f.producer.agentId});
  const [grant]=await f.db.select().from(schema.principalPermissionGrants).where(eq(schema.principalPermissionGrants.principalId,f.producer.agentId));
  await f.db.update(schema.principalPermissionGrants).set({scope:null}).where(eq(schema.principalPermissionGrants.id,grant.id));
  assert.deepEqual((await f.gateway.listPluginToolsForAgent({companyId:f.companyId,agentId:f.producer.agentId,runId:f.producer.runId})).map(t=>t.name).sort(),all);
  const [server]=await buildPaperclipRuntimeMcpServers(f.input('producer'));assertMcpCatalog((await f.rpc(server,'tools/list')).result.tools,all);
  await f.db.update(schema.principalPermissionGrants).set({scope:{allow:names('producer').map(n=>'tool:'+n)}}).where(eq(schema.principalPermissionGrants.id,grant.id));
  assertMcpCatalog((await f.rpc(server,'tools/list')).result.tools,names('producer'));
  for(const tool of all.filter(n=>!names('producer').includes(n))){
   await assert.rejects(f.direct('producer',tool),error=>error.reasonCode==='deny_default');
   const denied=await f.rpc(server,'tools/call',{name:tool,arguments:{}});assert.equal(denied.error?.data?.reasonCode,'deny_default');
  }
  assert.equal(f.calls.length,0);
 }finally{await f.close();}
});
