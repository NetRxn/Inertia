/** Actual pinned SDK RPC + server config POST/lifecycle + native SQL, no providers. */
import test,{before,after}from'node:test';import assert from'node:assert/strict';import fs from'node:fs/promises';import{PassThrough}from'node:stream';import{createInterface}from'node:readline';import{randomUUID}from'node:crypto';import{pathToFileURL}from'node:url';
if(process.env.QUALIFY_DISPOSABLE!=='1')test('config reload needs offline disposable pinned runtime',{skip:true},()=>{});
else{
 const source=process.env.QUALIFICATION_PUBLIC_ROOT??'/qual/source',native='/opt/host/node_modules',root='/tmp/inertia-config-reload';const load=p=>import(pathToFileURL(native+'/'+p));
 const sdk=await load('@paperclipai/plugin-sdk/dist/index.js'),schema=await load('@paperclipai/db/dist/schema/index.js'),{eq,and}=await load('drizzle-orm/index.js');
 const{startEmbeddedPostgresTestDatabase,createDb}=await load('@paperclipai/db/dist/index.js'),{pluginRoutes}=await load('@paperclipai/server/dist/routes/plugins.js'),{buildHostServices}=await load('@paperclipai/server/dist/services/plugin-host-services.js'),{createPluginEventBus}=await load('@paperclipai/server/dist/services/plugin-event-bus.js');
 const{default:express}=await load('express/index.js');await fs.mkdir(root+'/node_modules',{recursive:true});await fs.cp(source+'/dist',root+'/dist',{recursive:true});await fs.writeFile(root+'/package.json','{"type":"module"}');await fs.symlink(native+'/@paperclipai',root+'/node_modules/@paperclipai');await fs.symlink(await fs.realpath('/opt/inertia-reviewed/node_modules/nostr-tools'),root+'/node_modules/nostr-tools');
 const{createPlugin}=await import(pathToFileURL(root+'/dist/src/worker.js')),{manifest}=await import(pathToFileURL(root+'/dist/src/manifest.js'));
 let temp,db,services,handlers,server,origin,worker;let starts=0,stops=0,loads=0,unloads=0;const pluginId=randomUUID(),companyA=randomUUID(),companyB=randomUUID(),projectA=randomUUID(),projectB=randomUUID(),snapshots=[],activeSubscriptions=new Set();
 const config=projectId=>({enabled:false,generalEnrichment:{enabled:true,applicantSlug:'synthetic-public',projectId,rootIssueId:randomUUID(),rootProjectId:projectId,producer:{agentId:randomUUID(),principalId:'synthetic-producer'},reviewer:{agentId:randomUUID(),principalId:'synthetic-reviewer'},process:{executable:'/usr/bin/false',args:['/tmp/not-executed-entry','/tmp/not-executed-config'],cwd:'/tmp',entrypoint:'/tmp/not-executed-entry',configurationPath:'/tmp/not-executed-config',timeoutMs:1000,maxOutputBytes:1024,pins:[{path:'/tmp/not-executed-entry',sha256:'a'.repeat(64)},{path:'/tmp/not-executed-config',sha256:'b'.repeat(64)}]}}});
 async function start(){
  const input=new PassThrough(),output=new PassThrough(),pending=new Map(),counts={jobs:[],tools:[],events:[]};let seq=0;
  const p=createPlugin(),setup=p.definition.setup;p.definition.setup=async ctx=>{
   for(const[name,method,key]of[['jobs','register','jobs'],['tools','register','tools'],['events','on','events']]){const old=ctx[name][method].bind(ctx[name]);ctx[name][method]=(...args)=>{counts[key].push(args[0]);return old(...args);};}
   await setup(ctx);
  };
  const rpc=sdk.startWorkerRpcHost({plugin:p,stdin:input,stdout:output});
  const reader=createInterface({input:output});reader.on('line',async line=>{
   const message=JSON.parse(line);if(!message.method){const callback=pending.get(message.id);if(callback){pending.delete(message.id);message.error?callback.reject(new sdk.JsonRpcCallError(message.error)):callback.resolve(message.result);}return;}
   if(message.id===undefined)return;
   let result,error;try{
    if(message.method==='events.subscribe'){activeSubscriptions.add(message.params.eventPattern);result={};}
    else{assert(handlers[message.method],'Unexpected SDK host call '+message.method);result=await handlers[message.method](message.params,{invocationScope:{companyId:message.params.companyId}});}
   }catch(e){error={code:e.code??sdk.PLUGIN_RPC_ERROR_CODES.WORKER_ERROR,message:e.message};}
   input.write(JSON.stringify(error?{jsonrpc:'2.0',id:message.id,error}:{jsonrpc:'2.0',id:message.id,result:result??null})+'\n');
  });
  const call=(method,params)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});input.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
  worker={call,stop:()=>{rpc.stop();reader.close();input.destroy();output.destroy();activeSubscriptions.clear();stops++;},counts};starts++;
  const initialized=await call('initialize',{manifest,config:{},apiVersion:1,instanceInfo:{instanceId:randomUUID(),hostVersion:'2026.1012.0'},databaseNamespace:'plugin_netrxn_inertia_e936d62b87'});assert.equal(initialized.ok,true);snapshots.push(structuredClone(counts));
 }
 const manager={isRunning:()=>!!worker,getWorker:()=>worker,setProactiveCompanyScopes:(_id,ids)=>{assert(ids.includes(companyA));},call:(_id,method,params)=>worker.call(method,params)};
 const loader={hasRuntimeServices:()=>true,unloadSingle:async()=>{unloads++;worker.stop();worker=null;},loadSingle:async()=>{loads++;await start();return{success:true};}};
 before(async()=>{
  temp=await startEmbeddedPostgresTestDatabase('plugin-reload-');db=createDb(temp.connectionString);
  for(const id of[companyA,companyB])await db.insert(schema.companies).values({id,name:'Synthetic reload company',issuePrefix:'R'+id.replaceAll('-','').slice(0,7).toUpperCase()});
  await db.insert(schema.plugins).values({id:pluginId,pluginKey:'netrxn.inertia',packageName:'controlled-reload',version:'0.1.0',status:'ready',manifestJson:manifest});
  for(const companyId of[companyA,companyB])await db.insert(schema.pluginConfig).values({pluginId,companyId,configJson:{enabled:false}});
  services=buildHostServices(db,pluginId,'netrxn.inertia',createPluginEventBus());handlers=sdk.createHostClientHandlers({pluginId:'netrxn.inertia',capabilities:manifest.capabilities,services});await start();
  const app=express();app.use(express.json());app.use((req,_res,next)=>{req.actor={type:'board',source:'local_implicit',userId:'synthetic-owner',isInstanceAdmin:true};next();});app.use('/api',pluginRoutes(db,loader,undefined,undefined,undefined,{workerManager:manager}));app.use((err,_req,res,_next)=>res.status(err.status??500).json({error:err.message}));
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin='http://127.0.0.1:'+server.address().port;
 });
 after(async()=>{worker?.stop();services?.dispose();if(server)await new Promise(r=>server.close(r));await temp?.cleanup();});
 const execute=(companyId,projectId)=>worker.call('executeTool',{toolName:'funding_enrichment',parameters:{operation:'context',parameters:{}},runContext:{companyId,projectId,issueId:randomUUID(),agentId:'unadmitted-synthetic-agent',runId:randomUUID()}});
 async function post(companyId,configJson){const response=await fetch(origin+'/api/plugins/'+pluginId+'/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId,configJson})});const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));}
 test('actual config POST triggers typed RPC restart and rebuilds closed bindings for both companies once',async()=>{
  await assert.rejects(()=>execute(companyA,projectA),/Enrichment scope unavailable/);
  await post(companyA,config(projectA));assert.equal(starts,2);assert.equal(unloads,1);assert.equal(loads,1);assert.equal(stops,1);
  await assert.rejects(()=>execute(companyA,projectA),/Enrichment role denied/);
  await assert.rejects(()=>execute(companyB,projectA),/Enrichment scope unavailable/);
  await post(companyB,config(projectB));assert.equal(starts,3);assert.equal(unloads,2);
  await assert.rejects(()=>execute(companyA,projectA),/Enrichment role denied/);await assert.rejects(()=>execute(companyB,projectB),/Enrichment role denied/);
  await assert.rejects(()=>execute(companyA,projectB),/Enrichment scope unavailable/);await assert.rejects(()=>execute(companyB,projectA),/Enrichment scope unavailable/);
  for(const snapshot of snapshots){for(const key of['jobs','tools','events'])assert.equal(new Set(snapshot[key]).size,snapshot[key].length,key+' duplicated');assert.deepEqual(snapshot,snapshots[0]);}
  assert.equal(activeSubscriptions.size,new Set(snapshots[0].events).size);assert(snapshots[0].tools.includes('funding_enrichment'));assert(snapshots[0].jobs.length>1);
  const rows=await db.select().from(schema.pluginConfig).where(eq(schema.pluginConfig.pluginId,pluginId));assert.equal(rows.length,2);
  await post(companyA,{enabled:false});assert.equal(starts,4);await assert.rejects(()=>execute(companyA,projectA),/Enrichment scope unavailable/);await assert.rejects(()=>execute(companyB,projectB),/Enrichment role denied/);
 });
 test('actual managed subprocess is replaced by config POST and reconstructs current tenant bindings',async()=>{
  const{createPluginWorkerManager}=await load('@paperclipai/server/dist/services/plugin-worker-manager.js');const managed=createPluginWorkerManager();let localServer,managedServices;const pids=[],instanceId=randomUUID();
  async function managedStart(){managedServices=buildHostServices(db,pluginId,'netrxn.inertia',createPluginEventBus());await managed.startWorker(pluginId,{entrypointPath:root+'/dist/src/worker.js',manifest,config:{},instanceInfo:{instanceId,hostVersion:'2026.1012.0'},apiVersion:1,databaseNamespace:'plugin_netrxn_inertia_e936d62b87',hostHandlers:sdk.createHostClientHandlers({pluginId:'netrxn.inertia',capabilities:manifest.capabilities,services:managedServices}),proactiveCompanyScopes:[companyA,companyB],autoRestart:false,rpcTimeoutMs:5000});pids.push(managed.diagnostics()[0].pid);}
  const managedLoader={hasRuntimeServices:()=>true,unloadSingle:async()=>{await managed.stopWorker(pluginId);managedServices.dispose();},loadSingle:async()=>{await managedStart();return{success:true};}};
  const probe=(companyId,projectId)=>managed.call(pluginId,'executeTool',{toolName:'funding_enrichment',parameters:{operation:'context',parameters:{}},runContext:{companyId,projectId,issueId:randomUUID(),agentId:'unadmitted-synthetic-agent',runId:randomUUID()}});
  try{
   await managedStart();await assert.rejects(()=>probe(companyA,projectA),/Enrichment scope unavailable/);await assert.rejects(()=>probe(companyB,projectB),/Enrichment role denied/);
   const app=express();app.use(express.json());app.use((req,_res,next)=>{req.actor={type:'board',source:'local_implicit',userId:'synthetic-owner',isInstanceAdmin:true};next();});app.use('/api',pluginRoutes(db,managedLoader,undefined,undefined,undefined,{workerManager:managed}));app.use((err,_req,res,_next)=>res.status(err.status??500).json({error:err.message}));localServer=app.listen(0,'127.0.0.1');await new Promise(r=>localServer.once('listening',r));const url='http://127.0.0.1:'+localServer.address().port+'/api/plugins/'+pluginId+'/config';
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:companyA,configJson:config(projectA)})});assert.equal(response.status,200,await response.text());
   assert.equal(pids.length,2);assert(pids.every(Number.isInteger));assert.notEqual(pids[0],pids[1]);assert.equal(managed.diagnostics().length,1);assert.equal(managed.diagnostics()[0].status,'running');assert.equal(managed.diagnostics()[0].pendingRequests,0);
   await assert.rejects(()=>probe(companyA,projectA),/Enrichment role denied/);await assert.rejects(()=>probe(companyB,projectB),/Enrichment role denied/);await assert.rejects(()=>probe(companyA,projectB),/Enrichment scope unavailable/);await assert.rejects(()=>probe(companyB,projectA),/Enrichment scope unavailable/);
  }finally{await managed.stopAll();managedServices?.dispose();if(localServer)await new Promise(r=>localServer.close(r));}
 });
 test('malformed config is rejected before lifecycle rebuild and cannot replace protected company rows',async()=>{
  const before=starts,response=await fetch(origin+'/api/plugins/'+pluginId+'/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:companyB,configJson:{enabled:'yes'}})});assert.equal(response.status,400);assert.equal(starts,before);
  const[row]=await db.select().from(schema.pluginConfig).where(and(eq(schema.pluginConfig.pluginId,pluginId),eq(schema.pluginConfig.companyId,companyB)));assert.equal(row.configJson.generalEnrichment.projectId,projectB);
 });
}
