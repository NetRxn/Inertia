/** In-process synthetic SQL qualification; no server, socket, credentials or live DB. */
import test, {after, before} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {activityLog,issues,companies,authUsers,companyMemberships} from '@paperclipai/db';
import {getTableConfig} from 'drizzle-orm/pg-core';
import {eq, sql} from 'drizzle-orm';
import {createFundingReviewCapture} from '../node_modules/@paperclipai/server/dist/services/funding-review-capture.js';
import {createMemberPacketCapture} from '../node_modules/@paperclipai/server/dist/services/member-packet-capture.js';
import {createMemberPacketActionRouter} from '../transport/native/member-actions.mjs';
import {memberNativeCodec} from '../../../dist/src/grants/member-native.js';
import {snapshotMemberPolicy,parseMemberIntent,validateMemberAccessProof,memberTarget} from '../../../dist/src/grants/member-review.js';
import {parsePacketPreview,parseActionResponse} from '../../../dist/src/ui/member-packet-client.js';

const LIMIT=32768,companyId='00000000-0000-4000-8000-000000000001',issueId='00000000-0000-4000-8000-000000000002',otherCompany='00000000-0000-4000-8000-000000000003';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const policy=snapshotMemberPolicy({schema:'inertia.member-review-policy.v2',id:'fixture',version:1,mode:'verified_member_application_access',scope:{companyId,applicantId:'applicant',applicationId:'application',opportunityNamespace:'fixture',opportunityExternalId:'opportunity',sourceScope:'members'},authorityRefs:['fixture:membership'],additionalRequirements:[]});
const target={packetId:'packet',packetVersion:1,packetContentHash:'b'.repeat(64)};
const actionBinding={schema:'inertia.member-packet-route.v2',companyId,issueId,...policy};
const reviewBinding={schema:'inertia.native-member-packet-binding.v2',companyId,issueId,interactionId:id(4),itemId:'item',documentId:id(5),documentKey:'funding-review',documentRevisionId:id(6),interactionDigest:'a'.repeat(64),...policy,target};
const legacyBinding={companyId,issueId,interactionId:id(4),itemId:'item',applicantId:'applicant',targetId:'target',targetVersion:1,kind:'proposal',reviewerUserId:'human',reviewerRole:'program',expectedHead:'a'.repeat(64),expectedWorkspaceHash:'b'.repeat(64),sourceScope:'members',allowedEvidenceIds:['evidence'],allowedTargets:['target'],documentId:id(5),documentKey:'funding-review',documentRevisionId:id(6),interactionDigest:'c'.repeat(64)};
const contracts={...memberNativeCodec,snapshotPolicy:snapshotMemberPolicy,parseIntent:parseMemberIntent,accessProof:validateMemberAccessProof,target:memberTarget,preview:parsePacketPreview,response:parseActionResponse};
const proof={actorUserId:'human',actorType:'human',authenticatedHuman:true,verifiedDaoMember:true,applicationActionAllowed:true,nativeActionAllowed:true,membershipVersion:'fixture',applicationAccessVersion:'fixture'};
const pg=new PGlite();
const returned=[];
const original=pg.query.bind(pg);
// Inspect the actual PostgreSQL result before the Drizzle driver maps JSON into
// receipts; this is not a replacement for the query or its SQL evaluation.
pg.query=async (...args)=>{const result=await original(...args);if(/^select /i.test(args[0])&&args[0].includes('activity_log'))returned.push(result.rows);return result;};
const db=drizzle(pg);
before(async()=>{await pg.exec(`create table activity_log(id uuid primary key,company_id uuid not null,actor_type text not null,actor_id text not null,action text not null,entity_type text not null,entity_id text not null,agent_id uuid,run_id uuid,responsible_user_id text,details jsonb,created_at timestamptz not null default now())`);});
after(()=>pg.close());
function fixture(kind,n=20){
 let details;
 if(kind==='legacy'){
  const command={decisionKey:JSON.stringify([companyId,issueId,legacyBinding.interactionId,legacyBinding.itemId]),binding:structuredClone(legacyBinding),actorUserId:'human',action:'accepted',reason:'Reviewed',resolvedAt:'2026-10-25T00:00:00.000Z'};
  details={schema:'inertia.funding-acceptance.v1',command,commandHash:contracts.hash(command)};
 }else{
  const binding=kind==='action'?actionBinding:reviewBinding;
  const intent={schema:'inertia.member-packet-action.v2',policyHash:policy.policyHash,target,action:kind==='action'?'record_submission':'approve_packet',payload:kind==='action'?{submittedAt:'2026-10-24T12:00:00Z',declaredSubmitter:null,note:'Reported',evidence:null}:{note:'Reviewed'}};
  details={schema:kind==='action'?'inertia.member-native-action-storage.v2':'inertia.member-native-storage.v2',binding:structuredClone(binding),intent,intentHash:contracts.hash(intent),memberAccess:{schema:'inertia.native-member-access-decision.v2',decision:proof},...(kind==='action'?{requestId:'request',requestKey:contracts.hash([companyId,issueId,'human','request']),selectionVersion:'a'.repeat(64)}:{nativeDecisionKey:contracts.hash(contracts.canonical([companyId,issueId,reviewBinding.interactionId,'item']))})};
 }
 return{id:id(n),companyId,actorType:'user',actorId:'human',responsibleUserId:'human',action:kind==='legacy'?'funding.review.accepted':kind==='action'?'member.packet.action.accepted':'member.packet.review.accepted',entityType:'issue',entityId:issueId,agentId:null,runId:null,details,createdAt:new Date('2026-10-25T00:00:00Z')};
}
function reader(kind){
 if(kind==='legacy'){const c=createFundingReviewCapture({registrations:[legacyBinding],rolePermissionKeys:{program:'funding.review.program'}});return{read:key=>c.readAcceptance(db,key),list:input=>c.listAcceptances(db,input)};}
 if(kind==='review'){const c=createMemberPacketCapture({enabled:true,bindings:[reviewBinding],contracts,authorizeInTransaction(){},retention:{assertRetentionInTransaction(){}}});return{read:key=>c.readAcceptance(db,key),list:input=>c.listAcceptances(db,input)};}
 const c=createMemberPacketActionRouter({enabled:true,db,bindings:[actionBinding],contracts,authorizeReadInTransaction(){},authorizeInTransaction(){},previewInTransaction(){},prepareInTransaction(){},readOutcome(){},retention:{assertRetentionInTransaction(){}}});return{read:c.readAcceptance,list:c.listAcceptances};
}
async function reset(){await pg.exec('truncate activity_log');returned.length=0;}
function boundedResults(){for(const rows of returned)for(const row of rows)assert.ok(Buffer.byteLength(JSON.stringify(row))<=LIMIT+1024,'database result must be bounded before driver receipt validation');}
for(const kind of ['legacy','review','action']){
 test(`${kind}: unchanged valid acceptance, cursor and replay`,async()=>{
  await reset();const row=fixture(kind);await db.insert(activityLog).values(row);const r=reader(kind),accepted=await r.read(row.id);assert.ok(accepted);assert.equal(accepted.acceptanceId??accepted.source.id,row.id);
  const page=await r.list({companyId,limit:1});assert.equal(page.receipts.length,1);assert.equal(page.nextCursor,row.id);assert.deepEqual(await reader(kind).read(row.id),accepted);assert.equal((await r.list({companyId,afterId:page.nextCursor})).receipts.length,0);boundedResults();
 });
 for(const bad of ['action','actorType','responsibleUserId','agentId','runId','companyId','entityType'])test(`${kind}: oversized foreign ${bad} excluded before materialization`,async()=>{
  await reset();const row=fixture(kind);row[bad]=bad==='companyId'?otherCompany:['agentId','runId'].includes(bad)?id(999):'unrelated';row.details.large='界'.repeat(LIMIT);await db.insert(activityLog).values(row);returned.length=0;
  const r=reader(kind);assert.equal(await r.read(row.id),null);assert.equal((await r.list({companyId})).receipts.length,0);assert.ok(returned.every(rows=>rows.length===0),'SQL must exclude wrong provenance before returning a payload');boundedResults();
 });
 test(`${kind}: oversized candidate remains pending while later receipt progresses and full sweep retries`,async()=>{
  await reset();const huge=fixture(kind,20),valid=fixture(kind,21);huge.details.large='界'.repeat(LIMIT);await db.insert(activityLog).values([huge,valid]);returned.length=0;
  const r=reader(kind);await assert.rejects(()=>r.read(huge.id),/bound|unavailable/i);
  const page=await r.list({companyId,limit:2});assert.deepEqual(page.deferredAcceptanceIds,[huge.id]);assert.deepEqual(page.receipts.map(x=>x.acceptanceId??x.source.id),[valid.id]);assert.equal(page.nextCursor,valid.id);
  assert.equal((await reader(kind).list({companyId,afterId:page.nextCursor})).nextCursor,null);
  assert.deepEqual((await reader(kind).list({companyId})).deferredAcceptanceIds,[huge.id]);boundedResults();
 });
}
test('legacy: trusted transport scope filters oversized other applicants before projection',async()=>{
 await reset();const row=fixture('legacy');row.details.command.binding.applicantId='foreign';row.details.large='x'.repeat(LIMIT*2);await db.insert(activityLog).values(row);returned.length=0;
 const page=await reader('legacy').list({companyId,applicantId:'applicant',sourceScope:'members'});assert.deepEqual(page.receipts,[]);assert.deepEqual(page.deferredAcceptanceIds??[],[]);assert.ok(returned.every(rows=>rows.length===0));
});
for(const kind of ['review','action'])test(`${kind}: another application is excluded before projection but historical task stays replayable`,async()=>{
 await reset();const row=fixture(kind);row.details.binding.policy.scope.applicationId='foreign';row.details.large='x'.repeat(LIMIT*2);await db.insert(activityLog).values(row);returned.length=0;assert.equal(await reader(kind).read(row.id),null);assert.ok(returned.every(rows=>rows.length===0));
 await reset();const historic=fixture(kind);historic.entityId=id(123);historic.details.binding.issueId=historic.entityId;if(kind==='review')historic.details.nativeDecisionKey=contracts.hash(contracts.canonical([companyId,historic.entityId,reviewBinding.interactionId,'item']));else historic.details.requestKey=contracts.hash([companyId,historic.entityId,'human','request']);await db.insert(activityLog).values(historic);assert.ok(await reader(kind).read(historic.id),'reader scope remains historical application scope, not current task registration');
});

