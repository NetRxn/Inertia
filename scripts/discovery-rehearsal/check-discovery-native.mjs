import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {createStdioDiscoveryBridge} from './plugin/dist/src/discovery/stdio.js';
import {registerFundingDiscovery} from './plugin/dist/src/discovery/host.js';
import {createRuntimeOwner} from './plugin/dist/src/bridge/ownership.js';
import {BRIDGE_NAMESPACE} from './plugin/dist/src/store/postgres.js';
import {manifest} from './plugin/dist/src/manifest.js';
import {issueService} from './node_modules/@paperclipai/server/dist/services/issues.js';
export async function checkDiscoveryNative({m,db,sql,plugin,company,registry,eb,wm,loader,disposers}) {
 const native=m.pluginDatabaseService(db),companyId=company.id;
 const client={namespace:BRIDGE_NAMESPACE,query:(s,p)=>native.query(plugin.id,s,p),execute:(s,p)=>native.execute(plugin.id,s,p)};
 const services=m.buildHostServices(db,plugin.id,manifest.id,eb,()=>{},{manifest});disposers.push(()=>services.dispose());
 const responsibleUserId='fixture-responsible-'+randomUUID();
 await sql`insert into "user"(id,name,email,email_verified,created_at,updated_at) values (${responsibleUserId},'Synthetic responsible member',${responsibleUserId+'@example.invalid'},false,now(),now())`;
 await sql`insert into company_memberships(company_id,principal_type,principal_id,status,membership_role) values (${companyId},'user',${responsibleUserId},'active','member')`;
 const projectId=randomUUID();await sql`insert into projects(id,company_id,name) values (${projectId},${companyId},'Synthetic funding discovery')`;
 const agentIds=[randomUUID(),randomUUID(),randomUUID()],runIds=[randomUUID(),randomUUID()];
 for(const [i,id]of agentIds.entries())await sql`insert into agents(id,company_id,name,status,adapter_type,adapter_config) values (${id},${companyId},${'Synthetic funding role '+i},'idle','process','{"command":"/bin/true"}')`;
 const domain=issueService(db),rows=[];
 for(const [i,id]of agentIds.entries())rows.push(await domain.create(companyId,{title:'Synthetic funding work '+i,projectId,status:'todo',priority:'medium',assigneeAgentId:id,responsibleUserId,createdByUserId:responsibleUserId}));
 for(const [i,run]of runIds.entries()){await sql`insert into heartbeat_runs(id,company_id,agent_id,status) values (${run},${companyId},${agentIds[i]},'running')`;await domain.checkout(rows[i].id,agentIds[i],['todo'],run);}
 const fixture=JSON.parse(await readFile('cold-fixture.json','utf8'));
 const bridges={},processConfigs={};
 const fixtureRoot=dirname(fixture.configs.scout.path),ownedFixture=join(process.cwd(),'owned-cold-fixture');
 await cp(fixtureRoot,ownedFixture,{recursive:true});
 // Clone only fixture data; never admit into the shared pristine SQLite database.
 execFileSync(fixture.python,['-I','-c',`import sqlite3,sys
from pathlib import Path
old,new=map(Path,sys.argv[1:])
c=sqlite3.connect(new/'discovery.db')
for id,path in c.execute('SELECT id,storage_path FROM source_documents').fetchall():
 if path:
  relative=Path(path).relative_to(old)
  target=new/relative
  assert target.is_file()
  c.execute('UPDATE source_documents SET storage_path=? WHERE id=?',(str(target),id))
c.commit();c.close()`,fixtureRoot,ownedFixture],{stdio:'pipe',timeout:10000});
 for(const role of ['scout','reviewer']){
  const originalBytes=await readFile(fixture.configs[role].path);assert.equal(createHash('sha256').update(originalBytes).digest('hex'),fixture.configs[role].sha256);
  const original=JSON.parse(originalBytes);original.project_ids=[...original.project_ids,projectId];
  original.database_url='sqlite:///'+join(ownedFixture,'discovery.db');original.raw_storage_path=join(ownedFixture,'raw');original.source_registry_path=join(ownedFixture,'sources.yaml');
  const path=process.cwd()+'/'+role+'-native-config.json',body=JSON.stringify(original);await writeFile(path,body,{mode:0o600});const sha=createHash('sha256').update(body).digest('hex');
  processConfigs[role]={executable:fixture.python,args:['-I',fixture.bootstrap,'--config',path,'--expected-config-sha256',sha,'--expected-package-sha256',fixture.package_sha256],entrypoint:fixture.bootstrap,pins:[{path:fixture.bootstrap,sha256:fixture.bootstrap_sha256},{path,sha256:sha}],cwd:process.cwd(),timeoutMs:30000,maxOutputBytes:2000000};bridges[role]=createStdioDiscoveryBridge(processConfigs[role]);
 }
 const nativeConfig={enabled:false,fundingDiscovery:{key:'synthetic',enabled:true,organizationId:'dao',principalId:'native-service',projectId,issueId:rows[0].id,agentId:agentIds[0],urgentIssueId:rows[2].id,publicQueries:['public synthetic foundation skills grants'],capabilities:[],maximumLeads:2,retryAfterMs:3600000,runBudgetMs:120000,process:processConfigs.scout,diligence:{issueId:rows[1].id,agentId:agentIds[1],principalId:'independent-reviewer',policyId:'exact-program-name-v1',process:processConfigs.reviewer}}};
 await registry.upsertConfig(plugin.id,companyId,{companyId,configJson:nativeConfig});
 await loader.unloadSingle(plugin.id,manifest.id);const reloaded=await loader.loadSingle(plugin.id);assert.equal(reloaded.success,true,reloaded.error);
 const workerContext=await wm.call(plugin.id,'executeTool',{toolName:'funding-discovery-context',parameters:{binding:'synthetic'},runContext:{companyId,projectId,agentId:agentIds[0],runId:runIds[0]}});
 assert.ok(workerContext.data.saved.query_receipt_id);assert.deepEqual(workerContext.data.publicQueries,nativeConfig.fundingDiscovery.publicQueries);
 console.log('DISCOVERY_CONFIGURED_NATIVE_WORKER',JSON.stringify({actualWorkerReload:true,pinnedDfwScopeMapping:true,nativeExecuteToolContext:true,queryFirstReceipt:true,publicAcquisition:false,modelExecution:false}));
 const current=await bridges.scout.readCapture(fixture.capture.candidate.captureId);assert.ok(current?.preliminary[0]?.urgent);
 const tools=new Map(),jobs=new Map();let nativeWakeups=0;
 const issues={get:(issueId,companyId)=>services.issues.get({issueId,companyId}),assertCheckoutOwner:p=>services.issues.assertCheckoutOwner(p),documents:{list:(issueId,companyId)=>services.issueDocuments.list({issueId,companyId}),get:(issueId,key,companyId)=>services.issueDocuments.get({issueId,key,companyId}),upsert:p=>services.issueDocuments.upsert(p)},requestWakeup:async(issueId,companyId,opts)=>{let r;try{r=await services.issues.requestWakeup({issueId,companyId,...opts})}catch(e){console.log('DISCOVERY_NATIVE_WAKEUP_ERROR',JSON.stringify({issueId,message:e.message,details:e.details}));throw e;}console.log('DISCOVERY_NATIVE_WAKEUP_RESPONSE',JSON.stringify(r));if(r.queued||r.runId)nativeWakeups++;return r;}};
 // Acquisition was executed by the real DFW fixture builder under controlled HTTP. This
 // seam reuses that exact persisted capture, never claims fresh public-network acquisition.
 let fixtureInspections=0;
 const bridge={...bridges.scout,inspect:async url=>{assert.equal(url,fixture.capture.candidate.sourceUrl);fixtureInspections++;return {...fixture.capture,...await bridges.scout.readCapture(fixture.capture.candidate.captureId)}}};
 // Deadline wrapping must never replace the acquisition fixture with a network-capable inspect.
 bridge.withDeadline=()=>bridge;
 const binding={key:'synthetic',enabled:true,companyId,organizationId:'dao',projectId,issueId:rows[0].id,agentId:agentIds[0],urgentIssueId:rows[2].id,publicQueries:['public synthetic foundation skills grants'],capabilities:[],maximumLeads:2,retryAfterMs:3600000,runBudgetMs:120000,bridge,diligence:{issueId:rows[1].id,agentId:agentIds[1],bridge:bridges.reviewer}};
 const buzzFixture=await nativeBuzzFixture({client,companyId,issueId:rows[0].id,bridge:bridges.scout,captureId:fixture.capture.candidate.captureId});binding.humanAlerts=buzzFixture.adapter;
 const ctx={issues,tools:{register:(k,_d,h)=>tools.set(k,h)},jobs:{register:(k,h)=>jobs.set(k,h)}};
 registerFundingDiscovery(ctx,[binding],createRuntimeOwner(client,{workerId:'qualification-native',runId:'qualification'}));
 const scout={companyId,projectId,agentId:agentIds[0],runId:runIds[0]},reviewer={companyId,projectId,agentId:agentIds[1],runId:runIds[1]};
 const {readNativeDocument,writeNativeDocument}=await import('./plugin/dist/src/discovery/documents.js');
 const docInput={issueId:rows[0].id,companyId,key:'funding-qualification-ack-loss',title:'Snapshot replay qualification',format:'markdown',body:'version one'};
 const beforeDocuments=(await issues.documents.list(rows[0].id,companyId)).length;let loseNativeWrite=true;
 const lostWrite={...issues.documents,upsert:async input=>{const row=await issues.documents.upsert(input);if(loseNativeWrite){loseNativeWrite=false;throw Error('synthetic committed document acknowledgement lost')}return row}};
 await assert.rejects(()=>writeNativeDocument(lostWrite,docInput),/acknowledgement lost/);
 await writeNativeDocument(issues.documents,docInput);assert.equal((await issues.documents.list(rows[0].id,companyId)).length,beforeDocuments+1);
 await writeNativeDocument(issues.documents,{...docInput,body:'version two'});assert.equal((await issues.documents.list(rows[0].id,companyId)).length,beforeDocuments+2);
 assert.equal((await readNativeDocument(issues.documents,rows[0].id,docInput.key,companyId)).body,'version two');
 console.log('DISCOVERY_NATIVE_DOCUMENT_SNAPSHOTS',JSON.stringify({nativeFullList:true,immutableVersions:2,latestSequenceResolved:true,lostWriteAcknowledgmentReplayNoDuplicate:true,oldSnapshotsRetained:true}));
 await tools.get('funding-discovery-context')({binding:'synthetic'},scout);
 const captureResult=await tools.get('funding-discovery-submit')({binding:'synthetic',urls:[fixture.capture.candidate.sourceUrl]},scout);assert.equal(fixtureInspections,1);assert.equal(captureResult.data.preliminary.length,1);assert.equal(captureResult.data.deliveryPending,true);
 buzzFixture.retry();await tools.get('funding-discovery-context')({binding:'synthetic'},scout);await buzzFixture.verify();
 const captureId=fixture.capture.candidate.captureId;
 await assert.rejects(()=>tools.get('funding-diligence-context')({binding:'synthetic',captureId},scout),/Independent/);
 const context=await tools.get('funding-diligence-context')({binding:'synthetic',captureId},reviewer);
 const p=context.data.current.preliminary[0],record=context.data.current.candidate.records[0];assert.ok(p.identityEvidence);
 const admitted=await tools.get('funding-diligence-submit')({binding:'synthetic',captureId,recordId:record.recordId,quote:p.identityEvidence.quote},reviewer);
 assert.equal(admitted.data.admitted_claim,'official_program_name_only');assert.ok(admitted.data.knowledge_receipt.committed.length);
 const sourceParams={binding:'synthetic',captureId:fixture.quarantine.candidate.captureId,corroboratingCaptureId:captureId,sponsorName:'New Foundation',quote:'New Foundation'};
 await assert.rejects(()=>wm.call(plugin.id,'executeTool',{toolName:'funding-source-validation-submit',parameters:sourceParams,runContext:scout}),/Independent/);
 await wm.call(plugin.id,'executeTool',{toolName:'funding-diligence-context',parameters:{binding:'synthetic',captureId:sourceParams.captureId},runContext:reviewer});
 const sourceReceipt=await wm.call(plugin.id,'executeTool',{toolName:'funding-source-validation-submit',parameters:sourceParams,runContext:reviewer});
 assert.equal(sourceReceipt.data.state,'source_identity_admitted');assert.equal(sourceReceipt.data.adapterActivated,false);assert.equal(sourceReceipt.data.eligibility,'unknown');
 const sourceReadback=await bridges.scout.readCapture(sourceParams.captureId);assert.equal(sourceReadback.candidate.sourceIdentity.reviewReceiptId,sourceReceipt.data.reviewReceiptId);assert.equal(sourceReadback.preliminary.length,0);
 console.log('DISCOVERY_NEW_SOURCE_NATIVE_REVIEW',JSON.stringify({actualConfiguredWorkerTool:true,independentScoutDenied:true,sourceIdentityAdmitted:true,scope:'exact_capture_only',adapterActivated:false,preliminaryFundingClaims:0,eligibility:'unknown',fixture:'pre-captured synthetic public HTML and official named hyperlink'}));
 const reused=await bridges.scout.knowledge.begin('native-next-run-'+randomUUID(),{capabilities:[],project_id:projectId});assert.ok(reused.knowledge?.length||reused.items?.length,'admitted official identity reused on next scoped query');
 const documents=await sql`select d.title from documents d join issue_documents l on l.document_id=d.id where l.issue_id in (${rows[0].id},${rows[1].id},${rows[2].id})`;
 assert.ok(documents.length>=5);
 console.log('DISCOVERY_NATIVE_WAKEUP_DIAGNOSTICS',JSON.stringify(await sql`select agent_id,status,error,payload from agent_wakeup_requests where company_id=${companyId}`));assert.ok(nativeWakeups>=1);
 const persistedWakeups=await sql`select agent_id,run_id,status,idempotency_key,payload from agent_wakeup_requests where company_id=${companyId} and payload->>'contextSource' in ('inertia.funding-discovery.urgent','inertia.funding-discovery.diligence')`;
 assert.ok(persistedWakeups.some(r=>r.agent_id===agentIds[2]&&r.idempotency_key.startsWith('funding-urgent:')),'native urgent wakeup persisted');
 assert.ok(persistedWakeups.some(r=>r.agent_id===agentIds[1]&&r.idempotency_key.startsWith('funding-diligence:')),'native independent diligence wakeup persisted');
 console.log('DISCOVERY_NATIVE_WAKEUP_ROWS',JSON.stringify(persistedWakeups));
 await sql`update heartbeat_runs set status='failed',finished_at=now() where id=${runIds[0]}`;await domain.release(rows[0].id,agentIds[0],runIds[0]);
 await assert.rejects(()=>tools.get('funding-discovery-context')({binding:'synthetic'},scout));
 console.log('DISCOVERY_NATIVE_COMPOSITION',JSON.stringify({actual:'Paperclip2026.1012 native loader, SQL binder, issues/documents/checkouts/wakeups, PostgreSQL; cold DFW Python capture read/admission/next-run SQLite persistence',controlled:'Initial official HTML HTTP fixture and agent tool invocations; no model or public search execution',preliminaryBeforePacket:true,independentScoutDenied:true,exactOfficialIdentityAdmitted:true,nextRunReuse:true,nativeDocuments:documents.length,nativeWakeups,staleCheckoutDenied:true,humanAlert:'actual native PG outbox and real signed Buzz HTTP client under controlled transport fixture; not real relay/human-read proof'}));
}

