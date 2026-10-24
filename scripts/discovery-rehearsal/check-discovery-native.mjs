import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {createStdioDiscoveryBridge} from './plugin/dist/src/discovery/stdio.js';
import {registerFundingDiscovery} from './plugin/dist/src/discovery/host.js';
import {createRuntimeOwner} from './plugin/dist/src/bridge/ownership.js';
import {BRIDGE_NAMESPACE} from './plugin/dist/src/store/postgres.js';
import {manifest} from './plugin/dist/src/manifest.js';
import {issueService} from './node_modules/@paperclipai/server/dist/services/issues.js';
export async function checkDiscoveryNative({m,db,sql,plugin,company,eb,disposers}) {
 const native=m.pluginDatabaseService(db),companyId=company.id;
 const responsibleUserId='funding-fixture-'+randomUUID();
 await sql`insert into "user" (id,name,email,email_verified,created_at,updated_at)
   values (${responsibleUserId},'Synthetic funding owner',${responsibleUserId+'@example.invalid'},false,now(),now())`;
 await sql`insert into company_memberships (company_id,principal_type,principal_id,status,membership_role)
   values (${companyId},'user',${responsibleUserId},'active','owner')`;
 await sql`update companies set default_responsible_user_id=${responsibleUserId} where id=${companyId}`;

 const client={namespace:BRIDGE_NAMESPACE,query:(s,p)=>native.query(plugin.id,s,p),execute:(s,p)=>native.execute(plugin.id,s,p)};
 const services=m.buildHostServices(db,plugin.id,manifest.id,eb,()=>{},{manifest});disposers.push(()=>services.dispose());
 const projectId=randomUUID();await sql`insert into projects(id,company_id,name) values (${projectId},${companyId},'Synthetic funding discovery')`;
 const agentIds=[randomUUID(),randomUUID(),randomUUID()],runIds=[randomUUID(),randomUUID()];
 for(const [i,id]of agentIds.entries())await sql`insert into agents(id,company_id,name,status,adapter_type,adapter_config) values (${id},${companyId},${'Synthetic funding role '+i},'idle','process','{"command":"/bin/true"}')`;
 const domain=issueService(db),rows=[];
 for(const [i,id]of agentIds.entries())rows.push(await domain.create(companyId,{title:'Synthetic funding work '+i,projectId,status:'todo',priority:'medium',assigneeAgentId:id}));
 for(const [i,run]of runIds.entries()){await sql`insert into heartbeat_runs(id,company_id,agent_id,status) values (${run},${companyId},${agentIds[i]},'running')`;await domain.checkout(rows[i].id,agentIds[i],['todo'],run);}
 const fixture=JSON.parse(await readFile('cold-fixture.json','utf8'));
 const bridges={};
 for(const role of ['scout','reviewer']){
  const original=JSON.parse(await readFile(fixture.configs[role].path,'utf8'));original.project_ids=[...original.project_ids,projectId];
  const path=process.cwd()+'/'+role+'-native-config.json',body=JSON.stringify(original);await writeFile(path,body,{mode:0o600});const sha=createHash('sha256').update(body).digest('hex');
  bridges[role]=createStdioDiscoveryBridge({executable:fixture.python,args:['-I',fixture.bootstrap,'--config',path,'--expected-config-sha256',sha,'--expected-package-sha256',fixture.package_sha256],entrypoint:fixture.bootstrap,pins:[{path:fixture.bootstrap,sha256:fixture.bootstrap_sha256},{path,sha256:sha}],cwd:process.cwd(),timeoutMs:30000,maxOutputBytes:2000000});
 }
 const current=await bridges.scout.readCapture(fixture.capture.candidate.captureId);assert.ok(current?.preliminary[0]?.urgent);
 const tools=new Map(),jobs=new Map(),wakeResults=[];let nativeWakeups=0;
 const issues={get:(issueId,companyId)=>services.issues.get({issueId,companyId}),assertCheckoutOwner:p=>services.issues.assertCheckoutOwner(p),documents:{list:(issueId,companyId)=>services.issueDocuments.list({issueId,companyId}),get:(issueId,key,companyId)=>services.issueDocuments.get({issueId,key,companyId}),upsert:p=>services.issueDocuments.upsert(p)},requestWakeup:async(issueId,companyId,opts)=>{
   try {
     const r=await services.issues.requestWakeup({issueId,companyId,...opts});
     wakeResults.push({issueId,...r});if(r.queued||r.runId)nativeWakeups++;return r;
   } catch(error) { wakeResults.push({issueId,error:String(error.message)}); throw error; }
 }};
 // Acquisition was executed by the real DFW fixture builder under controlled HTTP. This
 // seam reuses that exact persisted capture, never claims fresh public-network acquisition.
 const replayCapture = async () => ({...fixture.capture,...await bridges.scout.readCapture(fixture.capture.candidate.captureId)});
 const bridge={...bridges.scout,inspect:replayCapture,
   withDeadline:deadline=>({...bridges.scout.withDeadline(deadline),inspect:replayCapture}),
 };
 const binding={key:'synthetic',enabled:true,companyId,organizationId:'dao',projectId,issueId:rows[0].id,agentId:agentIds[0],urgentIssueId:rows[2].id,publicQueries:['public synthetic foundation skills grants'],capabilities:[],maximumLeads:2,retryAfterMs:3600000,runBudgetMs:120000,bridge,diligence:{issueId:rows[1].id,agentId:agentIds[1],bridge:bridges.reviewer}};
 const ctx={issues,tools:{register:(k,_d,h)=>tools.set(k,h)},jobs:{register:(k,h)=>jobs.set(k,h)}};
 registerFundingDiscovery(ctx,[binding],createRuntimeOwner(client,{workerId:'qualification-native',runId:'qualification'}));
 const scout={companyId,projectId,agentId:agentIds[0],runId:runIds[0]},reviewer={companyId,projectId,agentId:agentIds[1],runId:runIds[1]};
 await tools.get('funding-discovery-context')({binding:'synthetic'},scout);
 const captureResult=await tools.get('funding-discovery-submit')({binding:'synthetic',urls:[fixture.capture.candidate.sourceUrl]},scout);assert.equal(captureResult.data.preliminary.length,1);
 const captureId=fixture.capture.candidate.captureId;
 await assert.rejects(()=>tools.get('funding-diligence-context')({binding:'synthetic',captureId},scout),/Independent/);
 const context=await tools.get('funding-diligence-context')({binding:'synthetic',captureId},reviewer);
 const p=context.data.current.preliminary[0],record=context.data.current.candidate.records[0];assert.ok(p.identityEvidence);
 const admitted=await tools.get('funding-diligence-submit')({binding:'synthetic',captureId,recordId:record.recordId,quote:p.identityEvidence.quote},reviewer);
 assert.equal(admitted.data.admitted_claim,'official_program_name_only');assert.ok(admitted.data.knowledge_receipt.committed.length + admitted.data.knowledge_receipt.reused.length);
 const reused=await bridges.scout.knowledge.begin('native-next-run-'+randomUUID(),{capabilities:[],project_id:projectId});assert.ok(reused.knowledge?.length||reused.items?.length,'admitted official identity reused on next scoped query');
 // The new-sponsor path does not need a recurring adapter or a canonical packet.
 const newCaptureId = fixture.quarantine.candidate.captureId;
 await tools.get('funding-diligence-context')({binding:'synthetic',captureId:newCaptureId},reviewer);
 const sourceIdentity = await tools.get('funding-source-validation-submit')({
   binding:'synthetic',captureId:newCaptureId,corroboratingCaptureId:captureId,
   sponsorName:'New Foundation',quote:'New Foundation',
 },reviewer);
 assert.equal(sourceIdentity.data.state,'source_identity_admitted');
 const factsContext = await tools.get('funding-diligence-context')({binding:'synthetic',captureId:newCaptureId},reviewer);
 const evidence = factsContext.data.current.candidate.fundingEvidence;
 assert.equal(evidence.spanUnits,'unicode_code_points');
 const points = [...evidence.text];
 const quoted = quote => {
   const start = [...evidence.text.slice(0,evidence.text.indexOf(quote))].length;
   assert.equal(points.slice(start,start+[...quote].length).join(''),quote);
   return {quote,span:{start,end:start+[...quote].length}};
 };
 const claim = prefix => {
   const unit = evidence.claimUnits.find(span => points.slice(span.start,span.end).join('').startsWith(prefix));
   assert.ok(unit,'complete claim unit is available');
   return {quote:points.slice(unit.start,unit.end).join(''),span:unit};
 };
 const factsInput = {binding:'synthetic',captureId:newCaptureId,facts:{
   programName:quoted('Community Grant'),deadline:claim('Deadline:'),
   benefit:claim('Awards of'),
 }};
 await assert.rejects(()=>tools.get('funding-facts-submit')(factsInput,scout),/Independent/);
 await assert.rejects(()=>tools.get('funding-facts-submit')(factsInput,{...reviewer,companyId:randomUUID()}),/Independent/);
 const assessment = await tools.get('funding-facts-submit')(factsInput,reviewer);
 assert.equal(assessment.data.state,'funding_facts_assessed');
 assert.equal(assessment.data.preliminary.eligibility,'unknown');
 assert.equal(assessment.data.preliminary.fit,'unknown');
 assert.equal(assessment.data.preliminary.status,'conditional_cycle_unverified');
 assert.equal(assessment.data.preliminary.value.maximum,5000);
 assert.equal(assessment.data.preliminary.deadline.timezone,null);
 assert.ok(assessment.data.preliminary.urgent);
 assert.equal(assessment.data.adapterActivated,false);
 const beforeReplay = await services.issueDocuments.list({issueId:rows[2].id,companyId});
 // Re-register native handlers to simulate worker reconstruction; DFW is a fresh process per call.
 registerFundingDiscovery(ctx,[binding],createRuntimeOwner(client,{workerId:'qualification-native-restarted',runId:'qualification-restart'}));
 const replay = await tools.get('funding-facts-submit')(factsInput,reviewer);
 assert.equal(replay.data.assessmentReceiptId,assessment.data.assessmentReceiptId);
 assert.equal(replay.data.materialEventKey,assessment.data.materialEventKey);
 const afterReplay = await services.issueDocuments.list({issueId:rows[2].id,companyId});
 assert.equal(afterReplay.length,beforeReplay.length,'one native alert artifact across replay and reconstruction');
 const scoutRead = await bridges.scout.readCapture(newCaptureId);
 assert.equal(scoutRead.preliminary[0].assessmentReceiptId,assessment.data.assessmentReceiptId);
 console.log('FUNDING_FACTS_NATIVE_COMPOSITION',JSON.stringify({
   actual:'Pinned Paperclip services/checkout/documents/PostgreSQL plus cold DFW subprocess',
   controlled:'Synthetic HTML capture and tool invocation, no live network or model claims',
   conditionalBrief:true,unicodeSpans:true,wrongActorTenantDenied:true,
   exactSourceIdentityReceipt:true,canonicalPacketRequired:false,adapterActivated:false,
   replayAssessmentReceiptStable:true,nativeAlertArtifactDeduplicated:true,
 }));
 const documents=(await Promise.all(rows.map(row=>services.issueDocuments.list({issueId:row.id,companyId})))).flat();
 assert.ok(documents.length>=5);console.log("NATIVE_WAKEUP_RESULTS",JSON.stringify(wakeResults));assert.ok(nativeWakeups>=1);
 await sql`update heartbeat_runs set status='failed',finished_at=now() where id=${runIds[0]}`;await domain.release(rows[0].id,agentIds[0],runIds[0]);
 await assert.rejects(()=>tools.get('funding-discovery-context')({binding:'synthetic'},scout));
 console.log('DISCOVERY_NATIVE_COMPOSITION',JSON.stringify({actual:'Paperclip2026.1012 native loader, SQL binder, issues/documents/checkouts/wakeups, PostgreSQL; cold DFW Python capture read/admission/next-run SQLite persistence',controlled:'Initial official HTML HTTP fixture and agent tool invocations; no model or public search execution',preliminaryBeforePacket:true,independentScoutDenied:true,exactOfficialIdentityAdmitted:true,nextRunReuse:true,nativeDocuments:documents.length,nativeWakeups,staleCheckoutDenied:true,humanAlert:'qualified separately by real signed Buzz transport fixture, not human-read proof'}));
}
