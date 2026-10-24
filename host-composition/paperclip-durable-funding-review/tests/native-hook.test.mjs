import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {eq} from 'drizzle-orm';
import {activityLog,issueThreadInteractions} from '@paperclipai/db';
import {issueThreadInteractionService} from '../node_modules/@paperclipai/server/dist/services/issue-thread-interactions.js';
import {persistActivity} from '../node_modules/@paperclipai/server/dist/services/activity-log.js';
import {fixture,db,client} from './fixture.mjs';
after(()=>client.end());
test('actual native verdict transaction calls trusted capture and commits its activity atomically',async()=>{
 const f=await fixture();
 const service=issueThreadInteractionService(db,{captureItemVerdictsInTransaction:async(tx,{interaction,newlyResolvedItemIds,actor})=>{
  assert.deepEqual(newlyResolvedItemIds,['item-1']);assert.equal(actor.userId,f.userId);
  const record=await persistActivity(tx,{companyId:f.companyId,actorType:'user',actorId:f.userId,action:'qualification.capture',entityType:'issue',entityId:f.issueId,details:{interactionId:interaction.id}});
  return [record.publication];
 }});
 await service.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);
 const rows=await db.select().from(activityLog).where(eq(activityLog.companyId,f.companyId));
 assert.equal(rows.length,1,'native transaction must persist exactly one capture');
 const [card]=await db.select().from(issueThreadInteractions).where(eq(issueThreadInteractions.id,f.interactionId));assert.equal(card.status,'answered');
});
test('capture failure rolls back actual native verdict transaction',async()=>{
 const f=await fixture();
 const service=issueThreadInteractionService(db,{captureItemVerdictsInTransaction:async()=>{throw Error('capture refused');}});
 await assert.rejects(()=>service.submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor),/capture refused/);
 const [card]=await db.select().from(issueThreadInteractions).where(eq(issueThreadInteractions.id,f.interactionId));assert.equal(card.status,'pending');assert.equal(card.result,null);
});
