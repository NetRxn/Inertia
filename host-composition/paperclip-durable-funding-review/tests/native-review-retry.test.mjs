/** Actual native PostgreSQL/helper boundary; no provider or real tenant inputs.
 * Initial board-POST race/route-body sanitization require the separate existing
 * wakeup-route integration; these tests do not pretend readonly helper calls
 * create a successor or prove queue dispatch.
 */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {nativeDatabase,loadNative,schema,eq,CASES,seedReviewRetryCase} from './qualification/native-review-retry/seed.mjs';
let fixture,db;const cases={};
before(async()=>{fixture=await nativeDatabase();db=fixture.db;for(const name of CASES)cases[name]=await seedReviewRetryCase(db,name);});
after(async()=>fixture?.client.close());
const helper=async()=> (await loadNative('@paperclipai/server/dist/services/native-runtime/native-review-retry.mjs')).getNativeReviewRetryState;
test('existing exact-run eligibility admits only a verified completed pending native reviewer',async()=>{
 const {canRetryStoppedRun}=await loadNative('@paperclipai/server/dist/services/cancelled-native-startup.js');
 assert.equal(await canRetryStoppedRun(db,cases.eligible.selected),true);
 assert.equal(await canRetryStoppedRun(db,cases.ordinary.selected),false);
});
test('eligible context comes from the exact persisted native card and source decision',async()=>{
 const f=cases.eligible,state=await(await helper())(db,f.selected,{nativeReviewInteractionId:'caller-card',issueId:'caller-task'});
 assert.deepEqual(state,{kind:'eligible',context:{nativeReviewInteractionId:f.card,nativeReviewDecisionId:f.sourceDecision}});
});
for(const name of ['ordinary','resolved','humanonly','stale','revokedpolicy','paused','mismatchedsource','unfinished','activelease','newerrelated'])test(name+' is denied without changing historical run or card',async()=>{
 const f=cases[name],beforeRun=(await db.select().from(schema.heartbeatRuns).where(eq(schema.heartbeatRuns.id,f.reviewerRun)))[0],beforeCard=(await db.select().from(schema.issueThreadInteractions).where(eq(schema.issueThreadInteractions.id,f.card)))[0];
 assert.equal(await(await helper())(db,f.selected),null);
 assert.deepEqual((await db.select().from(schema.heartbeatRuns).where(eq(schema.heartbeatRuns.id,f.reviewerRun)))[0],beforeRun);
 assert.deepEqual((await db.select().from(schema.issueThreadInteractions).where(eq(schema.issueThreadInteractions.id,f.card)))[0],beforeCard);
});
test('parallel readbacks and lost response adopt exactly the one persisted successor',async()=>{
 const f=cases.replay,get=await helper(),before=await db.select().from(schema.heartbeatRuns).where(eq(schema.heartbeatRuns.retryOfRunId,f.reviewerRun));assert.equal(before.length,1);
 const states=await Promise.all(Array.from({length:4},()=>get(db,f.selected)));const readback=await get(db,f.selected);
 for(const state of [...states,readback]){assert.equal(state.kind,'replay');assert.equal(state.run.id,f.successor);assert.deepEqual(state.context,{nativeReviewInteractionId:f.card,nativeReviewDecisionId:f.sourceDecision});}
 assert.equal((await db.select().from(schema.heartbeatRuns).where(eq(schema.heartbeatRuns.retryOfRunId,f.reviewerRun))).length,1);
});

test('ordinary failed and timed-out retry compatibility stays unchanged',async()=>{const {canRetryStoppedRun}=await loadNative('@paperclipai/server/dist/services/cancelled-native-startup.js');for(const status of ['failed','timed_out'])assert.equal(await canRetryStoppedRun(db,{...cases.ordinary.selected,status}),true);assert.equal(await canRetryStoppedRun(db,{...cases.ordinary.selected,status:'failed',errorCode:'native_session_cleanup_quarantined'}),false);});
