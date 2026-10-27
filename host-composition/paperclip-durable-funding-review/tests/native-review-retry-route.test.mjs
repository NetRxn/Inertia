/** Actual native board route/heartbeat admission on synthetic native PostgreSQL.
 * Intake drain stays active: queued admission is tested, not provider execution.
 * The only auth substitute is the existing resolveSession boundary returning a
 * synthetic owned user. Native middleware, memberships and access decisions run.
 */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {nativeDatabase,loadNative,schema,eq,seedReviewRetryCase} from './qualification/native-review-retry/seed.mjs';
import {inProcessRequest} from './qualification/native-review-retry/in-process-request.mjs';
const {default:express}=await loadNative('express/index.js');
const {actorMiddleware}=await loadNative('@paperclipai/server/dist/middleware/auth.js');
const {agentRoutes}=await loadNative('@paperclipai/server/dist/routes/agents.js');
const {startTaskDrain,getTaskDrainStatus}=await loadNative('@paperclipai/server/dist/services/heartbeat.js');
const {authorizationService}=await loadNative('@paperclipai/server/dist/services/authorization.js');
let fixture,db,f,app,user,membership,successor,receiptId;
before(async()=>{
 fixture=await nativeDatabase();db=fixture.db;f=await seedReviewRetryCase(db,'eligible');user={id:randomUUID(),name:'Synthetic retry owner',email:'synthetic-'+randomUUID()+'@example.invalid',emailVerified:true};
 await db.insert(schema.authUsers).values({...user,createdAt:new Date(),updatedAt:new Date()});
 [membership]=await db.insert(schema.companyMemberships).values({companyId:f.company,principalType:'user',principalId:user.id,status:'active',membershipRole:'member'}).returning();
 startTaskDrain();assert.equal(getTaskDrainStatus().draining,true);
 app=express();app.use(express.json());app.use(actorMiddleware(db,{deploymentMode:'authenticated',resolveSession:async()=>({user,session:{id:'synthetic-session-'+user.id,userId:user.id,expiresAt:new Date(Date.now()+60000)}})}));
 app.use('/api',agentRoutes(db,{deploymentMode:'authenticated'}));app.use((error,_req,res,_next)=>res.status(error.status??(error.name==='ZodError'?400:500)).json({error:error.message}));
});
after(async()=>{ // Leave the process-local drain held until the disposable process exits.
 try{if(app)assert.equal(getTaskDrainStatus().draining,true);}finally{await fixture?.client.close();}
});
const body=()=>({failedRunId:f.reviewerRun,reason:'retry_failed_run',source:'on_demand',triggerDetail:'manual',idempotencyKey:randomUUID(),payload:{issueId:randomUUID(),taskId:randomUUID(),taskKey:'FORGED-CALLER-TASK',nativeReviewInteractionId:randomUUID(),nativeReviewDecisionId:randomUUID(),sourceRunId:randomUUID(),revisionId:randomUUID()},contextSnapshot:{issueId:randomUUID(),nativeReviewInteractionId:randomUUID()}});
const post=data=>inProcessRequest(app,{url:'/api/agents/'+f.reviewer+'/wakeup',body:data});
const retryRows=()=>db.select().from(schema.heartbeatRuns).where(eq(schema.heartbeatRuns.retryOfRunId,f.reviewerRun));
const resource=()=>({type:'issue',companyId:f.company,issueId:f.issue,projectId:f.project,parentIssueId:null,assigneeAgentId:f.producer,assigneeUserId:null,status:'in_review'});
const board=()=>({type:'board',userId:user.id,source:'session',companyIds:[f.company],memberships:[membership],isInstanceAdmin:false});
test('two concurrent real board exact retries queue only one successor and ignore caller markers',async()=>{
 const responses=await Promise.all([post(body()),post(body())]);for(const response of responses)assert.equal(response.status,202,JSON.stringify(response.body));
 assert.equal(responses[0].body.id,responses[1].body.id);successor=responses[0].body.id;
 const runs=await retryRows();assert.equal(runs.length,1);const run=runs[0];assert.equal(run.id,successor);assert.equal(run.status,'queued');assert.equal(run.agentId,f.reviewer);
 assert.equal(run.contextSnapshot.issueId,f.issue);assert.equal(run.contextSnapshot.nativeReviewInteractionId,f.card);assert.equal(run.contextSnapshot.nativeReviewDecisionId,f.sourceDecision);
 assert.notEqual(run.contextSnapshot.taskKey,'FORGED-CALLER-TASK');assert.equal(run.contextSnapshot.wakeReason,'retry_failed_run');
 const receipts=await db.select().from(schema.agentWakeupRequests).where(eq(schema.agentWakeupRequests.runId,successor));assert.equal(receipts.length,1);receiptId=receipts[0].id;
 const card=(await db.select().from(schema.issueThreadInteractions).where(eq(schema.issueThreadInteractions.id,f.card)))[0];assert.equal(card.status,'pending');
 assert.equal(getTaskDrainStatus().activeRuns,0);
});
test('lost delivered response is reconciled by another real POST without a second run or receipt',async()=>{
 // Discard one actually completed route response, then repeat the same selected
 // run with a fresh caller key. No mock verdict, queue result or lifecycle write.
 const lost=await post(body());assert.equal(lost.status,202);assert.equal(lost.body.id,successor);
 const readback=await post(body());assert.equal(readback.status,202);assert.equal(readback.body.id,successor);assert.equal((await retryRows()).length,1);
 const receipts=await db.select().from(schema.agentWakeupRequests).where(eq(schema.agentWakeupRequests.runId,successor));assert.deepEqual(receipts.map(r=>r.id),[receiptId]);
});
test('replay still requires current board membership issue-write authority',async()=>{
 assert.equal((await authorizationService(db).decide({actor:board(),action:'issue:comment',resource:resource()})).allowed,true);
 await db.update(schema.companyMemberships).set({membershipRole:'viewer'}).where(eq(schema.companyMemberships.id,membership.id));
 assert.equal((await authorizationService(db).decide({actor:{...board(),memberships:[{...membership,membershipRole:'viewer'}]},action:'issue:comment',resource:resource()})).allowed,false);
 const response=await post(body());assert.equal(response.status,403,JSON.stringify(response.body));assert.equal((await retryRows()).length,1);
 await db.update(schema.companyMemberships).set({membershipRole:'member'}).where(eq(schema.companyMemberships.id,membership.id));
});
test('replay cannot bypass a changed conversation owner while board agent-wake remains allowed',async()=>{
 await db.update(schema.issues).set({conversationAgentId:f.producer,conversationUserId:'different-synthetic-owner',conversationState:'active'}).where(eq(schema.issues.id,f.issue));
 assert.equal((await authorizationService(db).decide({actor:board(),action:'agent:wake',resource:{type:'agent',companyId:f.company,agentId:f.reviewer}})).allowed,true);
 const response=await post(body());assert.equal(response.status,403,JSON.stringify(response.body));assert.equal((await retryRows()).length,1);
});
