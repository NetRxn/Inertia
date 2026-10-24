import {qualificationRetention} from './retention.mjs';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {eq,and} from 'drizzle-orm';
import {activityLog,companyMemberships,principalPermissionGrants,issueThreadInteractions,documents,issues} from '@paperclipai/db';
import {issueThreadInteractionService} from '../node_modules/@paperclipai/server/dist/services/issue-thread-interactions.js';
import {fixture,binding,db,client} from './fixture.mjs';
const mod=await import('../node_modules/@paperclipai/server/dist/services/funding-review-capture.js').catch(e=>e.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(e));
after(()=>client.end());
function create(f,bindings=[binding(f)]) {
 assert.equal(typeof mod.createFundingReviewCapture,'function','trusted capture factory must exist');
 const capture=mod.createFundingReviewCapture({retention:qualificationRetention,registrations:bindings,rolePermissionKeys:{program:'funding.review.program'}});
 return {capture,service:issueThreadInteractionService(db,{captureItemVerdictsInTransaction:capture.captureInTransaction})};
}
async function rows(f){return db.select().from(activityLog).where(and(eq(activityLog.companyId,f.companyId),eq(activityLog.action,'funding.review.accepted')));}
async function card(f){return (await db.select().from(issueThreadInteractions).where(eq(issueThreadInteractions.id,f.interactionId)))[0];}
test('native capture persists exact command envelope in existing activity; replay does not reread native authority',async()=>{
 const f=await fixture(); const {capture,service}=create(f);await service.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);
 const [row]=await rows(f);assert.ok(row); const receipt=await capture.readAcceptance(db,row.id);
 assert.deepEqual(receipt,{schema:'inertia.funding-acceptance.v1',acceptanceId:row.id,acceptedAt:row.createdAt.toISOString(),command:{decisionKey:JSON.stringify([f.companyId,f.issueId,f.interactionId,'item-1']),binding:binding(f),actorUserId:f.userId,action:'accepted',reason:'Exact version reviewed',resolvedAt:(await card(f)).result.items[0].resolvedAt}});
 await db.update(companyMemberships).set({status:'inactive'}).where(eq(companyMemberships.companyId,f.companyId));
 await db.update(documents).set({latestBody:'Changed later'}).where(eq(documents.id,f.documentId));
 assert.deepEqual(await capture.readAcceptance(db,row.id),receipt);
});
test('duplicate native verdict and partial card additions do not remint old commands',async()=>{
 const f=await fixture(2);const {capture,service}=create(f,[binding(f),binding(f,'item-2')]);
 await service.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);const [first]=await rows(f);
 await service.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);assert.equal((await rows(f)).length,1);
 await service.submitItemVerdicts(f.issue,f.interactionId,{verdicts:[{id:'item-2',verdict:'reject',reason:'Missing evidence'}]},f.actor);
 assert.equal((await rows(f)).length,2);assert.equal((await capture.readAcceptance(db,first.id)).command.action,'accepted');
 assert.equal((await card(f)).result.complete,true);
});
test('legacy already resolved items never get retrospective acceptance',async()=>{
 const f=await fixture();await issueThreadInteractionService(db).submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);
 const {service}=create(f);await service.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);assert.equal((await rows(f)).length,0);
});
for(const [name,mutate] of [
 ['inactive membership',f=>db.update(companyMemberships).set({status:'inactive'}).where(eq(companyMemberships.companyId,f.companyId))],
 ['viewer membership',f=>db.update(companyMemberships).set({membershipRole:'viewer'}).where(eq(companyMemberships.companyId,f.companyId))],
 ['missing configured role grant',f=>db.delete(principalPermissionGrants).where(eq(principalPermissionGrants.companyId,f.companyId))],
 ['wrong applicant scope',f=>db.update(principalPermissionGrants).set({scope:{applicantIds:['other'],sourceScopes:['source-1']}}).where(eq(principalPermissionGrants.companyId,f.companyId))],
 ['closed current issue despite stale route snapshot',f=>db.update(issues).set({status:'done'}).where(eq(issues.id,f.issueId))],
]) test(name+' rejects and rolls back verdict',async()=>{const f=await fixture();const {service}=create(f);await mutate(f);await assert.rejects(()=>service.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor));assert.equal((await card(f)).status,'pending');assert.equal((await rows(f)).length,0);});
test('redaction changing exact command aborts native transaction instead of persisting degraded authority',async()=>{
 const f=await fixture();const {service}=create(f);f.input.verdicts[0].reason='Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop';
 await assert.rejects(()=>service.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor),/redact|exact/i);assert.equal((await card(f)).status,'pending');assert.equal((await rows(f)).length,0);
});
test('defer records native result without authorizing a DFW command',async()=>{
 const f=await fixture();const {service}=create(f);await service.submitItemVerdicts(f.issue,f.interactionId,{verdicts:[{id:'item-1',verdict:'defer',reason:'Need time'}]},f.actor);assert.equal((await rows(f)).length,0);
});
test('reader rejects agent/plugin forged receipt and missing acceptance IDs',async()=>{
 const f=await fixture();const {capture,service}=create(f);await service.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);const [row]=await rows(f);
 const [forgery]=await db.insert(activityLog).values({companyId:f.companyId,actorType:'plugin',actorId:'plugin-forgery',action:row.action,entityType:row.entityType,entityId:row.entityId,details:row.details}).returning();
 assert.equal(await capture.readAcceptance(db,forgery.id),null);assert.equal(await capture.readAcceptance(db,'00000000-0000-4000-8000-000000000000'),null);
});
