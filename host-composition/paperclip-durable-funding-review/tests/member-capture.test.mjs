import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {and,eq,sql} from 'drizzle-orm';
import {activityLog,authUsers,companyMemberships,documents,issueThreadInteractions,principalPermissionGrants} from '@paperclipai/db';
import {issueThreadInteractionService} from '../node_modules/@paperclipai/server/dist/services/issue-thread-interactions.js';
import {accessService} from '../node_modules/@paperclipai/server/dist/services/access.js';
import {fixture,db,client,digest} from './fixture.mjs';
import {memberNativeCodec} from '../../../dist/src/grants/member-native.js';
import {snapshotMemberPolicy} from '../../../dist/src/grants/member-review.js';
const mod=await import('../node_modules/@paperclipai/server/dist/services/member-packet-capture.js').catch(e=>e.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(e));
after(()=>client.end());
// Disposable test-only storage guards, not production retention installation.
let guards;
async function ensureReceiptGuards(){
 guards??=db.transaction(async tx=>{
  await tx.execute(sql`create or replace function qualification_member_receipt_immutable() returns trigger language plpgsql as $$ begin if TG_OP='TRUNCATE' then if exists(select 1 from activity_log where action='member.packet.review.accepted') then raise exception 'synthetic immutable member receipt'; end if; return null; end if; if OLD.action='member.packet.review.accepted' then raise exception 'synthetic immutable member receipt'; end if; if TG_OP='DELETE' then return OLD; end if; return NEW; end $$`);
  await tx.execute(sql`create trigger qualification_member_receipt_immutable before update or delete on activity_log for each row execute function qualification_member_receipt_immutable()`);
  await tx.execute(sql`create trigger qualification_member_receipt_no_truncate before truncate on activity_log for each statement execute function qualification_member_receipt_immutable()`);
  await tx.execute(sql`create unique index qualification_member_receipt_key on activity_log(company_id,(details->>'nativeDecisionKey')) where action='member.packet.review.accepted'`);
 });
 await guards;
}
async function setup(){
 assert.equal(typeof mod.createMemberPacketCapture,'function','native member capture factory exists');
 await ensureReceiptGuards();
 const f=await fixture();
 await db.insert(authUsers).values({id:f.userId,name:'Synthetic member',email:`${f.userId}@example.invalid`,createdAt:new Date(),updatedAt:new Date()});
 const payload={...f.card.payload,allowBulkApprove:false};
 [f.card]=await db.update(issueThreadInteractions).set({addresseeUserId:null,payload}).where(eq(issueThreadInteractions.id,f.interactionId)).returning();
 await db.delete(principalPermissionGrants).where(eq(principalPermissionGrants.companyId,f.companyId));
 const p=snapshotMemberPolicy({schema:'inertia.member-review-policy.v2',id:'synthetic-native-admission',version:1,mode:'verified_member_application_access',scope:{companyId:f.companyId,applicantId:'applicant',applicationId:'application',opportunityNamespace:'fixture',opportunityExternalId:'opportunity',sourceScope:'members'},authorityRefs:['synthetic:designated-native-admission'],additionalRequirements:[]});
 const binding={schema:'inertia.native-member-packet-binding.v2',companyId:f.companyId,issueId:f.issueId,interactionId:f.interactionId,itemId:'item-1',documentId:f.documentId,documentKey:'funding-review',documentRevisionId:f.revisionId,interactionDigest:digest(f.card),...p,target:{packetId:'packet',packetVersion:1,packetContentHash:'b'.repeat(64)}};
 const context={actor:{type:'board',source:'session',sessionId:'synthetic-session',userId:f.userId,companyIds:[f.companyId],memberships:[{companyId:f.companyId,status:'active',membershipRole:'member'}],isInstanceAdmin:false},method:'POST',companyId:f.companyId,issueId:f.issueId};
 let designated=true,retained=true;
 const authorizeInTransaction=async(tx,source,b,intent)=>{
  if(!designated)return null;
  const member=await tx.select().from(companyMemberships).where(and(eq(companyMemberships.companyId,b.companyId),eq(companyMemberships.principalType,'user'),eq(companyMemberships.principalId,source.originalAuthenticatedContext.actor.userId))).then(rows=>rows[0]);
  const decision=await accessService(tx).decide({actor:source.originalAuthenticatedContext.actor,action:'issue:mutate',resource:{type:'issue',companyId:b.companyId,issueId:b.issueId,status:source.issue.status,assigneeAgentId:source.issue.assigneeAgentId??null,assigneeUserId:source.issue.assigneeUserId??null}});
  if(!member||member.status!=='active'||!decision.allowed)return null;
  return {actorUserId:source.actor.userId,actorType:'human',authenticatedHuman:true,verifiedDaoMember:true,applicationActionAllowed:true,nativeActionAllowed:true,membershipVersion:memberNativeCodec.hash({id:member.id,status:member.status,updatedAt:member.updatedAt.toISOString()}),applicationAccessVersion:memberNativeCodec.hash({issueId:b.issueId,decision:decision.reason,policyHash:b.policyHash,action:intent?.action??'defer_review'})};
 };
 const config={enabled:true,bindings:[binding],contracts:memberNativeCodec,authorizeInTransaction,retention:{async assertRetentionInTransaction(tx){if(!retained)throw Error('synthetic retention unavailable');const guards=await tx.execute(sql`select tgname from pg_trigger where tgrelid='activity_log'::regclass and tgenabled='O' and tgname in ('qualification_member_receipt_immutable','qualification_member_receipt_no_truncate')`);if(guards.length!==2)throw Error('synthetic receipt guards unavailable');}}};
 const capture=mod.createMemberPacketCapture(config);
 const submit=(input=f.input,actor=f.actor,ctx=context)=>issueThreadInteractionService(db,{captureItemVerdictsInTransaction:(tx,source)=>capture.captureInTransaction(tx,{...source,originalAuthenticatedContext:ctx})}).submitItemVerdicts(f.issue,f.interactionId,input,actor);
 return{...f,binding,context,config,capture,submit,undesignate(){designated=false;},loseRetention(){retained=false;}};
}
async function rows(f){return db.select().from(activityLog).where(and(eq(activityLog.companyId,f.companyId),eq(activityLog.action,'member.packet.review.accepted')));}
async function pending(f){return (await db.select().from(issueThreadInteractions).where(eq(issueThreadInteractions.id,f.interactionId)))[0].status;}

