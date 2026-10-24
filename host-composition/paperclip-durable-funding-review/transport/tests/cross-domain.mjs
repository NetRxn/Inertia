/** Disposable qualification: actual native auth/capture routes -> real DFW HTTP/domain. */
import assert from 'node:assert/strict';
import {randomUUID, randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import express from 'express';
import {eq} from 'drizzle-orm';
import {authUsers, companyMemberships, principalPermissionGrants, documents} from '@paperclipai/db';
import {createAcceptanceRouter, digestJson} from '../native/acceptance-routes.mjs';
import {createAcceptanceReconciler} from '../native/reconcile.mjs';
const root=process.env.REVIEW_NATIVE_ROOT;
const python=process.env.REVIEW_PYTHON;
const project=process.env.REVIEW_DFW_PROJECT;
const postgresLane=process.argv.slice(2).includes('--postgres');
if(process.argv.slice(2).some(arg=>arg!=='--postgres'))throw Error('Unknown qualification lane');
const postgresHandoff=process.env.REVIEW_DFW_POSTGRES_HANDOFF;
if(postgresLane&&!postgresHandoff)throw Error('Use the private disposable PostgreSQL transport launcher');
if(!root||!python||!project)throw Error('Explicit qualified fixture roots required');
const {fixture,binding,db,client}=await import(`${root}/tests/fixture.mjs`);
const {qualificationRetention}=await import(`${root}/tests/retention.mjs`);
const {createFundingReviewCapture}=await import(`${root}/node_modules/@paperclipai/server/dist/services/funding-review-capture.js`);
const {issueThreadInteractionService}=await import(`${root}/node_modules/@paperclipai/server/dist/services/issue-thread-interactions.js`);
const {actorMiddleware}=await import(`${root}/node_modules/@paperclipai/server/dist/middleware/auth.js`);
const {boardAuthService}=await import(`${root}/node_modules/@paperclipai/server/dist/services/board-auth.js`);
const here=path.dirname(new URL(import.meta.url).pathname);
const pyenv={...process.env,DFW_SOURCE_ROOT:project,PYTHONPATH:`${project}/src:${project}/tests`};
for(const key of Object.keys(pyenv))if(key.startsWith('NATIVE_CAPTURE_')||key.startsWith('PG'))delete pyenv[key];
async function launch(work,register) {
 const child=spawn(python,[path.join(project,'tests','dfw_transport_fixture.py'),'serve',work],{env:pyenv,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr=''; child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
 const stop=async()=>{
  if(child.exitCode!==null||child.signalCode!==null)return;
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('DFW fixture shutdown unconfirmed; retain its workspace')),5000);
   child.once('exit',()=>{clearTimeout(timer);resolve();});
   child.kill('SIGTERM');
  });
 };
 register({stop});
 try {
  const result=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('DFW fixture startup timeout')),15000);
   child.once('exit',()=>{clearTimeout(timer);reject(Error('DFW fixture failed: '+stderr.slice(-1000)));});
   child.stdout.on('data',chunk=>{stdout+=chunk.toString();try{const result=JSON.parse(stdout.split('\n')[0]);if(result.port){clearTimeout(timer);resolve(result);}}catch{}});
  });
  return {...result,stop};
 }catch(error){throw error;}
}

