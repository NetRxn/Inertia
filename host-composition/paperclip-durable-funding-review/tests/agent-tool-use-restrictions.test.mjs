// Actual native HTTP route, SQL authority and grant mutation; no runtime or provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
const publicRoot=process.env.QUALIFICATION_PUBLIC_ROOT??'/qual/source';
const {nativeDatabase,nativeIdentityFixture,loadNative,schema,eq}=await import(pathToFileURL(path.join(publicRoot,'scripts/drafting-qualification/native-fixture.mjs')));
const {agentRoutes}=await loadNative('@paperclipai/server/dist/routes/agents.js');
const {default:express}=await loadNative('express/index.js');
const approved=['netrxn.inertia:funding_drafting_workspace','netrxn.inertia:save_funding_proposals','netrxn.inertia:save_funding_gap_progress','netrxn.inertia:funding_drafting_checkpoint'].sort();
// Public concurrency contract: exact stored row identity, scope and update version.
const fingerprint=g=>createHash('sha256').update(JSON.stringify({version:1,companyId:g.companyId,agentId:g.principalId,grantId:g.id,scope:g.scope,updatedAt:g.updatedAt.toISOString()})).digest('hex');
async function rows(f){return{grants:await f.db.select().from(schema.principalPermissionGrants),agents:await f.db.select().from(schema.agents),memberships:await f.db.select().from(schema.companyMemberships),companies:await f.db.select().from(schema.companies),audit:await f.db.select().from(schema.activityLog)};}
async function fixture(actorOverride){
 const f=await nativeDatabase(),ids=await nativeIdentityFixture(f.db);
 for(const role of ['producer','reviewer'])await f.db.insert(schema.companyMemberships).values({companyId:ids.companyId,principalType:'agent',principalId:ids[role].agentId,status:'active',membershipRole:'member'});
 const [grant]=await f.db.insert(schema.principalPermissionGrants).values({companyId:ids.companyId,principalType:'agent',principalId:ids.producer.agentId,permissionKey:'tools:use',scope:null,grantedByUserId:'original-operator'}).returning();
 await f.db.insert(schema.principalPermissionGrants).values({companyId:ids.companyId,principalType:'agent',principalId:ids.producer.agentId,permissionKey:'tasks:assign',scope:{subtreeRootAgentId:ids.producer.agentId},grantedByUserId:'original-operator'});
 const app=express();app.use(express.json());app.use((req,_res,next)=>{req.actor=actorOverride?actorOverride(ids):{type:'board',userId:'local-board',source:'local_implicit',isInstanceAdmin:true,companyIds:[ids.companyId]};next();});app.use('/api',agentRoutes(f.db));
 app.use((error,_req,res,_next)=>res.status(error.status??(error.name==='ZodError'?400:500)).json({error:error.message}));app.use((_req,res)=>res.status(404).json({error:'Native route not found'}));
 const listener=app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
 return {...f,...ids,grant,url:'http://127.0.0.1:'+listener.address().port+'/api/agents/'+ids.producer.agentId+'/tool-use-restrictions',async close(){listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));await f.client.close();}};
}
const body=f=>({toolNames:approved,expectedGrantFingerprint:fingerprint(f.grant)});
async function post(f,value=body(f)){const r=await fetch(f.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});return{status:r.status,body:await r.json()};}

test('board restricts only the existing agent tools:use row and records the real actor and both scopes atomically',async()=>{
 const f=await fixture();try{
  const before=await rows(f),r=await post(f);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.replayed,false);assert.deepEqual(r.body.toolNames,approved);
  const after=await rows(f),changed=after.grants.find(g=>g.id===f.grant.id);assert.deepEqual(changed.scope,{allow:approved.map(n=>'tool:'+n)});assert.equal(r.body.grantFingerprint,fingerprint(changed));
  assert.equal(changed.id,f.grant.id);assert.equal(changed.grantedByUserId,'original-operator');assert.deepEqual(changed.createdAt,f.grant.createdAt);
  assert.deepEqual(after.grants.filter(g=>g.id!==f.grant.id),before.grants.filter(g=>g.id!==f.grant.id));assert.deepEqual(after.agents,before.agents);assert.deepEqual(after.memberships,before.memberships);assert.deepEqual(after.companies,before.companies);
  assert.equal(after.audit.length,1);const a=after.audit[0];assert.equal(a.action,'agent.tool_use_restricted');assert.equal(a.actorType,'user');assert.equal(a.actorId,'local-board');assert.equal(a.companyId,f.companyId);assert.equal(a.entityId,f.producer.agentId);assert.equal(a.details.beforeScope,null);assert.deepEqual(a.details.afterScope,changed.scope);assert.equal(a.details.expectedGrantFingerprint,fingerprint(f.grant));assert.equal(a.details.grantFingerprint,r.body.grantFingerprint);
 }finally{await f.close();}
});

