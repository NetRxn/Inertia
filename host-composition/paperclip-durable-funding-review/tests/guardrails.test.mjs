import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {eq,and,sql} from 'drizzle-orm';
import {activityLog,issueThreadInteractions,companyMemberships,principalPermissionGrants,documents} from '@paperclipai/db';
import {issueThreadInteractionService} from '../node_modules/@paperclipai/server/dist/services/issue-thread-interactions.js';
import {createFundingReviewCapture} from '../node_modules/@paperclipai/server/dist/services/funding-review-capture.js';
import {fixture,binding,db,client} from './fixture.mjs';
after(()=>client.end());
test('nested transaction composition fails closed instead of publishing before the outer commit',async()=>{
 const f=await fixture();const capture=createFundingReviewCapture({registrations:[binding(f)],rolePermissionKeys:{program:'funding.review.program'}});
 await assert.rejects(()=>db.transaction(tx=>issueThreadInteractionService(tx,{captureItemVerdictsInTransaction:capture.captureInTransaction}).submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor)),/root|nested/i);
 const [c]=await db.select().from(issueThreadInteractions).where(eq(issueThreadInteractions.id,f.interactionId));assert.equal(c.status,'pending');
});
test('capture transaction configures bounded native lock wait before locking verdict row',async()=>{
 const f=await fixture();let lockTimeout;
 const svc=issueThreadInteractionService(db,{captureItemVerdictsInTransaction:async(tx)=>{const [row]=await tx.execute(sql`select current_setting('lock_timeout') as value`);lockTimeout=row.value;return [];}});
 await svc.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);assert.equal(lockTimeout,'2s');
});
test('capture cannot be enabled without trusted retention contract even when host hook is installed',async()=>{
 const f=await fixture();const capture=createFundingReviewCapture({registrations:[binding(f)],rolePermissionKeys:{program:'funding.review.program'}});
 const svc=issueThreadInteractionService(db,{captureItemVerdictsInTransaction:capture.captureInTransaction});
 await assert.rejects(()=>svc.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor),/retention/i);
 const [c]=await db.select().from(issueThreadInteractions).where(eq(issueThreadInteractions.id,f.interactionId));assert.equal(c.status,'pending');
});
test('reader is scoped to trusted construction company and cannot read a foreign acceptance',async()=>{
 const {qualificationRetention}=await import('./retention.mjs');
 const first=await fixture(),foreign=await fixture();
 const cap=createFundingReviewCapture({registrations:[binding(foreign)],rolePermissionKeys:{program:'funding.review.program'},retention:qualificationRetention});
 await issueThreadInteractionService(db,{captureItemVerdictsInTransaction:cap.captureInTransaction}).submitItemVerdicts(foreign.issue,foreign.interactionId,foreign.input,foreign.actor);
 const [row]=await db.select().from(activityLog).where(and(eq(activityLog.companyId,foreign.companyId),eq(activityLog.action,'funding.review.accepted')));
 const reader=createFundingReviewCapture({registrations:[binding(first)],rolePermissionKeys:{program:'funding.review.program'}});
 assert.equal(await reader.readAcceptance(db,row.id),null);
 await assert.rejects(()=>reader.listAcceptances(db,{companyId:foreign.companyId}),/company|scope/i);
 assert.equal(await reader.readAcceptance(db,'not-a-native-uuid'),null);
});