async function nativeBuzzFixture({client,companyId,issueId,bridge,captureId}) {
 const {finalizeEvent,getPublicKey,verifyEvent}=await import('./plugin/node_modules/nostr-tools/lib/esm/index.js');
 const {createUrgentBuzzDelivery,urgentBuzzReceiptKey}=await import('./plugin/dist/src/discovery/urgent.js');
 const {makeBuzzHttpClient}=await import('./plugin/dist/src/buzz/http.js');
 const {verifyBuzzEvent}=await import('./plugin/dist/src/buzz/events.js');
 const {createBridgeStore}=await import('./plugin/dist/src/store/postgres.js');
 const {runtimeState}=await import('./plugin/dist/src/bridge/runtime.js');
 const key=new Uint8Array(32).fill(17),signer=t=>finalizeEvent(t,key);
 const scope={organizationId:'dao',companyId,issueId};
 const destination={relay:'https://buzz.fixture.invalid',channelId:randomUUID(),rootId:'b'.repeat(64),bridgePubkey:getPublicKey(key)};
 const config={...scope,...destination,enabled:true,audienceAcknowledged:true};
 const store=createBridgeStore(client),runtime=runtimeState(client,companyId,destination.relay),posts=[];
 let loseAcknowledgment=true,sourceCurrent=true;
 const buzz=makeBuzzHttpClient({relayUrl:destination.relay,signer,clock:()=>Math.floor(Date.now()/1000),sleep:async()=>{},fetch:async(url,init)=>{
  assert.equal(url,destination.relay+'/events');assert.equal(init.method,'POST');assert.equal(init.redirect,'error');
  const body=String(init.body),event=JSON.parse(body),auth=JSON.parse(Buffer.from(init.headers.Authorization.slice('Nostr '.length),'base64').toString());
  assert.ok(verifyEvent(event));assert.ok(verifyEvent(auth));assert.equal(auth.kind,27235);assert.equal(event.kind,9);
  assert.ok(auth.tags.some(t=>t[0]==='payload'&&t[1]===createHash('sha256').update(body).digest('hex')));
  const payload=JSON.parse(event.content),receiptKey=urgentBuzzReceiptKey(config,payload.eventKey),row=await store.getOutbox(receiptKey);
  assert.equal(row.state,'publishing');assert.equal(JSON.stringify(verifyBuzzEvent(row.event).event),body,'persist exact signed event before canonical HTTP serialization');
  posts.push(event);
  return new Response(JSON.stringify({accepted:true,event_id:loseAcknowledgment?'0'.repeat(64):event.id}),{headers:{'content-type':'application/json'}});
 }});
 const deps={scope,destination,loadConfig:async()=>config,signer,buzz,store,runtime,readCurrent:async ref=>{
  if(!sourceCurrent)return false;
  const current=await bridge.readCapture(ref.captureId);
  return !!current?.preliminary.some(p=>p.materialEventKey===ref.materialEventKey&&p.opportunityKey===ref.opportunityKey&&p.urgent);
 }};
 const adapter=createUrgentBuzzDelivery(deps);
 return {adapter,posts,retry:()=>{loseAcknowledgment=false},async verify(){
  assert.equal(posts.length,2);assert.equal(posts[0].id,posts[1].id);assert.equal(JSON.stringify(posts[0]),JSON.stringify(posts[1]));
  const payload=JSON.parse(posts[0].content),input={eventKey:payload.eventKey,body:payload.body,observedAt:payload.observedAt,sourceRef:payload.sourceRef};
  const restarted=createUrgentBuzzDelivery(deps);assert.equal((await restarted.deliver(input)).state,'accepted');assert.equal(posts.length,2);
  const receiptKey=urgentBuzzReceiptKey(config,input.eventKey),row=await store.getOutbox(receiptKey);assert.equal(row.state,'delivered');assert.equal(row.eventId,posts[0].id);
  // A second synthetic material identity exercises source revocation before retry.
  loseAcknowledgment=true;const revokedInput={...input,eventKey:'synthetic-revoked-material'};
  assert.equal((await restarted.deliver(revokedInput)).state,'pending');const before=posts.length;sourceCurrent=false;
  assert.equal((await restarted.deliver(revokedInput)).state,'suppressed');assert.equal(posts.length,before);
  assert.equal((await store.getOutbox(urgentBuzzReceiptKey(config,revokedInput.eventKey))).state,'suppressed');
  key.fill(0);
  console.log('DISCOVERY_NATIVE_BUZZ_OUTBOX',JSON.stringify({actual:'native Paperclip SQL binder, PostgreSQL outbox/runtime, urgent delivery service, signed Nostr events and real Buzz HTTP client',fixture:'synthetic signing key and controlled in-memory HTTP transport; no real relay or human',persistBeforeSend:true,lostAcknowledgmentRetrySameSignedBytes:true,restartDedupe:true,sourceRevocationSuppressesPending:true,acceptedEventId:row.eventId,posts:posts.length,humanRead:false}));
 }};
}
