import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import express from 'express';
import {activityLog,agents} from '@paperclipai/db';
import {db,client,fixture,digest} from '../../tests/fixture.mjs';
import {canonicalJson} from '../../../../dist/src/grants/engine.js';
import {memberNativeCodec} from '../../../../dist/src/grants/member-native.js';
import {memberHash,snapshotMemberPolicy,parseMemberIntent,validateMemberAccessProof,memberTimestamp,memberTarget} from '../../../../dist/src/grants/member-review.js';
const mod=await import('../native/member-source.mjs').catch(e=>e.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(e));
const wire=await import('../native/member-protocol.mjs').catch(e=>e.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(e));
after(()=>client.end());
const contracts={...memberNativeCodec,snapshotPolicy:snapshotMemberPolicy,parseIntent:parseMemberIntent,accessProof:validateMemberAccessProof,timestamp:memberTimestamp,target:memberTarget};
const factory=c=>{assert.equal(typeof mod.createMemberPacketSource,'function','bounded member source exists');return mod.createMemberPacketSource(c);};
async function setup(){
 const f=await fixture();
 const p=snapshotMemberPolicy({schema:'inertia.member-review-policy.v2',id:'fixture',version:1,mode:'verified_member_application_access',scope:{companyId:f.companyId,applicantId:'applicant',applicationId:'application',opportunityNamespace:'fixture',opportunityExternalId:'opportunity',sourceScope:'members'},authorityRefs:['fixture:membership'],additionalRequirements:[]});
 const scope={schema:'inertia.member-packet-transport-scope.v2',purpose:'member-packet-review',sourceId:'native-fixture',destinationId:'dfw-fixture',...p.policy.scope};
 const review={schema:'inertia.native-member-packet-binding.v2',companyId:f.companyId,issueId:f.issueId,interactionId:f.interactionId,itemId:'item-1',documentId:f.documentId,documentKey:'funding-review',documentRevisionId:f.revisionId,interactionDigest:digest(f.card),...p,target:{packetId:'packet',packetVersion:1,packetContentHash:'b'.repeat(64)}};
 const action={schema:'inertia.member-packet-route.v2',companyId:f.companyId,issueId:f.issueId,...p};
 const proof={actorUserId:f.userId,actorType:'human',authenticatedHuman:true,verifiedDaoMember:true,applicationActionAllowed:true,nativeActionAllowed:true,membershipVersion:'fixture-v1',applicationAccessVersion:'fixture-v1'};
 const config={enabled:true,db,scope,contracts,reviewBindings:[review],actionBindings:[action]};
 async function insert(kind='review',changes={}){
  const intent={schema:'inertia.member-packet-action.v2',policyHash:p.policyHash,target:review.target,action:kind==='review'?'approve_packet':'record_submission',payload:kind==='review'?{note:'Exact review'}:{submittedAt:'2026-10-24T12:00:00Z',declaredSubmitter:null,note:'Reported',evidence:null}};
  const binding=kind==='review'?review:action;
  const details={schema:kind==='review'?'inertia.member-native-storage.v2':'inertia.member-native-action-storage.v2',binding,intent,intentHash:memberHash(intent),memberAccess:{schema:'inertia.native-member-access-decision.v2',decision:proof},...(kind==='review'?{nativeDecisionKey:memberHash(canonicalJson([review.companyId,review.issueId,review.interactionId,review.itemId]))}:{requestId:'fixture-request',requestKey:memberHash([action.companyId,action.issueId,f.userId,'fixture-request']),selectionVersion:'a'.repeat(64)})};
  const row={id:randomUUID(),companyId:f.companyId,actorType:'user',actorId:f.userId,responsibleUserId:f.userId,action:kind==='review'?'member.packet.review.accepted':'member.packet.action.accepted',entityType:'issue',entityId:f.issueId,details,...changes};
  await db.insert(activityLog).values(row); return row;
 }
 return{...f,config,scope,review,action,proof,insert,source:factory(config)};
}
test('disabled source has no queries or config inspection',async()=>{
 const source=factory({get db(){throw Error('query');},get scope(){throw Error('scope');}});
 assert.equal(source.enabled,false);assert.equal(await source.readEnvelope('bad'),null);
 assert.deepEqual(await source.listEnvelopes(),{entries:[],nextCursor:null});
});
test('both native storage schemas produce scoped exact acceptances in one ordered page',async()=>{
 const f=await setup(),a=await f.insert('review',{id:'ffffffff-ffff-4fff-8fff-ffffffffffff',createdAt:new Date('2026-10-24T12:00:00.001Z')}),b=await f.insert('action',{id:'00000000-0000-4000-8000-000000000001',createdAt:new Date('2026-10-24T12:00:00.002Z')});
 for(const row of [a,b]){const envelope=await f.source.readEnvelope(row.id);assert.equal(envelope.acceptance.source.id,row.id);assert.equal(envelope.acceptance.actor.userId,f.userId);assert.equal(envelope.acceptedDigest,memberHash(envelope.acceptance));assert.deepEqual(envelope.scope,f.scope);}
 const first=await f.source.listEnvelopes({limit:1});assert.equal(first.entries.length,1);assert.equal(first.nextCursor.id,a.id);
 const second=await f.source.listEnvelopes({limit:1,after:first.nextCursor});assert.equal(second.entries[0].envelope.acceptance.source.id,b.id);
 assert.deepEqual(await f.source.listEnvelopes({after:second.nextCursor}),{entries:[],nextCursor:null});
});
test('oversized first row remains deferred and does not starve later other-producer row',async()=>{
 const f=await setup();const huge=await f.insert('review',{id:'00000000-0000-4000-8000-000000000011',details:{large:'界'.repeat(40000)}});const valid=await f.insert('action',{id:'00000000-0000-4000-8000-000000000012'});
 const page=await f.source.listEnvelopes({limit:2});assert.deepEqual(page.entries.filter(e=>e.envelope===null).map(e=>e.cursor.id),[huge.id]);assert.equal(page.entries.find(e=>e.envelope).envelope.acceptance.source.id,valid.id);assert.equal(page.nextCursor.id,valid.id);
 await assert.rejects(()=>f.source.readEnvelope(huge.id),/unavailable/);
});
for(const field of ['responsibleUserId','actorType','agentId','entityId','binding','requestKey','scope'])test(`existing malformed ${field} is unavailable, never a false missing source`,async()=>{
 const f=await setup();const row=await f.insert('action');const altered=structuredClone(row);
 if(field==='binding')altered.details.binding.policyHash='0'.repeat(64);else if(field==='requestKey')altered.details.requestKey='0'.repeat(64);else if(field==='scope')f.config.scope.sourceScope='mutated';else altered[field]=field==='actorType'?'agent':randomUUID();
 if(field==='agentId')await db.insert(agents).values({id:altered.agentId,companyId:f.companyId,name:'Synthetic agent',role:'general',adapterType:'process',adapterConfig:{}});
 if(field==='scope'){assert.equal((await f.source.readEnvelope(row.id)).scope.sourceScope,'members');return;}
 const {eq}=await import('drizzle-orm');await db.update(activityLog).set(altered).where(eq(activityLog.id,row.id));
 await assert.rejects(()=>f.source.readEnvelope(row.id),/unavailable/);const page=await f.source.listEnvelopes();assert.deepEqual(page.entries.filter(e=>e.envelope===null).map(e=>e.cursor.id),[row.id]);
});
test('missing and foreign-company rows return no acceptance; configuration rejects mismatched policy scope',async()=>{
 const f=await setup(),g=await setup(),row=await g.insert();assert.equal(await f.source.readEnvelope(randomUUID()),null);assert.equal(await f.source.readEnvelope(row.id),null);
 assert.throws(()=>factory({...f.config,scope:{...f.scope,applicationId:'other'}}));assert.throws(()=>factory({...f.config,reviewBindings:[f.review,f.review]}));
});
test('source routes authenticate native board key and full scope, require lifecycle, and reject bodies/cancel',async()=>{
 const f=await setup(),row=await f.insert();assert.equal(typeof mod.createMemberPacketSourceRouter,'function');let retained=0;
 const config={enabled:true,db,source:f.source,scope:f.scope,principal:{userId:'transport-user',keyId:'transport-key'},lifecycle:{async assertReadable(){retained++;return true;}}};
 const host=mod.createMemberPacketSourceRouter(config),app=express();app.use('/api/member-packet-transport',host.appOptions.memberPacketTransport.beforeBodyParser);app.use((req,_res,next)=>{req.actor={type:'board',source:'board_key',userId:'transport-user',keyId:'transport-key',companyIds:[f.companyId]};next();});app.use('/api/member-packet-transport',host.appOptions.memberPacketTransport.router);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base=`http://127.0.0.1:${server.address().port}/api/member-packet-transport`,headers={'X-Member-Packet-Scope':memberHash(f.scope)};
 try{
  assert.equal((await fetch(base+'/scope')).status,403);
  const read=await fetch(base+'/acceptances/'+row.id,{headers});assert.equal(read.status,200);assert.equal((await read.json()).acceptance.source.id,row.id);assert.equal(retained,1);
  assert.equal((await fetch(base+'/acceptances?limit=33',{headers})).status,400);
  assert.equal((await fetch(base+'/acceptances/'+row.id+'/cancel',{method:'POST',headers})).status,405);
  assert.equal((await fetch(base+'/scope',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'})).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('wire JSON rejects duplicate keys, invalid Unicode, excessive nesting and trailing bytes',()=>{
 assert.equal(typeof wire.parseMemberTransportJson,'function');
 for(const text of ['{"scope":1,"scope":2}','{"x":{"a":1,"\\u0061":2}}','{"x":"\\ud800"}', '[] null','['.repeat(18)+'0'+']'.repeat(18)])assert.throws(()=>wire.parseMemberTransportJson(text));
 assert.deepEqual(wire.parseMemberTransportJson('{"a": [1,true,null,"界"]}'),{a:[1,true,null,'界']});
});

test('equal storage timestamps are deferred without losing keyset pagination',async()=>{
 const f=await setup(),createdAt=new Date('2026-10-24T12:00:00.123Z');const a=await f.insert('review',{createdAt}),b=await f.insert('action',{createdAt});
 const first=await f.source.listEnvelopes({limit:1}),second=await f.source.listEnvelopes({limit:1,after:first.nextCursor});
 assert.deepEqual([first.entries[0].cursor.id,second.entries[0].cursor.id],[a.id,b.id].sort());assert.ok(first.entries[0].envelope);assert.ok(second.entries[0].envelope);assert.equal(first.entries[0].ambiguous,true);assert.equal(second.entries[0].ambiguous,true);
 assert.deepEqual(await f.source.listEnvelopes({after:second.nextCursor}),{entries:[],nextCursor:null});
});
test('valid full foreign application scope is filtered before paging, not disclosed as deferred',async()=>{
 const f=await setup(),createdAt=new Date('2026-10-24T12:00:00.789Z'),foreign=await f.insert('action',{createdAt}),local=await f.insert('review',{createdAt});
 const details=structuredClone(foreign.details),p=snapshotMemberPolicy({...details.binding.policy,scope:{...details.binding.policy.scope,applicationId:'another-application'}});Object.assign(details.binding,p);details.intent.policyHash=p.policyHash;details.intentHash=memberHash(details.intent);
 const {eq}=await import('drizzle-orm');await db.update(activityLog).set({details}).where(eq(activityLog.id,foreign.id));
 const page=await f.source.listEnvelopes({limit:1});assert.equal(page.entries[0].cursor.id,local.id);assert.ok(page.entries[0].envelope,'foreign scope must not make local ordering ambiguous');assert.equal(await f.source.readEnvelope(foreign.id),null);assert.ok(!JSON.stringify(page).includes(foreign.id));
});
