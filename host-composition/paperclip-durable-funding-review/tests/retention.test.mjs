import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {eq,and} from 'drizzle-orm';
import {activityLog} from '@paperclipai/db';
import {fixture,binding,db,client} from './fixture.mjs';
import {qualificationRetention} from './retention.mjs';
import {createFundingReviewCapture} from '../node_modules/@paperclipai/server/dist/services/funding-review-capture.js';
import {issueThreadInteractionService} from '../node_modules/@paperclipai/server/dist/services/issue-thread-interactions.js';
import {companyService} from '../node_modules/@paperclipai/server/dist/services/companies.js';
after(()=>client.end());
async function accepted(){const f=await fixture();const capture=createFundingReviewCapture({registrations:[binding(f)],rolePermissionKeys:{program:'funding.review.program'},retention:qualificationRetention});await issueThreadInteractionService(db,{captureItemVerdictsInTransaction:capture.captureInTransaction}).submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);const [row]=await db.select().from(activityLog).where(and(eq(activityLog.companyId,f.companyId),eq(activityLog.action,'funding.review.accepted')));return {f,capture,row};}
const retentionError=e=>/qualification-only/.test(e.cause?.message??e.message);
test('qualification guard makes accepted activity exact and immutable',async()=>{const {row}=await accepted();await assert.rejects(()=>db.update(activityLog).set({details:{}}).where(eq(activityLog.id,row.id)),retentionError);await assert.rejects(()=>db.delete(activityLog).where(eq(activityLog.id,row.id)),retentionError);});
test('qualification retention proves company deletion remains an explicit activation gate',async()=>{const {f,capture,row}=await accepted();await assert.rejects(()=>companyService(db).remove(f.companyId),retentionError);assert.ok(await capture.readAcceptance(db,row.id));});
test('trusted user duplicate acceptance key is rejected but ordinary native activity remains mutable',async()=>{const {f,row}=await accepted();await assert.rejects(()=>db.insert(activityLog).values({...row,id:undefined}),e=>e.cause?.code==='23505');const [ordinary]=await db.insert(activityLog).values({companyId:f.companyId,actorType:'user',actorId:f.userId,action:'ordinary.event',entityType:'issue',entityId:f.issueId}).returning();await db.delete(activityLog).where(eq(activityLog.id,ordinary.id));});
test('replay sweep reads authoritative existing receipts and uses bounded pagination',async()=>{const {f,capture,row}=await accepted();const page=await capture.listAcceptances(db,{companyId:f.companyId,limit:1});assert.equal(page.receipts.length,1);assert.equal(page.receipts[0].acceptanceId,row.id);assert.equal(page.nextCursor,row.id);assert.deepEqual(await capture.listAcceptances(db,{companyId:f.companyId,afterId:row.id,limit:1}),{receipts:[],nextCursor:null});await assert.rejects(()=>capture.listAcceptances(db,{companyId:f.companyId,limit:501}));});