// Exercise the real Express router without opening a listener.
const {createAcceptanceRouter,digestJson}=await import('../transport/native/acceptance-routes.mjs');
const transportScope={schema:'inertia.funding-transport-scope.v1',sourceId:'native',destinationId:'funding',companyId,applicantId:'applicant',sourceScope:'members',purpose:'durable-funding-review'};
function transport(){
 const capture=createFundingReviewCapture({registrations:[legacyBinding],rolePermissionKeys:{program:'funding.review.program'}});
 const router=createAcceptanceRouter({enabled:true,db,capture,scope:transportScope,principal:{userId:'transport',keyId:'key'},lifecycle:{assertReadable:async()=>true}});
 return (path)=>new Promise((resolve,reject)=>{
  const [url,query='']=path.split('?');const req={url:path,originalUrl:path,path:url,method:'GET',query:Object.fromEntries(new URLSearchParams(query)),headers:{},actor:{type:'board',source:'board_key',userId:'transport',keyId:'key',companyIds:[companyId]},get:name=>name==='X-Funding-Scope'?digestJson(transportScope):undefined};
  const res={statusCode:200,set(){return this;},type(){return this;},status(code){this.statusCode=code;return this;},json(value){resolve({status:this.statusCode,value});return this;},send(body){resolve({status:this.statusCode,value:JSON.parse(body)});return this;}};
  router.handle(req,res,error=>error?reject(error):reject(Error('Route not handled')));
 });
}
test('legacy transport preserves deferred identity, excludes foreign scope, and retries after restart',async()=>{
 await reset();const huge=fixture('legacy',20),valid=fixture('legacy',21),foreign=fixture('legacy',22);huge.details.large='界'.repeat(LIMIT);foreign.details.command.binding.applicantId='other';foreign.details.large='x'.repeat(LIMIT*2);await db.insert(activityLog).values([huge,valid,foreign]);returned.length=0;
 const request=transport();const first=await request('/acceptances?limit=2');assert.equal(first.status,200);assert.deepEqual(first.value.deferredAcceptanceIds,[huge.id]);assert.equal(first.value.receipts[0].receipt.acceptanceId,valid.id);assert.equal(first.value.nextCursor,valid.id);
 const last=await request('/acceptances?afterId='+first.value.nextCursor);assert.deepEqual(last.value.deferredAcceptanceIds,[]);assert.equal(last.value.nextCursor,null);
 assert.equal((await request('/acceptances/'+huge.id)).status,503,'oversized accepted identity is unavailable, never missing');
 assert.deepEqual((await transport()('/acceptances')).value.deferredAcceptanceIds,[huge.id]);boundedResults();
});
test('legacy transport budget split never exposes deferred IDs beyond its consumed cursor',async()=>{
 await reset();const rows=[];for(let n=20;n<60;n++){const row=fixture('legacy',n);row.details.command.binding.allowedEvidenceIds=['x'.repeat(30000)];row.details.commandHash=contracts.hash(row.details.command);rows.push(row);}const huge=fixture('legacy',60);huge.details.large='x'.repeat(LIMIT*2);rows.push(huge);await db.insert(activityLog).values(rows);
 const request=transport();let cursor=null,ids=[],deferred=[];for(let n=0;n<3;n++){const result=await request('/acceptances?limit=100'+(cursor?'&afterId='+cursor:''));assert.equal(result.status,200);const page=result.value;assert.ok(Buffer.byteLength(JSON.stringify(page))<=1024*1024);assert.ok(page.deferredAcceptanceIds.every(key=>page.nextCursor===null||key<=page.nextCursor));ids.push(...page.receipts.map(x=>x.receipt.acceptanceId));deferred.push(...page.deferredAcceptanceIds);cursor=page.nextCursor;if(cursor===null)break;}
 assert.deepEqual(ids,rows.slice(0,-1).map(x=>x.id));assert.deepEqual(deferred,[huge.id]);assert.equal(cursor,null);
});
for(const kind of ['legacy','review','action'])test(`${kind}: exact SQL byte boundary, one-byte overflow and Unicode expansion`,async()=>{
 await reset();const row=fixture(kind);row.details.large='界';await db.insert(activityLog).values(row);
 const measure=async()=>Number((await pg.query(`select octet_length(to_jsonb(r)::text) as bytes from (select id,company_id as "companyId",actor_type as "actorType",actor_id as "actorId",agent_id as "agentId",run_id as "runId",action,entity_type as "entityType",entity_id as "entityId",responsible_user_id as "responsibleUserId",created_at as "createdAt",details from activity_log) r`)).rows[0].bytes);
 row.details.large+='x'.repeat(LIMIT-await measure());await db.update(activityLog).set({details:row.details}).where(eq(activityLog.id,row.id));assert.equal(await measure(),LIMIT);
 let page=await reader(kind).list({companyId,limit:1});assert.deepEqual(page.deferredAcceptanceIds,[]);assert.equal(returned.at(-1)[0][2]===null,false,'exact-size payload remains available for validation');
 row.details.large+='x';await db.update(activityLog).set({details:row.details}).where(eq(activityLog.id,row.id));assert.equal(await measure(),LIMIT+1);page=await reader(kind).list({companyId,limit:1});assert.deepEqual(page.deferredAcceptanceIds,[row.id]);
 row.details.large=row.details.large.slice(0,-2)+'界';await db.update(activityLog).set({details:row.details}).where(eq(activityLog.id,row.id));assert.equal(await measure(),LIMIT+2,'UTF-8 bytes, not JS characters, determine allocation');assert.deepEqual((await reader(kind).list({companyId})).deferredAcceptanceIds,[row.id]);boundedResults();
});

