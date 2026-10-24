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
async function launch(work) {
 const child=spawn(python,[path.join(project,'tests','dfw_transport_fixture.py'),'serve',work],{env:pyenv,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr=''; child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
 const port=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('DFW fixture startup timeout'));},15000);
  child.once('exit',()=>{clearTimeout(timer);reject(Error('DFW fixture failed: '+stderr.slice(-1000)));});
  child.stdout.on('data',chunk=>{stdout+=chunk.toString();const line=stdout.split('\n')[0];try{const result=JSON.parse(line);if(result.port){clearTimeout(timer);resolve(result.port);}}catch{}});
 });
 return {port,stop:async()=>{if(child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});}};
}
try {
 for(const [kind,disposition] of [['proposal','apply'],['packet_role','apply'],['packet_role','cancel']]){
  const work=await fs.mkdtemp(path.join(os.tmpdir(),'review-transport-fixture-'));
  let nativeServer,dfw;
  try {
   const init=spawnSync(python,[path.join(project,'tests','dfw_transport_fixture.py'),'init',work,kind],{env:pyenv,encoding:'utf8'});
   assert.equal(init.status,0,init.stderr);
   const input=JSON.parse(await fs.readFile(path.join(work,'funding-input.json'),'utf8'));
   const f=await fixture();const b={...binding(f),...input};
   const permissionKey=`funding.review.${b.reviewerRole}`;
   await db.update(principalPermissionGrants).set({permissionKey,scope:{applicantIds:[b.applicantId],sourceScopes:[b.sourceScope]}}).where(eq(principalPermissionGrants.companyId,f.companyId));
   const capture=createFundingReviewCapture({retention:qualificationRetention,registrations:[b],rolePermissionKeys:{[b.reviewerRole]:permissionKey}});
   await issueThreadInteractionService(db,{captureItemVerdictsInTransaction:capture.captureInTransaction}).submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);
   const receipt=(await capture.listAcceptances(db,{companyId:f.companyId})).receipts[0];assert.ok(receipt);
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
   dfw=await launch(work);const fundingUrl=`http://127.0.0.1:${dfw.port}/funding-review-transport`;
   const headers={'X-Admin-Token':fundingToken,'X-Funding-Scope':digestJson(scope)};
   if(disposition==='cancel'){
    const cancelled=await fetch(`${fundingUrl}/acceptances/${receipt.acceptanceId}/cancel`,{method:'POST',headers});
    assert.equal(cancelled.status,200);assert.equal((await cancelled.json()).state,'cancelled');
   }
   const state=new Map(),acks=[];
   const ctx={http:{fetch},secrets:{resolve:async ref=>ref.secretId==='native'?key.token:fundingToken},state:{get:async k=>state.get(JSON.stringify(k)),set:async(k,v)=>state.set(JSON.stringify(k),v)}};
   const run=createAcceptanceReconciler(ctx,{enabled:true,scope,nativeUrl,fundingUrl,nativeSecretRef:{type:'secret_ref',secretId:'native'},fundingSecretRef:{type:'secret_ref',secretId:'funding'},fixtureLoopback:true,lifecycle:{acknowledgeTerminal:async record=>acks.push(record)}});
   for(let i=0;i<2;i++){const result=await run();assert.equal(result.state,'ready');assert.equal(result.complete,true);assert.equal(result.acknowledged,1);}
   const expected=disposition==='cancel'?'cancelled':'applied';assert.equal(acks[0].outcome.state,expected);assert.equal(acks[0].receiptDigest,digestJson(receipt));
   await boardAuthService(db).revokeBoardApiKey(key.id);
   assert.equal((await run()).state,'pending');assert.equal(acks.length,2,'revoked transport must not authorize further archive acknowledgements');
   const outcome=await fetch(`${fundingUrl}/acceptances/${receipt.acceptanceId}/outcome`,{headers});
   assert.equal(outcome.status,200);assert.equal((await outcome.json()).state,expected,'DFW terminal audit survives source outage');
   const cancelAfter=await fetch(`${fundingUrl}/acceptances/${receipt.acceptanceId}/cancel`,{method:'POST',headers});assert.equal((await cancelAfter.json()).state,disposition==='apply'?'already_applied':'cancelled');
   console.log(JSON.stringify({kind,disposition,state:expected,native:'actual PostgreSQL capture and actorMiddleware board-key auth',funding:'actual FastAPI HTTP and durable SQLite domain service',replay:'two complete bounded sweeps',archive:'exact terminal receipt handoff to synthetic approved capability; no deletion',revocation:'current source key denied; durable DFW readback retained',submitted:false}));
  }finally{if(dfw)await dfw.stop();if(nativeServer)await new Promise(resolve=>nativeServer.close(resolve));await fs.rm(work,{recursive:true,force:true});}
 }
}finally{await client.end();}