test('strict fingerprint retries are read-only and stale original fingerprints fail closed',async()=>{
 const f=await fixture();try{
  const first=await post(f);assert.equal(first.status,200,JSON.stringify(first.body));const before=await rows(f);
  const retry=await post(f,{...body(f),expectedGrantFingerprint:first.body.grantFingerprint});assert.equal(retry.status,200,JSON.stringify(retry.body));assert.equal(retry.body.replayed,true);assert.deepEqual(await rows(f),before);
  const stale=await post(f);assert.equal(stale.status,409,JSON.stringify(stale.body));assert.deepEqual(await rows(f),before);
 }finally{await f.close();}
});

test('finite native grants may only shrink and unsupported historical scopes cannot be rewritten',async()=>{
 const f=await fixture();try{
  for(const scope of [{allow:approved.map(n=>'tool:'+n)},{toolNames:approved}]){
   [f.grant]=await f.db.update(schema.principalPermissionGrants).set({scope,updatedAt:new Date()}).where(eq(schema.principalPermissionGrants.id,f.grant.id)).returning();
   let before=await rows(f),r=await post(f,{...body(f),toolNames:[...approved,'netrxn.inertia:review_funding_candidate']});assert.equal(r.status,409,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
   r=await post(f,{...body(f),toolNames:[approved[0]]});assert.equal(r.status,200,JSON.stringify(r.body));
  }
  for(const scope of [{allow:['application:some-app']},{allow:approved.map(n=>'tool:'+n),projectId:f.projectId},{unexpected:true},{allow:['tool:netrxn.inertia:*']}]){
   [f.grant]=await f.db.update(schema.principalPermissionGrants).set({scope,updatedAt:new Date()}).where(eq(schema.principalPermissionGrants.id,f.grant.id)).returning();
   const before=await rows(f),r=await post(f);assert.equal(r.status,409,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
  }
 }finally{await f.close();}
});

test('invalid bodies cannot change any native authority',async()=>{
 const f=await fixture();try{
  for(const patch of [{toolNames:[]},{toolNames:['*']},{toolNames:['netrxn.inertia:*']},{toolNames:['funding_drafting_workspace']},{toolNames:['netrxn.inertia:funding_drafting_workspace','netrxn.inertia:funding_drafting_workspace']},{toolNames:'netrxn.inertia:funding_drafting_workspace'},{expectedGrantFingerprint:'bad'},{expectedGrantFingerprint:undefined},{unexpected:true},{companyId:randomUUID()},{agentId:f.reviewer.agentId}]){
   const before=await rows(f),r=await post(f,{...body(f),...patch});assert.equal(r.status,400,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
  }
 }finally{await f.close();}
});

for(const field of ['toolNames','expectedGrantFingerprint'])test('a trailing newline in '+field+' is a malformed body, not an exact selector or version',async()=>{
 const f=await fixture();try{
  const before=await rows(f),value=body(f);if(field==='toolNames')value.toolNames=[approved[0]+'\n'];else value.expectedGrantFingerprint+='\n';
  const r=await post(f,value);assert.equal(r.status,400,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
 }finally{await f.close();}
});

test('agent and CEO callers cannot invoke this administrative operation',async()=>{
 for(const role of ['engineer','ceo']){
  const f=await fixture(ids=>({type:'agent',companyId:ids.companyId,agentId:ids.producer.agentId,runId:ids.producer.runId,source:'agent_jwt'}));try{
   await f.db.update(schema.agents).set({role}).where(eq(schema.agents.id,f.producer.agentId));const before=await rows(f),r=await post(f);assert.equal(r.status,403,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
  }finally{await f.close();}
 }
});

test('board identity without current permission or company access is denied',async()=>{
 for(const actor of [ids=>({type:'board',userId:'unprivileged-board',source:'session',companyIds:[ids.companyId]}),()=>({type:'board',userId:'foreign-board',source:'session',companyIds:[]})]){
  const f=await fixture(actor);try{const before=await rows(f),r=await post(f);assert([403,404].includes(r.status),JSON.stringify(r.body));assert.deepEqual(await rows(f),before);}finally{await f.close();}
 }
});

test('missing or inactive membership, terminated agent and absent grant cannot be repaired or resurrected',async()=>{
 const f=await fixture();try{
  for(const status of ['suspended','archived']){await f.db.update(schema.companyMemberships).set({status}).where(eq(schema.companyMemberships.principalId,f.producer.agentId));const before=await rows(f),r=await post(f);assert.equal(r.status,409,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);}
  await f.db.update(schema.companyMemberships).set({status:'active'}).where(eq(schema.companyMemberships.principalId,f.producer.agentId));await f.db.update(schema.agents).set({status:'terminated'}).where(eq(schema.agents.id,f.producer.agentId));let before=await rows(f),r=await post(f);assert.equal(r.status,409,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
  await f.db.update(schema.agents).set({status:'paused'}).where(eq(schema.agents.id,f.producer.agentId));await f.db.delete(schema.companyMemberships).where(eq(schema.companyMemberships.principalId,f.producer.agentId));before=await rows(f);r=await post(f);assert.equal(r.status,409,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
  await f.db.insert(schema.companyMemberships).values({companyId:f.companyId,principalType:'agent',principalId:f.producer.agentId,status:'active',membershipRole:'member'});await f.db.delete(schema.principalPermissionGrants).where(eq(schema.principalPermissionGrants.id,f.grant.id));before=await rows(f);r=await post(f);assert.equal(r.status,409,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
 }finally{await f.close();}
});

test('concurrent requests using one fingerprint serialize to one restriction and audit',async()=>{
 const f=await fixture();try{
  const results=await Promise.all([post(f),post(f)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const after=await rows(f);assert.equal(after.audit.length,1);assert.deepEqual(after.grants.find(g=>g.id===f.grant.id).scope,{allow:approved.map(n=>'tool:'+n)});
 }finally{await f.close();}
});

async function humanAuthority(f){
 await f.db.insert(schema.companyMemberships).values({companyId:f.companyId,principalType:'user',principalId:'permission-admin',status:'active',membershipRole:'member'});
 const [grant]=await f.db.insert(schema.principalPermissionGrants).values({companyId:f.companyId,principalType:'user',principalId:'permission-admin',permissionKey:'users:manage_permissions',scope:null}).returning();return grant;
}
const humanActor=ids=>({type:'board',userId:'permission-admin',source:'session',companyIds:[ids.companyId]});
test('current authenticated human permission admits restriction and its revocation denies the next operation',async()=>{
 const f=await fixture(humanActor);try{
  const authority=await humanAuthority(f),first=await post(f);assert.equal(first.status,200,JSON.stringify(first.body));
  const audit=(await rows(f)).audit;assert.equal(audit[0].actorId,'permission-admin');
  await f.db.delete(schema.principalPermissionGrants).where(eq(schema.principalPermissionGrants.id,authority.id));
  const before=await rows(f),r=await post(f,{toolNames:[approved[0]],expectedGrantFingerprint:first.body.grantFingerprint});assert.equal(r.status,403,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
 }finally{await f.close();}
});

test('human membership revoked after route admission is rechecked inside the mutation transaction',async()=>{
 const f=await fixture(humanActor);try{
  await humanAuthority(f);const before=await rows(f),transaction=f.db.transaction.bind(f.db);let entered=false;
  f.db.transaction=async(...args)=>{if(!entered){entered=true;await f.db.update(schema.companyMemberships).set({status:'suspended'}).where(eq(schema.companyMemberships.principalId,'permission-admin'));}return transaction(...args);};
  const r=await post(f);assert.equal(entered,true);assert.equal(r.status,403,JSON.stringify(r.body));const after=await rows(f);assert.deepEqual(after.grants,before.grants);assert.deepEqual(after.agents,before.agents);assert.deepEqual(after.audit,before.audit);assert.equal(after.memberships.find(m=>m.principalId==='permission-admin').status,'suspended');
 }finally{await f.close();}
});

test('company state and exact company membership cannot be bypassed by a foreign matching principal row',async()=>{
 const f=await fixture();try{
  await f.db.update(schema.companies).set({status:'paused'}).where(eq(schema.companies.id,f.companyId));let before=await rows(f),r=await post(f);assert.equal(r.status,409,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
  await f.db.update(schema.companies).set({status:'active'}).where(eq(schema.companies.id,f.companyId));
  const [foreign]=await f.db.insert(schema.companies).values({name:'Foreign fixture',issuePrefix:'FTR'}).returning();await f.db.update(schema.companyMemberships).set({companyId:foreign.id}).where(eq(schema.companyMemberships.principalId,f.producer.agentId));
  before=await rows(f);r=await post(f);assert.equal(r.status,409,JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
 }finally{await f.close();}
});

test('a board actor scoped to one company cannot restrict another company agent',async()=>{
 const f=await fixture(humanActor);try{
  await humanAuthority(f);await f.db.update(schema.companies).set({issuePrefix:'QDA'}).where(eq(schema.companies.id,f.companyId));const other=await nativeIdentityFixture(f.db);
  f.url=f.url.replace(f.producer.agentId,other.producer.agentId);const before=await rows(f),r=await post(f);assert([403,404].includes(r.status),JSON.stringify(r.body));assert.deepEqual(await rows(f),before);
 }finally{await f.close();}
});