async function actionRecoveryRouter(){
 // Minimal synthetic table declarations support the real native read/auth path;
 // no migration, external database, or authority stub is used.
 for(const table of [issues,companies,authUsers,companyMemberships]){
  const config=getTableConfig(table);await pg.exec(`create table if not exists "${config.name}" (${config.columns.map(c=>`"${c.name}" ${c.getSQLType()}`).join(',')})`);
  await pg.exec(`truncate "${config.name}"`);
 }
 await db.insert(issues).values({id:issueId,companyId,title:'Synthetic issue',status:'in_progress'});
 await db.insert(companies).values({id:companyId,name:'Synthetic company',status:'active'});
 await db.insert(authUsers).values({id:'human',name:'Synthetic human',email:'human@example.invalid'});
 await db.insert(companyMemberships).values({id:id(90),companyId,principalType:'user',principalId:'human',status:'active',membershipRole:'member'});
 const host=createMemberPacketActionRouter({enabled:true,db,bindings:[actionBinding],contracts,authorizeReadInTransaction:async()=>true,authorizeInTransaction:async()=>proof,previewInTransaction(){throw Error('Unexpected preview after existing request');},prepareInTransaction(){throw Error('Existing request must not remint');},readOutcome:async()=>null,retention:{assertRetentionInTransaction(){throw Error('Existing request must not reach persistence');}}});
 const router=host.appOptions.memberPacketActions.router;
 return (path,method='GET',body)=>new Promise((resolve,reject)=>{
  const req={url:path,originalUrl:path,method,body,actor:{type:'board',source:'session',userId:'human',isInstanceAdmin:true,companyIds:[companyId],memberships:[{companyId,status:'active',membershipRole:'member'}]}};
  const res={statusCode:200,set(){return this;},status(code){this.statusCode=code;return this;},json(value){resolve({status:this.statusCode,value});return this;}};
  router.handle(req,res,error=>error?reject(error):reject(Error('Route not handled')));
 });
}
test('member request recovery keeps oversized prior unavailable, never missing or reminted, then replays the same identity',async()=>{
 await reset();const row=fixture('action'),originalDetails=structuredClone(row.details);row.details.large='界'.repeat(LIMIT);await db.insert(activityLog).values(row);const request=await actionRecoveryRouter();returned.length=0;
 const base='/issues/'+issueId,body={requestId:'request',selectionVersion:row.details.selectionVersion,intent:row.details.intent};
 await assert.rejects(()=>request(base+'/requests/request'),/bound/);
 await assert.rejects(()=>request(base+'/actions','POST',body),/bound/);
 assert.equal((await pg.query('select count(*) as count from activity_log')).rows[0].count,1);boundedResults();
 // Test-only correction models a repaired/restored source, not authorized mutation
 // of a retained production receipt. Recovery must retain the original UUID.
 await db.update(activityLog).set({details:originalDetails}).where(eq(activityLog.id,row.id));
 for(const restart of [request,await actionRecoveryRouter()]){
  const recovered=await restart(base+'/requests/request');assert.equal(recovered.status,200);assert.equal(recovered.value.sourceId,row.id);assert.equal(recovered.value.state,'accepted_pending');
  const retry=await restart(base+'/actions','POST',body);assert.equal(retry.status,202);assert.equal(retry.value.sourceId,row.id);
 }
 assert.equal((await pg.query('select count(*) as count from activity_log')).rows[0].count,1);
});
