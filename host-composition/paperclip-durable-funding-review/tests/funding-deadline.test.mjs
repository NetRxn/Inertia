import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

process.env.PAPERCLIP_API_URL='http://127.0.0.1:3100';
const publicRoot=process.env.QUALIFICATION_PUBLIC_ROOT??'/qual/source';
const {nativeDatabase,nativeIdentityFixture,loadNative,schema,eq}=await import(pathToFileURL(path.join(publicRoot,'scripts/drafting-qualification/native-fixture.mjs')));
const {manifest:fullManifest}=await import(pathToFileURL(process.env.QUALIFICATION_FULL_MANIFEST??path.join(publicRoot,'dist/src/manifest.js')));assert.equal(fullManifest.tools.length,21);
const {buildPaperclipRuntimeMcpServers}=await loadNative('@paperclipai/server/dist/services/heartbeat.js');
const {createToolGatewayService}=await loadNative('@paperclipai/server/dist/services/tool-gateway.js');
const {createPluginToolDispatcher}=await loadNative('@paperclipai/server/dist/services/plugin-tool-dispatcher.js');
const {registerAssignedMcpGateway}=await loadNative('@paperclipai/server/dist/services/native-runtime/assigned-mcp-tools.js');
const {writeManagedCodexMcpConfig}=await loadNative('@paperclipai/adapter-codex-local/dist/server/codex-home.js');
const {mcpGatewayProtocolRoutes}=await loadNative('@paperclipai/server/dist/routes/tool-gateway.js');
const {default:express}=await loadNative('express/index.js');
const {hasExactFundingExecutionCatalog,validateFundingExecutionPolicy}=await loadNative('@paperclipai/server/dist/services/native-runtime/funding-execution-policy.js');
const roles={producer:['funding_drafting_workspace','save_funding_proposals','save_funding_gap_progress','funding_drafting_checkpoint'],reviewer:['funding_review_context','review_funding_candidate']};
async function fixture(role='producer',extra=[],realWorker){
 const database=await nativeDatabase(),identity=await nativeIdentityFixture(database.db),{db}=database;
 const names=[...roles[role],...extra].map(n=>'netrxn.inertia:'+n),pluginId=randomUUID();
 for(const r of ['producer','reviewer'])await db.update(schema.agents).set({adapterType:'codex_local',adapterConfig:{disableCommandExecution:true,engine:'cli',dangerouslyBypassApprovalsAndSandbox:false}}).where(eq(schema.agents.id,identity[r].agentId));
 const config={nativeFundingToolPreapproval:true,publicDrafting:{enabled:true,projectId:identity.projectId,applicantSlug:'synthetic-public',matchId:randomUUID(),producer:{issueId:identity.producer.issueId,agentId:identity.producer.agentId,principalId:identity.producer.principalId},reviewer:{issueId:identity.reviewer.issueId,agentId:identity.reviewer.agentId,principalId:identity.reviewer.principalId}}};
 const manifest={...fullManifest,tools:[...fullManifest.tools,...extra.filter(name=>!fullManifest.tools.some(tool=>tool.name===name)).map(name=>({name,displayName:name,description:'Synthetic extra tool',parametersSchema:{type:'object',additionalProperties:false,properties:{}}}))]};
 await db.insert(schema.plugins).values({id:pluginId,pluginKey:'netrxn.inertia',packageName:'synthetic-deadline',version:'0.0.0',status:'ready',manifestJson:manifest});await db.insert(schema.pluginConfig).values({pluginId,companyId:identity.companyId,configJson:config});
 for(const r of ['producer','reviewer'])await db.insert(schema.principalPermissionGrants).values({companyId:identity.companyId,principalType:'agent',principalId:identity[r].agentId,permissionKey:'tools:use',scope:{allow:[...roles[r],...(r===role?extra:[])].map(n=>'tool:netrxn.inertia:'+n)}});
 const calls=[];const worker=realWorker??{isRunning:()=>true,call:async(...args)=>{calls.push(args);return {content:'Synthetic exact operation',data:{committed:true}};}};
 const dispatcher=createPluginToolDispatcher({workerManager:worker});dispatcher.registerPluginTools('netrxn.inertia',manifest,pluginId);
 const gateway=createToolGatewayService(db,{pluginToolDispatcher:dispatcher});registerAssignedMcpGateway(db,gateway);
 const actor=identity[role],agent={id:actor.agentId,companyId:identity.companyId,name:'Synthetic '+role,adapterType:'codex_local'},input={db,agent,runId:actor.runId};
 return {...database,...identity,role,names,pluginId,config,worker,calls,gateway,input,dispatcher,manifest};
}
test('exact role-only native assignment receives the fixed client deadline without changing approval or shell policy',async()=>{
 const f=await fixture();const home=await fs.mkdtemp(path.join(os.tmpdir(),'funding-deadline-'));
 try{const [server]=await buildPaperclipRuntimeMcpServers(f.input);assert.equal(server.fundingToolPreapproval.executionBudgetVersion,1);
 await writeManagedCodexMcpConfig({codexHome:home,apiBaseUrl:'http://127.0.0.1:3100',gateways:[{name:server.name,endpointPath:server.url,bearerToken:server.token,runtimeAssignmentId:server.connectionId,fundingToolPreapproval:server.fundingToolPreapproval}],expectedFundingRunBinding:{companyId:f.companyId,agentId:f.producer.agentId,runId:f.producer.runId,issueId:f.producer.issueId,projectId:f.projectId}});
 const config=await fs.readFile(path.join(home,'config.toml'),'utf8');assert.match(config,/tool_timeout_sec = 180/);assert.equal((config.match(/approval_mode = "approve"/g)??[]).length,4);assert(!config.includes('approval_policy'));
 }finally{await fs.rm(home,{recursive:true,force:true});await f.client.close();}
});
test('mixed assignment never receives a longer client deadline',async()=>{const f=await fixture('producer',['unknown_tool']);try{const [server]=await buildPaperclipRuntimeMcpServers(f.input);assert.equal(server.fundingToolPreapproval.executionBudgetVersion,undefined);}finally{await f.client.close();}});
test('the exact authorized call propagates one server-owned deadline and bounded worker RPC budget',async()=>{
 const f=await fixture();try{const [server]=await buildPaperclipRuntimeMcpServers(f.input),started=Date.now();
 const result=await f.gateway.executeTool({gatewayPublicId:new URL(server.url).pathname.split('/').at(-1),sessionToken:server.token,tool:f.names[0],parameters:{},nativeMcpExecution:true,runContext:{fundingExecution:{operationDeadlineAt:Number.MAX_SAFE_INTEGER}}});
 assert.equal(result.status,'completed');assert.equal(f.calls.length,1);
 assert(f.calls[0][3]>120000&&f.calls[0][3]<=160000);const context=f.calls[0][2].runContext,execution=context.fundingExecution;
 assert.equal(execution.version,1);assert.equal(execution.toolName,f.names[0]);assert.equal(execution.runId,f.producer.runId);assert.equal(execution.issueId,f.producer.issueId);
 assert(execution.operationDeadlineAt>=started+119000&&execution.operationDeadlineAt<=Date.now()+120000);
 assert.notEqual(execution.operationDeadlineAt,Number.MAX_SAFE_INTEGER);
 }finally{await f.client.close();}
});
test('a mixed native assignment preserves ordinary gateway and RPC defaults',async()=>{const f=await fixture('producer',['unknown_tool']);try{const [server]=await buildPaperclipRuntimeMcpServers(f.input);const result=await f.gateway.executeTool({gatewayPublicId:new URL(server.url).pathname.split('/').at(-1),sessionToken:server.token,tool:f.names[0],parameters:{}});assert.equal(result.status,'completed');assert.equal(f.calls[0][3],undefined);assert.equal(f.calls[0][2].runContext.fundingExecution,undefined);}finally{await f.client.close();}});
test('complete role catalogs reject every partial, duplicate, mixed or ordinary-connection variant',()=>{
 const agent=randomUUID(),names=roles.producer.map(n=>'netrxn.inertia:'+n),approval={version:1,role:'producer',agentId:agent,tools:names};const assignment={version:1,agentId:agent,connections:[],tools:[],pluginTools:names};
 assert(hasExactFundingExecutionCatalog(approval,assignment));
 for(const patch of[{pluginTools:names.slice(1)},{pluginTools:[...names,names[0]]},{pluginTools:[...names,'netrxn.inertia:unknown']},{connections:['ordinary']},{tools:['ordinary']},{agentId:randomUUID()},{pluginTools:undefined}])assert.equal(hasExactFundingExecutionCatalog(approval,{...assignment,...patch}),false);
 for(const patch of[{tools:names.slice(1)},{tools:[...names,names[0]]},{role:'operator'},{version:2}])assert.equal(hasExactFundingExecutionCatalog({...approval,...patch},assignment),false);
});
test('the actual native MCP route supplies trusted transport and discards forged execution context',async()=>{
 const f=await fixture('reviewer'),app=express();app.use(express.json());app.use(mcpGatewayProtocolRoutes(f.gateway));const listener=app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
 try{const [server]=await buildPaperclipRuntimeMcpServers(f.input),url='http://127.0.0.1:'+listener.address().port+new URL(server.url).pathname;
 const r=await fetch(url,{method:'POST',headers:{authorization:'Bearer '+server.token,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:f.names[0],arguments:{},runContext:{fundingExecution:{operationDeadlineAt:Number.MAX_SAFE_INTEGER}}}})});const body=await r.json();assert.equal(r.status,200);assert.equal(body.result.isError,false);assert.equal(f.calls.length,1);assert(f.calls[0][3]>120000);assert.equal(f.calls[0][2].runContext.fundingExecution.role,'reviewer');assert.equal(f.calls[0][2].runContext.fundingExecution.issueId,f.reviewer.issueId);
 }finally{listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));await f.client.close();}
});
test('an ordinary direct call of an otherwise exact role keeps the native defaults',async()=>{const f=await fixture();try{const [server]=await buildPaperclipRuntimeMcpServers(f.input);await f.gateway.executeTool({gatewayPublicId:new URL(server.url).pathname.split('/').at(-1),sessionToken:server.token,tool:f.names[0],parameters:{}});assert.equal(f.calls[0][3],undefined);assert.equal(f.calls[0][2].runContext.fundingExecution,undefined);}finally{await f.client.close();}});
test('fresh policy revocation denies the tool instead of issuing a resource budget',async()=>{const f=await fixture();try{const [server]=await buildPaperclipRuntimeMcpServers(f.input);await f.db.insert(schema.toolPolicies).values({companyId:f.companyId,name:'Synthetic revoke',policyType:'block',enabled:true,priority:0,selectors:{toolName:f.names[0]},config:{}});await assert.rejects(f.gateway.executeTool({gatewayPublicId:new URL(server.url).pathname.split('/').at(-1),sessionToken:server.token,tool:f.names[0],parameters:{},nativeMcpExecution:true}));assert.equal(f.calls.length,0);}finally{await f.client.close();}});
test('the dispatch boundary rejects caller-forged metadata and malformed or expired trusted policy',()=>{
 const ids={companyId:randomUUID(),agentId:randomUUID(),runId:randomUUID(),issueId:randomUUID(),projectId:randomUUID()},startedAt=Date.now()-1,toolName='netrxn.inertia:funding_drafting_workspace';
 const p={version:1,role:'producer',...ids,toolName,invocationId:randomUUID(),startedAt,operationDeadlineAt:startedAt+120000,rpcDeadlineAt:startedAt+160000,gatewayDeadlineAt:startedAt+170000};
 assert.equal(validateFundingExecutionPolicy(p,toolName,ids),p);
 assert.throws(()=>validateFundingExecutionPolicy(undefined,toolName,{...ids,fundingExecution:p}),/Caller-supplied/);
 for(const patch of[{runId:randomUUID()},{toolName:'netrxn.inertia:unknown'},{operationDeadlineAt:Number.MAX_SAFE_INTEGER},{rpcDeadlineAt:p.rpcDeadlineAt+1},{version:2},{role:'reviewer'},{invocationId:'00000000-0000-0000-0000-000000000000'},{extra:true}])assert.throws(()=>validateFundingExecutionPolicy({...p,...patch},toolName,ids));
 const old=Date.now()-121000;assert.throws(()=>validateFundingExecutionPolicy({...p,startedAt:old,operationDeadlineAt:old+120000,rpcDeadlineAt:old+160000,gatewayDeadlineAt:old+170000},toolName,ids),/deadline exhausted/);
});
test('real native SDK execution longer than the old 30-second RPC bound succeeds without inference',{timeout:60000},async()=>{
 const {createPluginWorkerManager}=await loadNative('@paperclipai/server/dist/services/plugin-worker-manager.js');const wm=createPluginWorkerManager(),f=await fixture('producer',[],wm),dir=await fs.mkdtemp(path.join(os.tmpdir(),'funding-slow-sdk-'));
 const entrypointPath=path.join(dir,'worker.mjs');await fs.writeFile(entrypointPath,`import{definePlugin,runWorker}from'/opt/host/node_modules/@paperclipai/plugin-sdk/dist/index.js';const names=${JSON.stringify(roles.producer)};const plugin=definePlugin({setup(ctx){for(const name of names)ctx.tools.register(name,{displayName:name,description:'Synthetic bounded SDK request',parametersSchema:{type:'object',properties:{},additionalProperties:false}},async(_params,run)=>{await new Promise(r=>setTimeout(r,31000));return{content:'Synthetic delayed success',data:{runId:run.runId,operationDeadlineAt:run.fundingExecution.operationDeadlineAt}};});}});runWorker(plugin,import.meta.url);`);
 const app=express();app.use(express.json());app.use(mcpGatewayProtocolRoutes(f.gateway));const listener=app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
 try{await wm.startWorker(f.pluginId,{entrypointPath,manifest:f.manifest,config:{},instanceInfo:{instanceId:'synthetic-deadline',hostVersion:'2026.1012.0',deploymentMode:'local_trusted',deploymentExposure:'private'},apiVersion:1,hostHandlers:{},autoRestart:false});
 const [server]=await buildPaperclipRuntimeMcpServers(f.input),started=Date.now(),grants=await f.db.select().from(schema.principalPermissionGrants);
 const r=await fetch('http://127.0.0.1:'+listener.address().port+new URL(server.url).pathname,{method:'POST',headers:{authorization:'Bearer '+server.token,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:f.names[0],arguments:{}}})});const body=await r.json();assert.equal(r.status,200);assert.equal(body.result.isError,false);assert(Date.now()-started>=31000);assert.deepEqual(await f.db.select().from(schema.principalPermissionGrants),grants);assert.equal(grants.length,2);
 }finally{await wm.stopAll();listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));await f.client.close();await fs.rm(dir,{recursive:true,force:true});}
});