test('default disabled factory never consults authority or storage',async()=>{
 assert.equal(typeof mod.createMemberPacketCapture,'function');let called=0;
 const capture=mod.createMemberPacketCapture({authorizeInTransaction(){called++;}});
 assert.deepEqual(await capture.captureInTransaction(null,{}),[]);assert.equal(await capture.readAcceptance(null,'anything'),null);assert.equal(called,0);
});
test('one unaddressed exact human verdict records one v2 acceptance without role grants',async()=>{
 const f=await setup();await f.submit();const stored=await rows(f);assert.equal(stored.length,1);assert.equal(await pending(f),'answered');
 const accepted=await f.capture.readAcceptance(db,stored[0].id);assert.equal(accepted.schema,'inertia.member-packet-acceptance.v2');assert.equal(accepted.actor.userId,f.userId);assert.equal(accepted.source.id,stored[0].id);assert.equal(accepted.intent.action,'approve_packet');assert.deepEqual(accepted.intent.target,f.binding.target);assert.equal(stored[0].details.memberAccess.schema,'inertia.native-member-access-decision.v2');assert.equal(accepted.authorization.verifiedDaoMember,true);assert.equal(accepted.intentHash,memberNativeCodec.hash(accepted.intent));
 await f.submit();assert.equal((await rows(f)).length,1);assert.deepEqual(await f.capture.readAcceptance(db,stored[0].id),accepted);
 const scan=await f.capture.listAcceptances(db,{companyId:f.companyId,limit:1});assert.equal(scan.receipts[0].source.id,stored[0].id);assert.equal(scan.nextCursor,stored[0].id);
});
test('an independent current same-company member can approve; binding is not a named seat',async()=>{
 const f=await setup();const userId=crypto.randomUUID();await db.insert(authUsers).values({id:userId,name:'Other synthetic human',email:`${userId}@example.invalid`,createdAt:new Date(),updatedAt:new Date()});await db.insert(companyMemberships).values({companyId:f.companyId,principalType:'user',principalId:userId,status:'active',membershipRole:'member'});
 const ctx=structuredClone(f.context);ctx.actor.userId=userId;await f.submit(f.input,{userId},ctx);const accepted=await f.capture.readAcceptance(db,(await rows(f))[0].id);assert.equal(accepted.actor.userId,userId);
});
test('reject maps to feedback and defer does not mint human approval',async()=>{
 for(const verdict of ['reject','defer']){const f=await setup();await f.submit({verdicts:[{id:'item-1',verdict,reason:'Please correct totals'}]});const stored=await rows(f);if(verdict==='defer')assert.equal(stored.length,0);else assert.equal((await f.capture.readAcceptance(db,stored[0].id)).intent.action,'changes_requested');}
});
for(const revoked of ['designation','membership','viewer','auth-user','agent','claimed-actor','local-implicit'])test(`current ${revoked} denial rolls back native verdict and receipt`,async()=>{
 const f=await setup();let actor=f.actor,context=structuredClone(f.context);
 if(revoked==='designation')f.undesignate();if(revoked==='membership')await db.update(companyMemberships).set({status:'inactive'}).where(eq(companyMemberships.principalId,f.userId));if(revoked==='viewer')await db.update(companyMemberships).set({membershipRole:'viewer'}).where(eq(companyMemberships.principalId,f.userId));if(revoked==='auth-user')await db.delete(authUsers).where(eq(authUsers.id,f.userId));if(revoked==='agent')actor={agentId:crypto.randomUUID()};if(revoked==='claimed-actor')context.actor.userId='claimed-other';if(revoked==='local-implicit')context.actor.source='local_implicit';
 await assert.rejects(()=>f.submit(f.input,actor,context));assert.equal(await pending(f),'pending');assert.equal((await rows(f)).length,0);
});
for(const changed of ['document','card','retention','note'])test(`changed ${changed} cannot capture a stale or unverifiable review`,async()=>{
 const f=await setup();if(changed==='document')await db.update(documents).set({latestRevisionId:crypto.randomUUID()}).where(eq(documents.id,f.documentId));if(changed==='card')await db.update(issueThreadInteractions).set({title:'Changed exact card'}).where(eq(issueThreadInteractions.id,f.interactionId));if(changed==='retention')f.loseRetention();const input=changed==='note'?{verdicts:[{id:'item-1',verdict:'approve',reason:'界'.repeat(700)}]}:f.input;
 await assert.rejects(()=>f.submit(input));assert.equal((await rows(f)).length,0);
});
test('trusted registration is frozen and malformed policy/role configuration fails closed',async()=>{
 const f=await setup();f.config.bindings[0].target.packetContentHash='c'.repeat(64);await f.submit();assert.equal((await f.capture.readAcceptance(db,(await rows(f))[0].id)).intent.target.packetContentHash,'b'.repeat(64));
 for(const config of [{...f.config,bindings:[{...f.binding,reviewerRole:'program'}]},{...f.config,authorizeInTransaction:null},{...f.config,retention:null}])assert.throws(()=>mod.createMemberPacketCapture(config));
});
test('a failed audit insert rolls back the real native verdict transaction',async()=>{
 const f=await setup();await db.execute(sql`create or replace function qualification_member_audit_failure() returns trigger language plpgsql as $$ begin if new.action='member.packet.review.accepted' and new.company_id=${sql.raw("'"+f.companyId+"'")} then raise exception 'synthetic audit failure'; end if; return new; end $$`);await db.execute(sql`create trigger qualification_member_audit_failure before insert on activity_log for each row execute function qualification_member_audit_failure()`);
 try{await assert.rejects(()=>f.submit(),error=>String(error.cause?.message??error.message).includes('synthetic audit failure'));assert.equal(await pending(f),'pending');assert.equal((await rows(f)).length,0);}finally{await db.execute(sql`drop trigger qualification_member_audit_failure on activity_log`);await db.execute(sql`drop function qualification_member_audit_failure()`);}
});