try {
 for(const [kind,disposition] of [['proposal','apply'],['packet_role','apply'],['packet_role','cancel']]){
  const work=await fs.mkdtemp(path.join(os.tmpdir(),'review-transport-fixture-'));
  let nativeServer,dfw;
  try {
   const init=spawnSync(python,[path.join(project,'tests','dfw_transport_fixture.py'),postgresLane?'init-postgres':'init',work,kind,...(postgresLane?[postgresHandoff]:[])],{env:pyenv,encoding:'utf8'});
   assert.equal(init.status,0,init.stderr);
   const input=JSON.parse(await fs.readFile(path.join(work,'funding-input.json'),'utf8'));
   const f=await fixture(postgresLane?3:1);const b={...binding(f),...input};
   const registrations=[b];
   if(postgresLane){
    for(const item of ['item-2','item-3'])registrations.push({...binding(f,item),...input,applicantId:'other-applicant',targetId:`${b.targetId}-${item}`});
    f.input.verdicts=registrations.map(value=>({id:value.itemId,verdict:'approve',reason:'Exact version reviewed'}));
   }
   const permissionKey=`funding.review.${b.reviewerRole}`;
   await db.update(principalPermissionGrants).set({permissionKey,scope:{applicantIds:postgresLane?[b.applicantId,'other-applicant']:[b.applicantId],sourceScopes:[b.sourceScope]}}).where(eq(principalPermissionGrants.companyId,f.companyId));
   const capture=createFundingReviewCapture({retention:qualificationRetention,registrations,rolePermissionKeys:{[b.reviewerRole]:permissionKey}});
   await issueThreadInteractionService(db,{captureItemVerdictsInTransaction:capture.captureInTransaction}).submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);
   const sourceReceipts=(await capture.listAcceptances(db,{companyId:f.companyId})).receipts;
   assert.equal(sourceReceipts.length,postgresLane?3:1);
   const receipt=sourceReceipts.find(value=>value.command.binding.applicantId===b.applicantId);assert.ok(receipt);
   // Real native authorization changes after acceptance do not change the instruction.
   await db.update(companyMemberships).set({status:'inactive'}).where(eq(companyMemberships.principalId,f.userId));
   await db.delete(principalPermissionGrants).where(eq(principalPermissionGrants.companyId,f.companyId));
   await db.update(documents).set({latestBody:'Later native edit',latestRevisionId:randomUUID()}).where(eq(documents.id,f.documentId));
   const readerId=randomUUID();await db.insert(authUsers).values({id:readerId,name:'Synthetic transport',email:`${readerId}@example.invalid`,createdAt:new Date(),updatedAt:new Date()});
   await db.insert(companyMemberships).values({companyId:f.companyId,principalType:'user',principalId:readerId,status:'active',membershipRole:'member'});
   const key=await boardAuthService(db).createNamedBoardApiKey({userId:readerId,name:'Disposable cross-domain transport'});
   const scope={schema:'inertia.funding-transport-scope.v1',sourceId:'fixture-native',destinationId:'fixture-dfw',companyId:f.companyId,applicantId:b.applicantId,sourceScope:b.sourceScope,purpose:'durable-funding-review'};
   const app=express();app.use(actorMiddleware(db,{deploymentMode:'authenticated'}));
   app.use('/api/funding-review-transport',createAcceptanceRouter({enabled:true,scope,principal:{userId:readerId,keyId:key.id},db,capture,lifecycle:{assertReadable:async()=>true}}));
   app.use((err,req,res,next)=>res.status(err.status||500).json({error:'request_rejected'}));
   nativeServer=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
   const nativeUrl=`http://127.0.0.1:${nativeServer.address().port}/api/funding-review-transport`;
   const fundingToken=randomBytes(24).toString('hex');
   await fs.writeFile(path.join(work,'native-receipt.json'),JSON.stringify(receipt),{mode:0o600});
   await fs.writeFile(path.join(work,'transport.json'),JSON.stringify({nativeUrl,scope,nativeToken:key.token,fundingToken}),{mode:0o600});
   dfw=await launch(work,child=>{dfw=child;});assert.equal(dfw.dialect,postgresLane?'postgresql':'sqlite');
   if(postgresLane)assert.equal(dfw.writerFence,'disposable-all-model-tables-share-row-exclusive');
   const fundingUrl=`http://127.0.0.1:${dfw.port}/funding-review-transport`;
   const headers={'X-Admin-Token':fundingToken,'X-Funding-Scope':digestJson(scope)};
   if(disposition==='cancel'){
    const cancelled=await fetch(`${fundingUrl}/acceptances/${receipt.acceptanceId}/cancel`,{method:'POST',headers});
    assert.equal(cancelled.status,200);assert.equal((await cancelled.json()).state,'cancelled');
   }
   if(postgresLane&&kind==='packet_role'&&disposition==='apply'){
    const duplicates=await Promise.all(Array.from({length:4},()=>fetch(`${fundingUrl}/acceptances/${receipt.acceptanceId}/apply`,{method:'POST',headers})));
    for(const response of duplicates){assert.equal(response.status,200);assert.equal((await response.json()).state,'applied');}
   }
   const state=new Map(),acks=[],invocations=[];
   let calls=[],lost=false,readbacks=0;
   const fixtureFetch=async(url,options)=>{
    calls.push({url,method:options.method});
    const response=await fetch(url,options);
    if(url.startsWith(fundingUrl)&&url.endsWith('/outcome'))readbacks++;
    if(postgresLane&&kind==='proposal'&&options.method==='POST'&&url.endsWith('/apply')&&!lost){
     assert.equal(response.status,200);await response.arrayBuffer();lost=true;throw Error('Synthetic lost committed HTTP response');
    }
    return response;
   };
   const ctx={http:{fetch:fixtureFetch},secrets:{resolve:async ref=>ref.secretId==='native'?key.token:fundingToken},state:{get:async k=>state.get(JSON.stringify(k)),set:async(k,v)=>state.set(JSON.stringify(k),v)}};
   const run=createAcceptanceReconciler(ctx,{enabled:true,scope,nativeUrl,fundingUrl,nativeSecretRef:{type:'secret_ref',secretId:'native'},fundingSecretRef:{type:'secret_ref',secretId:'funding'},fixtureLoopback:true,...(postgresLane?{pageSize:1}:{}),lifecycle:{acknowledgeTerminal:async record=>acks.push(record)}});
   let sweeps=0;
   for(let invocation=0;sweeps<2&&invocation<8;invocation++){
    calls=[];const result=await run();invocations.push({requests:calls.length,complete:result.complete});
    assert.equal(result.state,'ready');assert.ok(calls.length<=6);
    if(result.complete)sweeps++;
   }
   assert.equal(sweeps,2);assert.equal(acks.length,2);
   if(postgresLane){
    assert.ok(invocations.reduce((sum,row)=>sum+row.requests,0)>=10,'bounded pages must advance across actual native records');
    if(kind==='proposal')assert.ok(lost&&readbacks===1,'committed lost response must use exact terminal readback');
   }
   const expected=disposition==='cancel'?'cancelled':'applied';assert.equal(acks[0].outcome.state,expected);assert.equal(acks[0].receiptDigest,digestJson(receipt));
   await boardAuthService(db).revokeBoardApiKey(key.id);
   assert.equal((await run()).state,'pending');assert.equal(acks.length,2,'revoked transport must not authorize further archive acknowledgements');
   const outcome=await fetch(`${fundingUrl}/acceptances/${receipt.acceptanceId}/outcome`,{headers});
   assert.equal(outcome.status,200);assert.equal((await outcome.json()).state,expected,'DFW terminal audit survives source outage');
   const cancelAfter=await fetch(`${fundingUrl}/acceptances/${receipt.acceptanceId}/cancel`,{method:'POST',headers});assert.equal((await cancelAfter.json()).state,disposition==='apply'?'already_applied':'cancelled');
   console.log(JSON.stringify({kind,disposition,state:expected,native:'actual PostgreSQL capture and actorMiddleware board-key auth',funding:`actual FastAPI HTTP and durable ${postgresLane?'PostgreSQL':'SQLite'} domain service`,fundingDialect:dfw.dialect,writerFence:dfw.writerFence,lane:postgresLane?'all-postgres':'native-postgres-dfw-sqlite',http:'injected standard fetch; not actual SDK RPC qualification',replay:'two complete bounded sweeps',...(postgresLane?{nativeRecords:sourceReceipts.length,pageSize:1,invocations,lostResponseReadback:lost,concurrentDuplicateDelivery:kind==='packet_role'&&disposition==='apply'}:{}),archive:'exact terminal receipt handoff to synthetic approved capability; no deletion',revocation:'current source key denied; durable DFW readback retained',submitted:false}));
  }finally{
   let stopError;
   try{if(dfw)await dfw.stop();}catch(error){stopError=error;}
   if(nativeServer)await new Promise(resolve=>nativeServer.close(resolve));
   if(stopError)throw stopError; // Never drop schema/files under an unconfirmed fixture process.
   if(postgresLane&&await fs.access(path.join(work,'config.json')).then(()=>true,()=>false)){
    const cleanup=spawnSync(python,[path.join(project,'tests','dfw_transport_fixture.py'),'cleanup-postgres',work],{env:pyenv,encoding:'utf8',timeout:15000});
    assert.equal(cleanup.status,0,`PG fixture cleanup unconfirmed; retained ${work}: ${cleanup.stderr}`);
    assert.equal(JSON.parse(cleanup.stdout).state,'fixture_schema_removed');
   }
   await fs.rm(work,{recursive:true,force:true});
  }
 }
}finally{await client.end();}
