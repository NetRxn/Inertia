import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {and,eq} from 'drizzle-orm';
import {activityLog,authUsers,companyMemberships,issueThreadInteractions,issues} from '@paperclipai/db';
import {createApp} from '../node_modules/@paperclipai/server/dist/app.js';
import {persistActivity} from '../node_modules/@paperclipai/server/dist/services/activity-log.js';
import {fixture,db,client,digest} from './fixture.mjs';
import {memberNativeCodec} from '../../../dist/src/grants/member-native.js';
import {snapshotMemberPolicy} from '../../../dist/src/grants/member-review.js';
import {accessService} from '../node_modules/@paperclipai/server/dist/services/access.js';
import {createMemberPacketCapture} from '../node_modules/@paperclipai/server/dist/services/member-packet-capture.js';
after(()=>client.end());
async function appFixture({enabled=true,viewer=false,anonymous=false,creatorExcluded=false,realCapture=false,unregistered=false}={}){
 const f=await fixture();await db.insert(authUsers).values({id:f.userId,name:'Synthetic native session human',email:`${f.userId}@example.invalid`,createdAt:new Date(),updatedAt:new Date()});
 [f.card]=await db.update(issueThreadInteractions).set({addresseeUserId:null,payload:{...f.card.payload,allowBulkApprove:false}}).where(eq(issueThreadInteractions.id,f.interactionId)).returning();if(viewer)await db.update(companyMemberships).set({membershipRole:'viewer'}).where(eq(companyMemberships.principalId,f.userId));
 if(creatorExcluded)await db.update(issues).set({status:'in_review',reviewPolicy:'not_creator',createdByUserId:f.userId}).where(eq(issues.id,f.issueId));
 let calls=0,context;
 let capability={db,handlesNativeReview(){return !unregistered;},async captureInTransaction(tx,input){calls++;context=input.originalAuthenticatedContext;assert.equal(input.actor.userId,f.userId);const written=await persistActivity(tx,{companyId:f.companyId,actorType:'user',actorId:f.userId,action:'qualification.member.web.capture',entityType:'issue',entityId:f.issueId,details:{itemIds:input.newlyResolvedItemIds}});return[written.publication];}};
 if(realCapture){
  const policy=snapshotMemberPolicy({schema:'inertia.member-review-policy.v2',id:'synthetic-web-member-admission',version:1,mode:'verified_member_application_access',scope:{companyId:f.companyId,applicantId:'applicant',applicationId:'application',opportunityNamespace:'fixture',opportunityExternalId:'opportunity',sourceScope:'members'},authorityRefs:['synthetic:designated-native-admission'],additionalRequirements:[]});
  const binding={schema:'inertia.native-member-packet-binding.v2',companyId:f.companyId,issueId:f.issueId,interactionId:f.interactionId,itemId:'item-1',documentId:f.documentId,documentKey:'funding-review',documentRevisionId:f.revisionId,interactionDigest:digest(f.card),...policy,target:{packetId:'packet',packetVersion:1,packetContentHash:'b'.repeat(64)}};
  const capture=createMemberPacketCapture({enabled:true,contracts:memberNativeCodec,bindings:[binding],retention:{async assertRetentionInTransaction(){}},async authorizeInTransaction(tx,source,b){
   const result=await accessService(tx).decide({actor:source.originalAuthenticatedContext.actor,action:'issue:mutate',resource:{type:'issue',companyId:b.companyId,issueId:b.issueId,status:source.issue.status,assigneeAgentId:source.issue.assigneeAgentId,assigneeUserId:source.issue.assigneeUserId}});if(!result.allowed)return null;
   const [member]=await tx.select().from(companyMemberships).where(and(eq(companyMemberships.companyId,b.companyId),eq(companyMemberships.principalId,source.actor.userId)));return {actorUserId:source.actor.userId,actorType:'human',authenticatedHuman:true,verifiedDaoMember:true,applicationActionAllowed:true,nativeActionAllowed:true,membershipVersion:memberNativeCodec.hash({id:member.id,updatedAt:member.updatedAt.toISOString()}),applicationAccessVersion:memberNativeCodec.hash({issueId:b.issueId,result:result.reason})};
  }});capability={db,handlesNativeReview:capture.handlesNativeReview,async captureInTransaction(tx,input){calls++;context=input.originalAuthenticatedContext;return capture.captureInTransaction(tx,input);}};
 }
 const app=await createApp(db,{uiMode:'none',serverPort:0,storageService:{},deploymentMode:'authenticated',deploymentExposure:'private',allowedHostnames:['127.0.0.1'],bindHost:'127.0.0.1',authReady:true,companyDeletionEnabled:false,decisionServiceOptions:{},managedPluginAutoInstall:[],localPluginDir:`${process.env.NATIVE_CAPTURE_FIXTURE_ROOT}/plugins`,resolveSession:async()=>anonymous?null:{session:{id:'synthetic-session'},user:{id:f.userId}},...(enabled?{memberPacketReviewCapture:capability}:{})});
 await app.locals.bundledPluginsStartup;const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const url=`http://127.0.0.1:${server.address().port}/api/issues/${f.issueId}/interactions/${f.interactionId}/verdicts`;
 return{f,capability,calls:()=>calls,context:()=>context,async post(extra={}){return fetch(url,{method:'POST',headers:{'content-type':'application/json',origin:new URL(url).origin},body:JSON.stringify({...f.input,...extra})});},async close(){await new Promise(resolve=>server.close(resolve));await app.locals.paperclipShutdown();}};
}
test('actual stock app web verdict invokes the trusted capture with original session identity',async()=>{
 const x=await appFixture();try{const response=await x.post({actorUserId:'forged',memberPacketReviewCapture:{actorUserId:'forged'}});assert.equal(response.status,200,await response.text());assert.equal(x.calls(),1,'app→issue route→native transaction capture is mounted');assert.equal(x.context().actor.type,'board');assert.equal(x.context().actor.userId,x.f.userId);assert.equal(x.context().actor.source,'session');assert.equal(x.context().actor.sessionId,'synthetic-session');assert.equal(x.context().method,'POST');assert.equal(x.context().companyId,x.f.companyId);const rows=await db.select().from(activityLog).where(and(eq(activityLog.companyId,x.f.companyId),eq(activityLog.action,'qualification.member.web.capture')));assert.equal(rows.length,1);assert.equal((await x.post()).status,200);assert.equal(x.calls(),1);}finally{await x.close();}
});
test('unconfigured stock route retains the original native behavior and creates no member receipt',async()=>{
 const x=await appFixture({enabled:false});try{assert.equal((await x.post()).status,200);assert.equal(x.calls(),0);const rows=await db.select().from(activityLog).where(and(eq(activityLog.companyId,x.f.companyId),eq(activityLog.action,'qualification.member.web.capture')));assert.equal(rows.length,0);}finally{await x.close();}
});
for(const options of [{viewer:true},{anonymous:true}])test(`native access gates remain before capture ${JSON.stringify(options)}`,async()=>{
 const x=await appFixture(options);try{const response=await x.post();assert.notEqual(response.status,200);assert.equal(x.calls(),0);}finally{await x.close();}
});
test('trusted capture capability requires the same root database and a real callback',async()=>{
 for(const capability of [{db:{},captureInTransaction(){}},{db,captureInTransaction:true}]){let app;try{await assert.rejects(async()=>{app=await createApp(db,{uiMode:'none',serverPort:0,storageService:{},deploymentMode:'authenticated',deploymentExposure:'private',allowedHostnames:['127.0.0.1'],bindHost:'127.0.0.1',authReady:true,companyDeletionEnabled:false,decisionServiceOptions:{},managedPluginAutoInstall:[],localPluginDir:`${process.env.NATIVE_CAPTURE_FIXTURE_ROOT}/plugins`,memberPacketReviewCapture:capability});},/ownership|composition|root|capture/i);}finally{if(app)await app.locals.paperclipShutdown();}}
});