test('native receipt storage is immutable in the disposable qualified lifecycle',async()=>{
 const f=await setup();await f.submit();const [receipt]=await rows(f);
 await assert.rejects(()=>db.update(activityLog).set({details:{changed:true}}).where(eq(activityLog.id,receipt.id)));
 await assert.rejects(()=>db.delete(activityLog).where(eq(activityLog.id,receipt.id)));
 assert.equal((await f.capture.readAcceptance(db,receipt.id)).actor.userId,f.userId);
});
test('concurrent exact native verdict retries converge on one durable acceptance',async()=>{
 const f=await setup();await Promise.all([f.submit(),f.submit()]);assert.equal((await rows(f)).length,1);
});

for(const badProof of ['unknown-fields','credential-value'])test(`noncredential decision proof rejects ${badProof} without disabling native redaction`,async()=>{
 const f=await setup();const original=f.config.authorizeInTransaction;
 const capture=mod.createMemberPacketCapture({...f.config,async authorizeInTransaction(...args){const proof=await original(...args);return badProof==='unknown-fields'?{...proof,headers:{authorization:'Bearer synthetic-only-not-a-real-secret'}}:{...proof,applicationAccessVersion:'Bearer synthetic-only-not-a-real-secret'};}});
 await assert.rejects(()=>issueThreadInteractionService(db,{captureItemVerdictsInTransaction:(tx,source)=>capture.captureInTransaction(tx,{...source,originalAuthenticatedContext:f.context})}).submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor));
 assert.equal(await pending(f),'pending');assert.equal((await rows(f)).length,0);
});

