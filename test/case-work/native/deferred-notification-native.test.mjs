/** Disposable actual native tasks, SQL, catalog and gateway. No providers or live state. */
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs/promises';import{randomUUID}from'node:crypto';import{spawnSync}from'node:child_process';import{pathToFileURL}from'node:url';
process.env.PAPERCLIP_API_URL='http://127.0.0.1:3100';
const native='/opt/host/node_modules',source='/qual/source',root='/tmp/case-native-sql',server=root+'/node_modules/@paperclipai/server';await fs.mkdir(server,{recursive:true});await fs.cp(native+'/@paperclipai/server/dist',server+'/dist',{recursive:true});await fs.copyFile(native+'/@paperclipai/server/package.json',server+'/package.json');await fs.cp('/qual/candidate/dist',server+'/dist',{recursive:true,force:true});
for(const from of[native+'/@paperclipai/server/node_modules',native])for(const name of await fs.readdir(from).catch(()=>[])){if(name==='@paperclipai'||name.startsWith('.'))continue;await fs.symlink(from+'/'+name,root+'/node_modules/'+name).catch(e=>{if(e.code!=='EEXIST')throw e;});}
for(const name of await fs.readdir(native+'/@paperclipai'))if(name!=='server')await fs.symlink(native+'/@paperclipai/'+name,root+'/node_modules/@paperclipai/'+name);
const load=p=>import(pathToFileURL(native+'/'+p)),local=p=>import(pathToFileURL(server+'/dist/'+p)),s=await load('@paperclipai/db/dist/schema/index.js'),{eq,sql}=await load('drizzle-orm/index.js'),{startEmbeddedPostgresTestDatabase,createDb}=await load('@paperclipai/db/dist/index.js');

