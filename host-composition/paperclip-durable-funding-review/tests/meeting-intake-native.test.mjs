/** Pinned actual SDK host + native PostgreSQL, synthetic no-network process adapter only. */
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import{randomUUID}from'node:crypto';import{pathToFileURL}from'node:url';
if(process.env.QUALIFY_DISPOSABLE!=='1')test('meeting intake needs disposable pinned runtime',{skip:true},()=>{});
else{
 const source=process.env.QUALIFICATION_PUBLIC_ROOT??'/qual/source',native='/opt/host/node_modules';const load=p=>import(pathToFileURL(native+'/'+p));
 const{startEmbeddedPostgresTestDatabase,createDb}=await load('@paperclipai/db/dist/index.js'),schema=await load('@paperclipai/db/dist/schema/index.js'),{eq}=await load('drizzle-orm/index.js');
 const{heartbeatService}=await load('@paperclipai/server/dist/services/heartbeat.js');
 const{buildHostServices}=await load('@paperclipai/server/dist/services/plugin-host-services.js'),{createPluginEventBus}=await load('@paperclipai/server/dist/services/plugin-event-bus.js'),{createHostClientHandlers}=await load('@paperclipai/plugin-sdk/dist/index.js');
 const{reconcileMeetingIntake}=await import(pathToFileURL(source+'/dist/src/roundtable/intake.js'));
 let temp,db,services,client;const companyId=randomUUID(),projectId=randomUUID(),agentId=randomUUID(),pluginId=randomUUID();
 before(async()=>{
  temp=await startEmbeddedPostgresTestDatabase('meeting-intake-');db=createDb(temp.connectionString);
  await db.insert(schema.companies).values({id:companyId,name:'Synthetic native intake',issuePrefix:'M'+companyId.replaceAll('-','').slice(0,7).toUpperCase(),defaultResponsibleUserId:'controlled-owner'});
  await db.insert(schema.companyMemberships).values({companyId,principalType:'user',principalId:'controlled-owner',status:'active',membershipRole:'owner'});
  await db.insert(schema.projects).values({id:projectId,companyId,name:'Synthetic meeting follow-through'});
  await db.insert(schema.agents).values({id:agentId,companyId,name:'Synthetic no-network adapter',role:'ceo',status:'idle',adapterType:'process',adapterConfig:{command:'/usr/bin/true'},runtimeConfig:{},permissions:{}});
  await db.execute((await load('drizzle-orm/index.js')).sql.raw('CREATE SCHEMA "plugin_netrxn_inertia_e936d62b87"'));
  const sql=(await load('drizzle-orm/index.js')).sql;
  for(const file of['004_runtime_state.sql','007_objective_intake.sql'])await db.execute(sql.raw(await fs.readFile(source+'/migrations/'+file,'utf8')));
  services=buildHostServices(db,pluginId,'netrxn.inertia',createPluginEventBus());client=createHostClientHandlers({pluginId:'netrxn.inertia',capabilities:['issues.read','issues.create','issues.update','issues.wakeup'],services});
 });
 after(async()=>{if(db)await heartbeatService(db).drainActiveRunExecutions();services?.dispose();await temp?.cleanup();});
 const invoke=(name,params)=>client[name](params,{invocationScope:{companyId}});
 const issueClient={list:input=>invoke('issues.list',input),get:(issueId,companyId)=>invoke('issues.get',{issueId,companyId}),create:async input=>{try{return await invoke('issues.create',input);}catch(e){throw new Error('native create: '+e.message);}},update:(issueId,patch,companyId)=>invoke('issues.update',{issueId,patch,companyId}),requestWakeup:(issueId,companyId,options)=>invoke('issues.requestWakeup',{issueId,companyId,...options})};
 function context(){return{issues:issueClient,db:{namespace:'plugin_netrxn_inertia_e936d62b87',query:async(q,p)=>await db.$client.unsafe(q,p),execute:async(q,p)=>({rowCount:(await db.$client.unsafe(q,p)).count??0})}};}
 const binding=id=>({companyId,meetingId:id,origin:'https://controlled.example',principalId:'synthetic',nativeIntake:{organizationId:'controlled-org',intakeAgentId:agentId,projectId,referenceOnly:true,sourceAccess:true,autoStart:true}});
 test('actual SDK creates todo, admits one native wake and preserves exact task/receipt across correction restart',async()=>{
  const b=binding('controlled-ready'),ctx=context();await ctx.db.query('SELECT 1',[]);await issueClient.list({companyId,includePluginOperations:true});const one=await reconcileMeetingIntake(ctx,b,{state:'published'},'v1',async()=>true);
  assert.equal(one?.status,'applied',JSON.stringify(one));const row=await issueClient.get(one.nativeIssueId,companyId);assert.equal(row.projectId,projectId);assert.equal(row.assigneeAgentId,agentId);assert.notEqual(row.status,'backlog');
  for(const revision of['v1','v2','v2']){const replay=await reconcileMeetingIntake(context(),structuredClone(b),{state:'published'},revision,async()=>true);assert(['applied','replayed'].includes(replay.status),JSON.stringify(replay));assert.equal(replay.nativeIssueId,one.nativeIssueId);}
  const wakes=await db.select().from(schema.agentWakeupRequests).where(eq(schema.agentWakeupRequests.agentId,agentId));assert.equal(wakes.length,1);assert.equal(wakes[0].payload.issueId,one.nativeIssueId);assert(wakes[0].runId);assert.equal(wakes[0].requestedByActorId,pluginId);
  const rows=await issueClient.list({companyId,includePluginOperations:true});assert.equal(rows.length,1);
 });
 test('actual SDK preserves default backlog and rejects wake; missing capability cannot bypass native admission',async()=>{
  const b=binding('controlled-human-review');b.nativeIntake.autoStart=false;const r=await reconcileMeetingIntake(context(),b,{state:'published'},'v1',async()=>true);assert.equal(r.status,'applied');assert.equal((await issueClient.get(r.nativeIssueId,companyId)).status,'backlog');await assert.rejects(()=>issueClient.requestWakeup(r.nativeIssueId,companyId,{}),/not wakeable/);
  const denied=createHostClientHandlers({pluginId:'netrxn.inertia',capabilities:['issues.read'],services});await assert.rejects(()=>denied['issues.requestWakeup']({issueId:r.nativeIssueId,companyId},{invocationScope:{companyId}}));
 });
}