test('a member without designated application action access cannot defer a bound review either',async()=>{
 const f=await setup();f.undesignate();await assert.rejects(()=>f.submit({verdicts:[{id:'item-1',verdict:'defer',reason:''}]}));assert.equal(await pending(f),'pending');assert.equal((await rows(f)).length,0);
});

test('native membership revocation serializes with the captured current-action check',async()=>{
 const f=await setup();let signal,release;const reached=new Promise(resolve=>{signal=resolve;}),barrier=new Promise(resolve=>{release=resolve;});const original=f.config.authorizeInTransaction;
 const capture=mod.createMemberPacketCapture({...f.config,async authorizeInTransaction(...args){const proof=await original(...args);signal();await barrier;return proof;}});
 const applying=issueThreadInteractionService(db,{captureItemVerdictsInTransaction:(tx,source)=>capture.captureInTransaction(tx,{...source,originalAuthenticatedContext:f.context})}).submitItemVerdicts(f.issue,f.interactionId,f.input,f.actor);
 await reached;let revoked=false;const revoking=db.update(companyMemberships).set({status:'inactive'}).where(eq(companyMemberships.principalId,f.userId)).then(()=>{revoked=true;});
 try{await new Promise(resolve=>setTimeout(resolve,30));assert.equal(revoked,false,'membership row stays locked until acceptance commits');}finally{release();}
 await applying;await revoking;assert.equal((await rows(f)).length,1);assert.equal((await capture.readAcceptance(db,(await rows(f))[0].id)).actor.userId,f.userId);
});