const{buildHostServices}=await local('services/plugin-host-services.js'),{createPluginWorkerManager}=await local('services/plugin-worker-manager.js'),{createPluginToolDispatcher}=await local('services/plugin-tool-dispatcher.js');
const{manifest}=await import(pathToFileURL('/qual/plugin/dist/src/manifest.js'));
const pg=await startEmbeddedPostgresTestDatabase('alpha-notification-'),db=createDb(pg.connectionString);test.after(async()=>pg.cleanup());
test('actual SDK reservation retains 13 saved leads when Coordinator has an unresolved Alpha dependency',async()=>{
 const companyId=randomUUID(),projectId=randomUUID(),rootId=randomUUID(),scanId=randomUUID(),alphaId=randomUUID(),betaId=randomUUID(),coId=randomUUID(),runId=randomUUID(),pluginId=randomUUID();
 await db.insert(s.companies).values({id:companyId,name:'Synthetic dependency',issuePrefix:'N'+companyId.slice(0,7)});
 await db.insert(s.projects).values({id:projectId,companyId,name:'Synthetic research'});
 await db.insert(s.agents).values([{id:coId,companyId,name:'Co',role:'ceo',status:'idle',adapterType:'paperclip_runner'},{id:alphaId,companyId,name:'Alpha',role:'general',status:'running',adapterType:'paperclip_runner'},{id:betaId,companyId,name:'Beta',role:'general',status:'idle',adapterType:'paperclip_runner'}]);
 await db.insert(s.issues).values([{id:rootId,companyId,projectId,title:'Synthetic root',status:'blocked',assigneeAgentId:coId},{id:scanId,companyId,projectId,parentId:rootId,title:'Synthetic scan',status:'in_progress',assigneeAgentId:alphaId}]);
 await db.insert(s.heartbeatRuns).values({id:runId,companyId,agentId:alphaId,nativeIssueId:scanId,runtimeMode:'native',status:'running',contextSnapshot:{issueId:scanId}});
 await db.update(s.issues).set({executionRunId:runId}).where(eq(s.issues.id,scanId));
 await db.insert(s.issueRelations).values({companyId,issueId:scanId,relatedIssueId:rootId,type:'blocks'});
 await db.insert(s.plugins).values({id:pluginId,pluginKey:'netrxn.inertia',packageName:'synthetic-notification',version:'0.1.0',status:'ready',manifestJson:manifest});
 const services=buildHostServices(db,pluginId,'netrxn.inertia',{forPlugin(){return{subscribe(){return()=>{};}};}},()=>{}, {manifest});
 await assert.rejects(()=>services.issues.requestWakeup({companyId,issueId:rootId,reason:'funding_case_identified'}),{message:'Issue is blocked by unresolved blockers'});
 const temporary=await fs.mkdtemp('/tmp/alpha-notification-'),workerPath=temporary+'/worker.mjs';test.after(()=>fs.rm(temporary,{recursive:true,force:true}));
 const config={companyId,projectId,researchProjectId:projectId,rootIssueId:rootId,rootProjectId:projectId,applicantSlug:'synthetic',researcher:{agentId:alphaId,principalId:'alpha'},producer:{agentId:betaId,principalId:'beta'},policyRevision:'v1'};
 await fs.writeFile(workerPath,`import{definePlugin,runWorker}from'/opt/host/node_modules/@paperclipai/plugin-sdk/dist/index.js';import{registerCaseWork}from'/qual/plugin/dist/src/case-work/host.js';runWorker(definePlugin({setup(ctx){registerCaseWork(ctx,[{...${JSON.stringify(config)},authorize:async()=>true,bridge:{call:async(_op,p,callbacks)=>{await callbacks.context();return{case_binding_id:'binding-'+p.record_id,revision_hash:'a'.repeat(64),business_complete:false,preliminary:true,one_off_source_id:'source-'+p.record_id,source_candidate_record_id:p.record_id};}}}],{own:async(_s,work)=>work()});}}),import.meta.url);`);
 const wm=createPluginWorkerManager();test.after(()=>wm.stopAll());
 const handlers=Object.fromEntries(['get','getSubtree','listComments','createComment','requestWakeup'].map(name=>['issues.'+name,p=>services.issues[name](p)]));
 for(const name of['list','get','upsert'])handlers['issues.documents.'+name]=p=>services.issueDocuments[name](p);
 await wm.startWorker(pluginId,{entrypointPath:workerPath,manifest,config:{},instanceInfo:{instanceId:'synthetic-alpha',hostVersion:'2026.1012.0',deploymentMode:'local_trusted',deploymentExposure:'private'},apiVersion:1,hostHandlers:handlers,autoRestart:false});
 const dispatcher=createPluginToolDispatcher({workerManager:wm});dispatcher.registerPluginTools('netrxn.inertia',manifest,pluginId);
 const runContext={companyId,projectId,agentId:alphaId,runId};
 for(let pass=0;pass<2;pass++)for(let n=0;n<13;n++){
  const result=await dispatcher.executeTool('netrxn.inertia:funding_case_work',{operation:'reserve_candidate',parameters:{record_id:'candidate-'+n,record_hash:'a'.repeat(64)}},runContext);
  assert.equal(result.result.data.case_binding_id,'binding-candidate-'+n);assert.equal(result.result.data.create_task.assigneeActorId,betaId);assert.deepEqual(result.result.data.coordinator_notification,{state:'deferred',reason:'unresolved_blockers'});
 }
 const docs=await db.select().from(s.issueDocuments).where(eq(s.issueDocuments.issueId,scanId));assert.equal(docs.length,13);
 const comments=await db.select().from(s.issueComments).where(eq(s.issueComments.issueId,rootId));assert.equal(comments.length,13);
 const wakes=await db.select().from(s.agentWakeupRequests).where(eq(s.agentWakeupRequests.companyId,companyId));assert.equal(wakes.length,0);
 assert.equal((await db.select().from(s.issues).where(eq(s.issues.id,rootId)))[0].status,'blocked');assert.equal((await db.select().from(s.issueRelations).where(eq(s.issueRelations.relatedIssueId,rootId))).length,1);
 await db.update(s.issues).set({assigneeAgentId:null}).where(eq(s.issues.id,rootId));
 await assert.rejects(()=>dispatcher.executeTool('netrxn.inertia:funding_case_work',{operation:'reserve_candidate',parameters:{record_id:'candidate-0',record_hash:'a'.repeat(64)}},runContext),/Issue has no assigned agent to wake/);
 assert.equal((await db.select().from(s.issueDocuments).where(eq(s.issueDocuments.issueId,scanId))).length,13);
 console.log(JSON.stringify({actualSdk:true,actualNativePostgres:true,leads:13,replayPasses:2,nativeDocuments:docs.length,comments:comments.length,coordinatorWakes:0,dependencyPreserved:true,unexpectedNativeErrorPreserved:true,domainBoundary:'synthetic committed reservation',providerStarted:false}));
});
