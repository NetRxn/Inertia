import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {authUsers,companyMemberships,companies,principalPermissionGrants,activityLog} from '@paperclipai/db';
import {fixture,db,client} from '../../tests/fixture.mjs';
import {createApp} from '../../node_modules/@paperclipai/server/dist/app.js';
import {parseFundingPageRequest,parseFundingOpportunityPage} from '../../../../dist/src/member-funding/contracts.js';
const mod=await import('../native/member-funding-read.mjs').catch(e=>e.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(e));
after(()=>client.end());
const page=()=>({schema:'inertia.member-funding-opportunities.v1',opportunities:[{id:'public-opportunity',sponsor:null,program:'Synthetic catalog',route:null,summary:null,deadline:'2026-11-20',benefit:null,effort:null,nextStep:null,sourceUrl:'https://example.org/fund',observedAt:'2026-10-25T12:00:00Z',initiativeId:null}],nextCursor:null});
async function setup(options={}) {
 assert.equal(typeof mod.createMemberFundingReadRouter,'function','native read-only funding router exists');
 const f=await fixture();
 await db.insert(authUsers).values({id:f.userId,name:'Synthetic viewer',email:`${f.userId}@example.invalid`,createdAt:new Date(),updatedAt:new Date()});
 await db.update(companyMemberships).set({membershipRole:'viewer'}).where(eq(companyMemberships.principalId,f.userId));
 await db.delete(principalPermissionGrants).where(eq(principalPermissionGrants.companyId,f.companyId));
 let reads=0;
 const config={enabled:true,db,companyId:f.companyId,contracts:{parseRequest:parseFundingPageRequest,parsePage:parseFundingOpportunityPage},
   async readOpportunities(q,callbacks){reads++;const context=await callbacks.context();assert.deepEqual(context,{company_id:f.companyId,user_id:f.userId});return options.read?options.read(f,q,callbacks):page();}};
 const old=express.Router();old.get('/existing-read',(_req,res)=>res.json({existing:true}));
 if(options.compose)config.existingMount={db,beforeBodyParser:(_req,_res,next)=>next(),router:old};
 const host=mod.createMemberFundingReadRouter({...config,...options.config});
 const app=await createApp(db,{uiMode:'none',serverPort:0,storageService:{},deploymentMode:'authenticated',deploymentExposure:'private',allowedHostnames:['127.0.0.1'],bindHost:'127.0.0.1',authReady:true,companyDeletionEnabled:false,managedPluginAutoInstall:[],localPluginDir:`${process.env.NATIVE_CAPTURE_FIXTURE_ROOT}/plugins`,resolveSession:async()=>options.anonymous?null:{session:{id:'synthetic-funding-session'},user:{id:f.userId}},...host.appOptions});await app.locals.bundledPluginsStartup;
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const origin=`http://127.0.0.1:${server.address().port}`,base=`${origin}/api/member-packet-actions/companies/${f.companyId}/funding`;
 return{f,host,config,origin,base,reads:()=>reads,request:(suffix='/opportunities',init={})=>fetch(base+suffix,init),async close(){await new Promise(r=>server.close(r));await app.locals.paperclipShutdown();}};
}
test('default-disabled catalog does not mount or read any source',()=>{assert.equal(typeof mod.createMemberFundingReadRouter,'function');const host=mod.createMemberFundingReadRouter();assert.deepEqual(host.appOptions,{});});
test('actual native Viewer reads published catalog without packet/action bindings or write grants',async()=>{const x=await setup();try{const response=await x.request();assert.equal(response.status,200,await response.clone().text());assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),page());const count=await db.select({count:sql`count(*)`}).from(activityLog).where(eq(activityLog.companyId,x.f.companyId));assert.equal(Number(count[0].count),0);}finally{await x.close();}});
test('applications remain explicitly unavailable rather than claiming an authorized empty list',async()=>{const x=await setup();try{const response=await x.request('/applications');assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'application_reads_unavailable'});assert.equal(x.reads(),0);}finally{await x.close();}});
for(const change of ['anonymous','inactive-member','inactive-company','wrong-company'])test(`current native catalog access denies ${change}`,async()=>{const x=await setup({anonymous:change==='anonymous'});try{if(change==='inactive-member')await db.update(companyMemberships).set({status:'inactive'}).where(eq(companyMemberships.principalId,x.f.userId));if(change==='inactive-company')await db.update(companies).set({status:'archived'}).where(eq(companies.id,x.f.companyId));const response=change==='wrong-company'?await fetch(x.base.replace(x.f.companyId,randomUUID())+'/opportunities'):await x.request();assert.ok([401,403,404].includes(response.status),await response.text());assert.equal(x.reads(),0);}finally{await x.close();}});
test('revocation during source read denies response after a fresh native membership recheck',async()=>{const x=await setup({async read(f){await db.update(companyMemberships).set({status:'inactive'}).where(eq(companyMemberships.principalId,f.userId));return page();}});try{const response=await x.request();assert.equal(response.status,403);assert.ok(!(await response.text()).includes('Synthetic catalog'));}finally{await x.close();}});
for(const suffix of ['/opportunities?limit=101','/opportunities?limit=1&limit=2','/opportunities?user_id=forged','/opportunities?cursor=bad%20cursor'])test(`strict bounded query rejects ${suffix}`,async()=>{const x=await setup();try{assert.equal((await x.request(suffix)).status,400);assert.equal(x.reads(),0);}finally{await x.close();}});
test('read ingress refuses mutation methods and request bodies before source work',async()=>{const x=await setup();try{assert.equal((await x.request('/opportunities',{method:'POST'})).status,405);assert.equal((await x.request('/opportunities',{method:'POST',headers:{'content-type':'application/json'},body:'{"userId":"forged"}'})).status,400);assert.equal((await x.request('/opportunities',{method:'HEAD'})).status,405);assert.equal(x.reads(),0);}finally{await x.close();}});
test('source errors and private response extras never reach the member',async()=>{for(const read of [async()=>{throw Error('private source details');},async()=>({...page(),packet:{private:true}})]){const x=await setup({read});try{const response=await x.request();assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'funding_read_unavailable'});}finally{await x.close();}}});
test('read-only mount composes with existing Packet routes without replacing them',async()=>{const x=await setup({compose:true});try{assert.equal((await x.request()).status,200);assert.deepEqual(await (await fetch(x.origin+'/api/member-packet-actions/existing-read')).json(),{existing:true});assert.throws(()=>mod.createMemberFundingReadRouter({...x.config,existingMount:{db:{},beforeBodyParser(){},router(){}}}),/root|composition/);}finally{await x.close();}});
