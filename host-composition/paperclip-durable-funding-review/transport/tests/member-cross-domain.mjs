/** Real disposable PostgreSQL/native producers -> native HTTP -> private domain.
 * Admission/current authority callbacks are explicitly synthetic fixture policy.
 * Uses the exact frozen Task2 module until it is merged; never rewrites that lane. */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {and,eq,sql} from 'drizzle-orm';
import {activityLog,authUsers,companyMemberships,documentRevisions,issueThreadInteractions,principalPermissionGrants} from '@paperclipai/db';
import {fixture,db,client,digest} from '../../tests/fixture.mjs';
import {createApp} from '../../node_modules/@paperclipai/server/dist/app.js';
import {createMemberPacketCapture} from '../../node_modules/@paperclipai/server/dist/services/member-packet-capture.js';
import {accessService} from '../../node_modules/@paperclipai/server/dist/services/access.js';
import {boardAuthService} from '../../node_modules/@paperclipai/server/dist/services/board-auth.js';
import {memberNativeCodec} from '../../../../dist/src/grants/member-native.js';
import {canonicalJson} from '../../../../dist/src/grants/engine.js';
import {memberHash,snapshotMemberPolicy,parseMemberIntent,validateMemberAccessProof,memberTimestamp,memberTarget} from '../../../../dist/src/grants/member-review.js';
import {createMemberPacketSource,createMemberPacketSourceRouter} from '../native/member-source.mjs';
import {createMemberPacketDelivery} from '../native/member-delivery.mjs';
const project=process.env.REVIEW_DFW_PROJECT,python=process.env.REVIEW_PYTHON,handoff=process.env.REVIEW_DFW_POSTGRES_HANDOFF;
assert.ok(project&&python&&handoff,'Use the private disposable PostgreSQL member launcher');
const task2=process.env.MEMBER_TASK2_ROOT;
const {createMemberPacketActionRouter}=await import(task2?`${task2}/host-composition/paperclip-durable-funding-review/transport/native/member-actions.mjs`:'../native/member-actions.mjs');
const {parsePacketPreview,parseActionResponse}=await import(task2?`${task2}/dist/src/ui/member-packet-client.js`:'../../../../dist/src/ui/member-packet-client.js');
const work=await fs.mkdtemp(path.join(os.tmpdir(),'member-transport-fixture-')),helper=path.join(project,'tests/member_native_transport_fixture.py');
const pyenv={...process.env,PYTHONPATH:`${project}/src:${project}/tests`};for(const key of Object.keys(pyenv))if(key.startsWith('PG')||key.startsWith('NATIVE_CAPTURE_'))delete pyenv[key];
const run=(mode,...args)=>{const result=spawnSync(python,[helper,mode,work,...args],{env:pyenv,encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.stderr);return result.stdout;};
let app,server,child,initialized=false,stopped=false;
async function stop(){if(!child||child.exitCode!==null||child.signalCode!==null)return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Private fixture stop unconfirmed; retain files')),5000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.kill('SIGTERM');});}
try{
 const f=await fixture();run('init',handoff,f.companyId);initialized=true;
 const input=JSON.parse(await fs.readFile(path.join(work,'member-input.json'),'utf8')),scope=input.scope,p=snapshotMemberPolicy(input.policy),target=input.target;
 assert.equal(p.policyHash,input.policyHash);
 await db.insert(authUsers).values({id:f.userId,name:'Synthetic member',email:`${f.userId}@example.invalid`,createdAt:new Date(),updatedAt:new Date()});
 await db.insert(documentRevisions).values({id:f.revisionId,companyId:f.companyId,documentId:f.documentId,revisionNumber:1,body:'Synthetic exact evidence'});
 await db.delete(principalPermissionGrants).where(eq(principalPermissionGrants.companyId,f.companyId));
 [f.card]=await db.update(issueThreadInteractions).set({addresseeUserId:null,payload:{...f.card.payload,allowBulkApprove:false}}).where(eq(issueThreadInteractions.id,f.interactionId)).returning();
 await db.execute(sql`create function qualification_member_delivery_immutable() returns trigger language plpgsql as $$ begin if TG_OP='TRUNCATE' then raise exception 'synthetic immutable member source'; end if; if OLD.action in ('member.packet.review.accepted','member.packet.action.accepted') then raise exception 'synthetic immutable member source'; end if; if TG_OP='DELETE' then return OLD; end if; return NEW; end $$`);
 await db.execute(sql`create trigger qualification_member_delivery_immutable before update or delete on activity_log for each row execute function qualification_member_delivery_immutable()`);
 await db.execute(sql`create trigger qualification_member_delivery_no_truncate before truncate on activity_log for each statement execute function qualification_member_delivery_immutable()`);
 const retention={async assertRetentionInTransaction(tx){const rows=await tx.execute(sql`select tgname from pg_trigger where tgrelid='activity_log'::regclass and tgenabled='O' and tgname in ('qualification_member_delivery_immutable','qualification_member_delivery_no_truncate')`);assert.equal(rows.length,2);return true;}};
 const reviewBinding={schema:'inertia.native-member-packet-binding.v2',companyId:f.companyId,issueId:f.issueId,interactionId:f.interactionId,itemId:'item-1',documentId:f.documentId,documentKey:'funding-review',documentRevisionId:f.revisionId,interactionDigest:digest(f.card),...p,target};
 const actionBinding={schema:'inertia.member-packet-route.v2',companyId:f.companyId,issueId:f.issueId,...p};
 const proof=(actor)=>({actorUserId:actor,actorType:'human',authenticatedHuman:true,verifiedDaoMember:true,applicationActionAllowed:true,nativeActionAllowed:true,membershipVersion:'synthetic-member-v1',applicationAccessVersion:'synthetic-native-action-v1'});
 async function nativeAuthority(tx,context){assert.equal(context.actor.userId,f.userId);const decision=await accessService(tx).decide({actor:context.actor,action:'issue:mutate',resource:{type:'issue',companyId:f.companyId,issueId:f.issueId,status:context.issue.status,assigneeAgentId:context.issue.assigneeAgentId??null,assigneeUserId:context.issue.assigneeUserId??null}});assert.equal(decision.allowed,true);return proof(context.actor.userId);}
 const capture=createMemberPacketCapture({enabled:true,contracts:memberNativeCodec,bindings:[reviewBinding],retention,authorizeInTransaction:(tx,source)=>nativeAuthority(tx,{...source.originalAuthenticatedContext,issue:source.issue})});
 const contracts={...memberNativeCodec,snapshotPolicy:snapshotMemberPolicy,parseIntent:parseMemberIntent,accessProof:validateMemberAccessProof,timestamp:memberTimestamp,target:memberTarget};
 const preview={schema:'inertia.member-packet-preview.v2',policyHash:p.policyHash,selectionVersion:'a'.repeat(64),defaultTarget:target,canAct:true,packets:[{target,label:'Exact fixture packet',document:{id:f.documentId,key:'funding-review',revisionId:f.revisionId},preparation:{ready:true,blockers:[]},review:{state:'not_reviewed',policyHash:null,recordedAt:null},formal:{complete:true,requirements:[]}}],submissions:[],nativeActions:[],attachments:[]};
 let delivery;
 const actions=createMemberPacketActionRouter({enabled:true,db,bindings:[actionBinding],contracts:{...contracts,preview:parsePacketPreview,response:parseActionResponse},retention,authorizeReadInTransaction:async()=>true,authorizeInTransaction:nativeAuthority,previewInTransaction:async()=>structuredClone(preview),prepareInTransaction:async()=>true,readOutcome:(accepted,context)=>delivery?delivery.readOutcome(accepted,context):null});
 const readerId=randomUUID();await db.insert(authUsers).values({id:readerId,name:'Synthetic transport only',email:`${readerId}@example.invalid`,createdAt:new Date(),updatedAt:new Date()});await db.insert(companyMemberships).values({companyId:f.companyId,principalType:'user',principalId:readerId,status:'active',membershipRole:'member'});
 const key=await boardAuthService(db).createNamedBoardApiKey({userId:readerId,name:'Disposable member transport'});
 const source=createMemberPacketSource({enabled:true,db,scope,contracts,reviewBindings:[reviewBinding],actionBindings:[actionBinding]});
 const native=createMemberPacketSourceRouter({enabled:true,db,source,scope,principal:{userId:readerId,keyId:key.id},lifecycle:{assertReadable:()=>db.transaction(tx=>retention.assertRetentionInTransaction(tx))}});
 app=await createApp(db,{uiMode:'none',serverPort:0,storageService:{},deploymentMode:'authenticated',deploymentExposure:'private',allowedHostnames:['127.0.0.1'],bindHost:'127.0.0.1',authReady:true,companyDeletionEnabled:false,managedPluginAutoInstall:[],localPluginDir:`${process.env.NATIVE_CAPTURE_FIXTURE_ROOT}/plugins`,resolveSession:async()=>({session:{id:'fixture-human-session'},user:{id:f.userId}}),memberPacketReviewCapture:{db,...capture},...actions.appOptions,...native.appOptions});await app.locals.bundledPluginsStartup;
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const origin=`http://127.0.0.1:${server.address().port}`,headers={origin,'content-type':'application/json'};
 const verdict=await fetch(`${origin}/api/issues/${f.issueId}/interactions/${f.interactionId}/verdicts`,{method:'POST',headers,body:JSON.stringify(f.input)});assert.equal(verdict.status,200,await verdict.clone().text());
 const [reviewRow]=await db.select({id:activityLog.id}).from(activityLog).where(and(eq(activityLog.companyId,f.companyId),eq(activityLog.action,'member.packet.review.accepted')));assert.ok(reviewRow);
 const base=`${origin}/api/member-packet-actions/issues/${f.issueId}`,current=await (await fetch(base,{headers})).json();
 const requestId=randomUUID(),body={requestId,selectionVersion:current.selectionVersion,intent:{schema:'inertia.member-packet-action.v2',policyHash:p.policyHash,target,action:'record_submission',payload:{submittedAt:'2026-10-24T12:00:00Z',declaredSubmitter:null,note:'Synthetic prior submission attestation',evidence:null}}};
 const accepted=await fetch(base+'/actions',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(accepted.status,202,await accepted.clone().text());const action=await accepted.json();assert.equal(action.state,'accepted_pending');
 const sources=[reviewRow.id,action.sourceId];await fs.writeFile(path.join(work,'native-sources.json'),JSON.stringify(sources));
 const nativeUrl=origin+'/api/member-packet-transport',fundingToken=randomBytes(24).toString('hex');
 await fs.writeFile(path.join(work,'transport.json'),JSON.stringify({nativeUrl,scope,nativeToken:key.token,fundingToken,policy:p.policy,actorUserId:f.userId}),{mode:0o600});
 child=spawn(python,[helper,'serve',work],{env:pyenv,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stderr.on('data',b=>{stderr=(stderr+b).slice(-3000);});
 const started=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Private fixture startup timeout: '+stderr)),15000);child.once('exit',()=>{clearTimeout(timer);reject(Error('Private fixture exited: '+stderr));});child.stdout.on('data',b=>{stdout+=b;try{const line=JSON.parse(stdout.split('\n')[0]);if(line.port){clearTimeout(timer);resolve(line);}}catch{}});});assert.equal(started.dialect,'postgresql');
 const fundingUrl=`http://127.0.0.1:${started.port}/member-packet-transport`,state=new Map();let lost=false,readbacks=0,calls=0;const delivered=[];
 const ctx={http:{async fetch(url,options){calls++;if(url.endsWith('/apply'))delivered.push(url.split('/').at(-2));const response=await fetch(url,options);if(url.endsWith('/outcome'))readbacks++;if(!lost&&url.endsWith('/apply')){assert.equal(response.status,200);await response.arrayBuffer();lost=true;throw Error('Synthetic lost committed response');}return response;}},secrets:{resolve:async ref=>ref.secretId==='native'?key.token:fundingToken},state:{get:async key=>state.get(JSON.stringify(key)),set:async(key,value)=>state.set(JSON.stringify(key),value),delete:async key=>state.delete(JSON.stringify(key))}};
 delivery=createMemberPacketDelivery(ctx,{enabled:true,scope,contracts,nativeUrl,fundingUrl,nativeSecretRef:{type:'secret_ref',secretId:'native'},fundingSecretRef:{type:'secret_ref',secretId:'domain'},fixtureLoopback:true,pageSize:1});
 let sweeps=0,applied=0;const invocations=[];for(let i=0;i<10&&sweeps<2;i++){calls=0;const result=await delivery.reconcile();assert.equal(result.state,'ready');assert.ok(calls<=6);applied+=result.applied;invocations.push({calls,...result});if(result.complete)sweeps++;}assert.equal(sweeps,2);assert.equal(applied,4);assert.equal(lost,true);assert.equal(readbacks,1);assert.deepEqual(delivered,[...sources,...sources]);
 const recovered=await fetch(base+'/requests/'+requestId,{headers});assert.equal(recovered.status,200);const recoveredBody=await recovered.json();assert.equal(recoveredBody.state,'applied');assert.equal(recoveredBody.sourceId,action.sourceId);
 const replay=await fetch(base+'/actions',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(replay.status,202);assert.equal((await replay.json()).sourceId,action.sourceId);
 await boardAuthService(db).revokeBoardApiKey(key.id);assert.equal((await delivery.reconcile()).state,'pending');for(const id of sources){const result=await fetch(`${fundingUrl}/acceptances/${id}/outcome`,{headers:{'X-Admin-Token':fundingToken,'X-Member-Packet-Scope':memberHash(scope)}});assert.equal(result.status,200);assert.equal((await result.json()).envelope.outcome.state,'applied');}
 await stop();stopped=true;const checked=JSON.parse(run('check'));assert.equal(checked.dialect,'postgresql');
 console.log(JSON.stringify({state:'passed',native:'actual native human verdict and frozen Task2 submission routes on PostgreSQL',source:'one bounded combined native activity query and real authenticated board-key HTTP',domain:'real member service and PostgreSQL/PostGIS audit',authority:'explicit synthetic current-authority callback, not live original-human reconstruction',sdk:'standard fetch fixture; SDK bounds qualified separately',sources:2,invocations,lostResponseReadback:true,requestCorrelationRecovered:true,sourceKeyRevokedDurableReadback:true,domainChecks:checked,noSourceDeletion:true,noProviderSubmission:true}));
}finally{
 if(!stopped)await stop();if(server)await new Promise(resolve=>server.close(resolve));if(app)await app.locals.paperclipShutdown();await client.end();if(initialized){const clean=JSON.parse(run('cleanup'));assert.equal(clean.state,'fixture_schema_removed');}await fs.rm(work,{recursive:true,force:true});
}