test('actual stock web route commits a real role-free v2 member receipt and native verdict together',async()=>{
 const x=await appFixture({realCapture:true});try{const response=await x.post();assert.equal(response.status,200,await response.text());const rows=await db.select().from(activityLog).where(and(eq(activityLog.companyId,x.f.companyId),eq(activityLog.action,'member.packet.review.accepted')));assert.equal(rows.length,1);assert.equal(rows[0].actorId,x.f.userId);assert.equal(rows[0].details.intent.action,'approve_packet');assert.equal(rows[0].details.intent.target.packetVersion,1);assert.equal(rows[0].details.memberAccess.decision.verifiedDaoMember,true);assert.equal(rows[0].details.binding.reviewerRole,undefined);assert.equal((await x.post()).status,200);assert.equal(x.calls(),1);}finally{await x.close();}
});

test('v2 acceptance must retain the existing native not_creator issue policy',async()=>{
 const x=await appFixture({realCapture:true,creatorExcluded:true});try{const response=await x.post();assert.equal(response.status,403,await response.text());const rows=await db.select().from(activityLog).where(and(eq(activityLog.companyId,x.f.companyId),eq(activityLog.action,'member.packet.review.accepted')));assert.equal(rows.length,0);const [card]=await db.select().from(issueThreadInteractions).where(eq(issueThreadInteractions.id,x.f.interactionId));assert.equal(card.status,'pending');}finally{await x.close();}
});

test('opted-in composition leaves an unregistered native verdict on its stock path',async()=>{
 const x=await appFixture({unregistered:true});try{assert.equal((await x.post()).status,200);assert.equal(x.calls(),0,'unregistered cards must not acquire capture transaction behavior');}finally{await x.close();}
});
