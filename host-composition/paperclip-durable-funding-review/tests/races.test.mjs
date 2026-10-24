import {qualificationRetention} from './retention.mjs';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {eq,and,sql} from 'drizzle-orm';
import {activityLog,issueThreadInteractions,companyMemberships,principalPermissionGrants} from '@paperclipai/db';
import {issueThreadInteractionService} from '../node_modules/@paperclipai/server/dist/services/issue-thread-interactions.js';
import {createFundingReviewCapture} from '../node_modules/@paperclipai/server/dist/services/funding-review-capture.js';
import {subscribeCompanyLiveEvents} from '../node_modules/@paperclipai/server/dist/services/live-events.js';
import {fixture,binding,db,client} from './fixture.mjs';
after(()=>client.end());
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function rows(f){return db.select().from(activityLog).where(and(eq(activityLog.companyId,f.companyId),eq(activityLog.action,'funding.review.accepted')));}
async function card(f){return (await db.select().from(issueThreadInteractions).where(eq(issueThreadInteractions.id,f.interactionId)))[0];}
function capture(f){return createFundingReviewCapture({retention:qualificationRetention,registrations:[binding(f)],rolePermissionKeys:{program:'funding.review.program'}});}
async function waitLock(pid){for(let i=0;i<100;i++){const [r]=await client`select wait_event_type from pg_stat_activity where pid=${pid}`;if(r?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,10));}assert.fail('expected real PostgreSQL lock waiter');}
test('backend termination before native commit leaves neither verdict nor acceptance',async()=>{
 const f=await fixture(),cap=capture(f);
 const svc=issueThreadInteractionService(db,{captureItemVerdictsInTransaction:async(tx,input)=>{const pubs=await cap.captureInTransaction(tx,input);const [r]=await tx.execute(sql`select pg_backend_pid() as pid`);await client`select pg_terminate_backend(${r.pid})`;return pubs;}});
 await assert.rejects(()=>svc.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor));
 assert.equal((await card(f)).status,'pending');assert.equal((await rows(f)).length,0);
});
test('lost response after native commit replays original receipt and duplicate produces no effect authority',async()=>{
 const f=await fixture(),cap=capture(f),svc=issueThreadInteractionService(db,{captureItemVerdictsInTransaction:cap.captureInTransaction});
 const unsubscribe=subscribeCompanyLiveEvents(f.companyId,()=>{throw Error('delivery disconnected');});
 try {await assert.rejects(()=>svc.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor),/delivery disconnected/);}finally{unsubscribe();}
 const discovery=await cap.listAcceptances(db,{companyId:f.companyId});assert.equal(discovery.receipts.length,1);
 const [row]=await rows(f);assert.equal(discovery.receipts[0].acceptanceId,row.id);assert.equal((await card(f)).status,'answered');const receipt=await cap.readAcceptance(db,row.id);assert.ok(receipt);
 await svc.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);assert.equal((await rows(f)).length,1);assert.deepEqual(await cap.readAcceptance(db,row.id),receipt);
});
for (const target of ['membership','role grant']) test(target+' revocation waits behind captured acceptance and cannot retroactively cancel',async()=>{
 const f=await fixture(),cap=capture(f),captured=gate(),release=gate(),writerStarted=gate();let writerPid;
 const svc=issueThreadInteractionService(db,{captureItemVerdictsInTransaction:async(tx,input)=>{const pubs=await cap.captureInTransaction(tx,input);captured.resolve();await release.promise;return pubs;}});
 const accepting=svc.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);await captured.promise;
 const revoking=db.transaction(async(tx)=>{const [r]=await tx.execute(sql`select pg_backend_pid() as pid`);writerPid=r.pid;writerStarted.resolve();if(target==='membership')await tx.update(companyMemberships).set({status:'inactive'}).where(eq(companyMemberships.companyId,f.companyId));else await tx.delete(principalPermissionGrants).where(eq(principalPermissionGrants.companyId,f.companyId));});
 await writerStarted.promise;await waitLock(writerPid);release.resolve();await Promise.all([accepting,revoking]);assert.equal((await rows(f)).length,1);
});
for (const target of ['membership','role grant']) test(target+' revocation committed first rejects and rolls back acceptance',async()=>{
 const f=await fixture(),cap=capture(f),revoked=gate(),release=gate(),captureStarted=gate();let capturePid;
 const revoking=db.transaction(async(tx)=>{if(target==='membership')await tx.update(companyMemberships).set({status:'inactive'}).where(eq(companyMemberships.companyId,f.companyId));else await tx.delete(principalPermissionGrants).where(eq(principalPermissionGrants.companyId,f.companyId));revoked.resolve();await release.promise;});
 await revoked.promise;
 const svc=issueThreadInteractionService(db,{captureItemVerdictsInTransaction:async(tx,input)=>{const [r]=await tx.execute(sql`select pg_backend_pid() as pid`);capturePid=r.pid;captureStarted.resolve();return cap.captureInTransaction(tx,input);}});
 const accepting=assert.rejects(()=>svc.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor),/not authorized/);
 await captureStarted.promise;await waitLock(capturePid);release.resolve();await Promise.all([accepting,revoking]);assert.equal((await card(f)).status,'pending');assert.equal((await rows(f)).length,0);
});
test('concurrent duplicate human clicks persist exactly one command using native row lock',async()=>{
 const f=await fixture(),cap=capture(f),svc=issueThreadInteractionService(db,{captureItemVerdictsInTransaction:cap.captureInTransaction});
 await Promise.all(Array.from({length:8},()=>svc.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor)));assert.equal((await rows(f)).length,1);
});
