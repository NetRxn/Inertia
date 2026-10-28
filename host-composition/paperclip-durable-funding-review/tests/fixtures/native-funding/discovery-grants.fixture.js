// Actual native HTTP/SQL; local-trusted preprod operator only. Synthetic records, no provider.
import{beforeAll,afterAll,it,expect}from'/qual/admission-source/node_modules/vitest/dist/index.js';
import{randomUUID,createHash}from'node:crypto';import{eq,and}from'drizzle-orm';
import{companies,projects,agents,issues,companyMemberships,principalPermissionGrants,pluginConfig,plugins,activityLog}from'@paperclipai/db';
import{nativeDatabase}from'/qual/combined/native-fixture-real-pg.mjs';import express from'express';import{agentRoutes}from'../../routes/agents.js';import{discoveryFingerprint}from'./native-discovery-policy.mjs';
let temp,db,plugin;const listeners=[];
const sha=g=>createHash('sha256').update(JSON.stringify({version:1,companyId:g.companyId,agentId:g.principalId,grantId:g.id,scope:g.scope,updatedAt:g.updatedAt.toISOString()})).digest('hex');
beforeAll(async()=>{temp=await nativeDatabase();db=temp.db;plugin=randomUUID();await db.insert(plugins).values({id:plugin,pluginKey:'netrxn.inertia',packageName:'synthetic-discovery-grants',version:'0.1.0',manifestJson:{id:'netrxn.inertia'},status:'ready'});},180000);
afterAll(async()=>{for(const x of listeners){x.closeAllConnections();await new Promise(r=>x.close(r));}await temp?.client.close();},30000);
async function fixture(){
 const co=randomUUID(),project=randomUUID(),scout=randomUUID(),reviewer=randomUUID(),si=randomUUID(),ri=randomUUID();
 await db.insert(companies).values({id:co,name:'Synthetic exact web grant',issuePrefix:'Q'+co.replaceAll('-','').slice(0,7).toUpperCase()});await db.insert(projects).values({id:project,companyId:co,name:'Synthetic public funding'});
 const config={provider:'codex',engine:'cli',disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never'};
 for(const[id,role,issue]of[[scout,'producer',si],[reviewer,'reviewer',ri]]){await db.insert(agents).values({id,companyId:co,name:'Synthetic '+role,role:'general',status:'idle',adapterType:'paperclip_runner',adapterConfig:{...config,nativeFunding:{version:1,role,projectIds:[project],issueIds:[issue]}}});await db.insert(companyMemberships).values({companyId:co,principalType:'agent',principalId:id,status:'active',membershipRole:'member'});await db.insert(issues).values({id:issue,companyId:co,projectId:project,title:'Synthetic exact public task',status:'backlog',workMode:'standard',assigneeAgentId:id});}
 const discovery={enabled:true,key:'public-synthetic',organizationId:'synthetic-org',projectId:project,issueId:si,agentId:scout,principalId:'synthetic-scout',process:{},publicQueries:['public foundation grants'],diligence:{issueId:ri,agentId:reviewer,principalId:'synthetic-reviewer',process:{},policyId:'exact-v1'}};
 await db.insert(pluginConfig).values({pluginId:plugin,companyId:co,configJson:{fundingDiscovery:discovery}});
 const grants=[];for(const id of[scout,reviewer]){const[g]=await db.insert(principalPermissionGrants).values({companyId:co,principalType:'agent',principalId:id,permissionKey:'tools:use',scope:{allow:['tool:netrxn.inertia:funding_drafting_workspace']},grantedByUserId:'prior-owner'}).returning();grants.push(g);await db.insert(principalPermissionGrants).values({companyId:co,principalType:'agent',principalId:id,permissionKey:'tasks:assign',scope:{subtreeRootAgentId:id}});}
 let actor={type:'board',source:'local_implicit',userId:'synthetic-board',isInstanceAdmin:true,companyIds:[co]};const app=express();app.use(express.json());app.use((req,_res,next)=>{req.actor=actor;next();});app.use('/api',agentRoutes(db));app.use((e,_q,res,_n)=>res.status(e.status??500).json({error:e.message}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));listeners.push(server);
 return{co,scout,reviewer,si,ri,discovery,grants,url:'http://127.0.0.1:'+server.address().port+'/api/agents/',actor:x=>actor=x};
}
const grant=async id=>(await db.select().from(principalPermissionGrants).where(eq(principalPermissionGrants.id,id)))[0];
const audit=async f=>db.select().from(activityLog).where(eq(activityLog.companyId,f.co));
async function post(f,id,g,extra={}){const r=await fetch(f.url+id+'/discovery-tool-use',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedGrantFingerprint:sha(g),expectedDiscoveryFingerprint:discoveryFingerprint(f.discovery),...extra})});return{status:r.status,body:await r.json()};}
it('actual native route adds only exact role tools and preserves unrelated grants; lost acknowledgement reconciles read-only',async()=>{
 const f=await fixture();const before=await db.select().from(principalPermissionGrants).where(eq(principalPermissionGrants.companyId,f.co));
 for(const[id,g,names]of[[f.scout,f.grants[0],['funding-discovery-context','funding-discovery-submit']],[f.reviewer,f.grants[1],['funding-diligence-context','funding-diligence-submit','funding-source-validation-submit','funding-facts-submit']]]){
  const r=await post(f,id,g);expect(r.status).toBe(200);const current=await grant(g.id);expect(current.scope.allow).toEqual(['tool:netrxn.inertia:funding_drafting_workspace',...names.map(n=>'tool:netrxn.inertia:'+n)].sort());expect(current.grantedByUserId).toBe(g.grantedByUserId);expect(current.createdAt).toEqual(g.createdAt);
  const stale=await post(f,id,g);expect(stale.status).toBe(409);const retry=await post(f,id,current);expect(retry.status).toBe(200);expect(retry.body.replayed).toBe(true);
 }
 const after=await db.select().from(principalPermissionGrants).where(eq(principalPermissionGrants.companyId,f.co));expect(after.filter(x=>x.permissionKey!=='tools:use')).toEqual(before.filter(x=>x.permissionKey!=='tools:use'));expect((await audit(f)).length).toBe(2);
});
it('invalid body, stale configuration, wrong task/ceiling, wildcard scope and non-local/agent actors fail without writes',async()=>{
 const f=await fixture(),g=f.grants[0];
 for(const extra of[{unexpected:true},{expectedGrantFingerprint:'0'.repeat(64)},{expectedDiscoveryFingerprint:'0'.repeat(64)},{expectedGrantFingerprint:sha(g)+'\n'}]){const r=await post(f,f.scout,g,extra);expect([400,409]).toContain(r.status);expect(await grant(g.id)).toEqual(g);}
 for(const actor of[{type:'agent',companyId:f.co,agentId:f.scout,source:'agent_jwt'},{type:'board',userId:'session-admin',source:'session',isInstanceAdmin:true,companyIds:[f.co]}]){f.actor(actor);expect((await post(f,f.scout,g)).status).toBe(403);expect(await grant(g.id)).toEqual(g);}
 f.actor({type:'board',source:'local_implicit',userId:'synthetic-board',isInstanceAdmin:true,companyIds:[f.co]});
 await db.update(issues).set({assigneeAgentId:f.reviewer}).where(eq(issues.id,f.si));expect((await post(f,f.scout,g)).status).toBe(409);await db.update(issues).set({assigneeAgentId:f.scout}).where(eq(issues.id,f.si));
 const [agent]=await db.select().from(agents).where(eq(agents.id,f.scout));await db.update(agents).set({adapterConfig:{...agent.adapterConfig,nativeFunding:{...agent.adapterConfig.nativeFunding,issueIds:[randomUUID()]}}}).where(eq(agents.id,f.scout));expect((await post(f,f.scout,g)).status).toBe(409);await db.update(agents).set({adapterConfig:agent.adapterConfig}).where(eq(agents.id,f.scout));
 await db.update(principalPermissionGrants).set({scope:{allow:['tool:netrxn.inertia:*']}}).where(eq(principalPermissionGrants.id,g.id));expect((await post(f,f.scout,await grant(g.id))).status).toBe(409);expect((await audit(f)).length).toBe(0);
});
it('same-fingerprint concurrent additions produce one mutation/audit and disabled discovery denies future use',async()=>{
 const f=await fixture(),g=f.grants[0];const results=await Promise.all([post(f,f.scout,g),post(f,f.scout,g)]);expect(results.map(x=>x.status).sort()).toEqual([200,409]);expect((await audit(f)).length).toBe(1);
 await db.update(pluginConfig).set({configJson:{fundingDiscovery:{...f.discovery,enabled:false}}}).where(and(eq(pluginConfig.pluginId,plugin),eq(pluginConfig.companyId,f.co)));expect((await post(f,f.reviewer,f.grants[1])).status).toBe(409);expect((await audit(f)).length).toBe(1);
});
