import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {nativeDatabase,nativeIdentityFixture,loadNative,nativeRoot,schema,eq} from './native-fixture.mjs';
import {sdkWire} from './sdk-wire.mjs';
const harnessRoot=path.dirname(fileURLToPath(import.meta.url));
const root=process.env.QUALIFICATION_OUTPUT_DIR;
const privateRoot=process.env.QUALIFICATION_PRIVATE_ROOT;
const python=process.env.QUALIFICATION_PYTHON;
if(!root||!privateRoot||!python)throw Error('Use run.sh with QUALIFICATION_PRIVATE_ROOT and QUALIFICATION_PYTHON; no production defaults are allowed.');
const {registerPublicDrafting,publicDraftingTools,publicDraftingCapabilities}=await import(pathToFileURL(path.join(root,'build/src/drafting/host.js')).href);
const {createPublicDraftingBridge}=await import(pathToFileURL(path.join(root,'build/src/drafting/stdio.js')).href);
process.env.PYTHONPATH=path.join(privateRoot,'src')+':'+path.join(privateRoot,'tests');
const work=await fs.mkdtemp(path.join(root,'run-'));
const fixture=JSON.parse(execFileSync(python,[path.join(harnessRoot,'prepare-dfw.py'),work],{encoding:'utf8'}));
const {db,client,migrationCount}=await nativeDatabase();
let wire;
const checks=[];
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
try{
  const identity=await nativeIdentityFixture(db);
  const {companyId,projectId,producer,reviewer}=identity;
  const configFile=path.join(work,'scope.json');
  await fs.writeFile(configFile,JSON.stringify({database_url:fixture.database_url,company_id:companyId,applicant_slug:fixture.applicant_slug,match_id:fixture.match_id}));
  const inspect=()=>JSON.parse(execFileSync(python,[path.join(harnessRoot,'inspect-dfw.py'),configFile],{encoding:'utf8'}));
  const baseline=inspect();
  const entrypoint=path.join(privateRoot,'src/dfw_incentives/public_drafting_stdio.py');
  const pins=[];
  const sourceRoot=path.join(privateRoot,'src/dfw_incentives');
  const sourceFiles=(await fs.readdir(sourceRoot,{recursive:true,withFileTypes:true})).filter(f=>f.isFile()&&f.name.endsWith('.py')).map(f=>path.join(f.parentPath,f.name)).sort();
  for(const filename of [configFile,...sourceFiles]){
    pins.push({path:filename,sha256:createHash('sha256').update(await fs.readFile(filename)).digest('hex')});
  }
  // Pin all Python package source and administrator configuration, never model input.
  // The interpreter and installed dependencies remain preinstalled fixture inputs.
  const selectedPins=pins;
  const processBridge=createPublicDraftingBridge({executable:python,cwd:privateRoot,entrypoint,configurationPath:configFile,args:[entrypoint,'--config',configFile],pins:selectedPins,timeoutMs:120000,maxOutputBytes:4*1024*1024});
  let authorized=true,bridgeCalls=0,afterContextHook;
  const contexts=[];
  const bridge={call:async(op,params,callbacks)=>{bridgeCalls++;return processBridge.call(op,params,{...callbacks,context:async(signal)=>{
    const context=await callbacks.context(signal);contexts.push({op,context});await afterContextHook?.();return context;
  }});}};
  const binding={enabled:true,companyId,projectId,applicantSlug:fixture.applicant_slug,matchId:fixture.match_id,producer,reviewer,bridge,authorize:async()=>authorized};
  const pluginId=randomUUID(),pluginKey='netrxn.drafting-qualification';
  const manifest={id:pluginKey,apiVersion:1,version:'0.0.0',capabilities:publicDraftingCapabilities,tools:publicDraftingTools};
  await db.insert(schema.plugins).values({id:pluginId,pluginKey,packageName:'fixture-public-drafting',version:'0.0.0',status:'ready',manifestJson:manifest});
  wire=await sdkWire({db,pluginId,manifest,companyId,setup:async ctx=>registerPublicDrafting(ctx,[binding],{own:async(_scope,work)=>work()})});
  const {createToolGatewayService}=await loadNative('@paperclipai/server/dist/services/tool-gateway.js');
  const gateway=createToolGatewayService(db,{pluginToolDispatcher:wire.dispatcher});
  const nativeContext=actor=>({companyId,projectId,agentId:actor.agentId,runId:actor.runId});
  const call=async(tool,parameters={},actor=producer,overrides={})=>{
    const response=await gateway.executePluginTool({tool:`${pluginKey}:${tool}`,parameters,runContext:nativeContext(actor),actor:{type:'agent',companyId,agentId:actor.agentId,runId:actor.runId},...overrides});
    return response.result.data;
  };
  let workspace;
  await check('real native gateway, dispatcher, registry, SDK RPC and Python workspace',async()=>{
    workspace=await call('funding_drafting_workspace');
    assert.match(workspace.workspace_hash,/^[a-f0-9]{64}$/);
    assert.ok(workspace.context.evidence.length);
    assert.ok(!JSON.stringify(workspace).includes('PRIVATE-'));
    assert.ok(contexts.length>1,'Python requests fresh native context more than once');
    assert.ok(contexts.every(x=>x.context.principal_id===producer.principalId&&x.context.run_id===producer.runId));
    const rpc=wire.messages.find(x=>x.direction==='host'&&x.message.method==='executeTool');
    assert.deepEqual(rpc.message.params.parameters,{});
    assert.deepEqual(rpc.message.params.runContext,nativeContext(producer));
  });
  await check('native public workspace exposes strict nested gap-progress contract',async()=>{
    assert.equal(workspace.output_contract.workspace_hash,workspace.workspace_hash);
    const contract=workspace.output_contract.gap_progress_schema;
    assert.equal(contract.type,'object');
    assert.equal(contract.additionalProperties,false);
    assert.deepEqual(contract.required,['requirement_id']);
    assert.equal(contract.properties.requirement_id.type,'string');
    for(const key of ['attempts','required_evidence','partner_options','prepared_work']){
      assert.equal(contract.properties[key].type,'array');
      assert.match(contract.properties[key].items.$ref,/^#\/\$defs\//);
    }
    const defs=contract.$defs;
    assert.deepEqual(new Set(defs.ResearchAttempt.required),new Set(['id','phase','outcome','sources','finding']));
    assert.deepEqual(new Set(defs.ResearchAttempt.properties.phase.enum),new Set(['requirement_evidence','existing_relationships','local_partners','preparation']));
    assert.deepEqual(new Set(defs.ResearchAttempt.properties.outcome.enum),new Set(['complete','no_match','access_blocked']));
    assert.deepEqual(new Set(defs.PartnerOption.required),new Set(['organization','role','relationship','evidence_ids','contact','contact_evidence_id','contact_excerpt']));
    assert.deepEqual(new Set(defs.PartnerOption.properties.relationship.enum),new Set(['existing_affiliation','linked_affiliation','local_prospect']));
    assert.deepEqual(new Set(defs.Dependency.required),new Set(['kind','owner','detail']));
    assert.deepEqual(new Set(defs.Dependency.properties.kind.enum),new Set(['access','authority','external_commitment']));
    for(const key of ['ResearchAttempt','EvidenceNeed','PartnerOption','PreparedWork','Dependency'])assert.equal(defs[key].additionalProperties,false);
  });
  await check('model parameters cannot supply company, project, principal, role or run identity',async()=>{
    const count=bridgeCalls;
    for(const field of ['company_id','companyId','projectId','principal_id','run_id','runId','role','issueId','applicant_slug','match_id','database_url','runContext']){
      await assert.rejects(()=>call('funding_drafting_workspace',{[field]:'forged'}),/Invalid public drafting parameters/);
    }
    assert.equal(bridgeCalls,count);
  });
  await check('native gateway rejects authenticated actor/context mismatch before worker dispatch',async()=>{
    const before=wire.messages.filter(x=>x.message.method==='executeTool').length;
    await assert.rejects(()=>call('funding_drafting_workspace',{},producer,{runContext:nativeContext(reviewer)}),/another agent/);
    assert.equal(wire.messages.filter(x=>x.message.method==='executeTool').length,before);
  });
  await check('fresh native stored run status blocks stale calls',async()=>{
    await db.update(schema.heartbeatRuns).set({status:'succeeded',finishedAt:new Date()}).where(eq(schema.heartbeatRuns.id,producer.runId));
    await assert.rejects(()=>call('funding_drafting_workspace'),/Run is not active/);
    await db.update(schema.heartbeatRuns).set({status:'running',finishedAt:null}).where(eq(schema.heartbeatRuns.id,producer.runId));
  });
  await check('fresh native issue assignment and configured authorization block child I/O',async()=>{
    const before=bridgeCalls;
    await db.update(schema.issues).set({assigneeAgentId:reviewer.agentId}).where(eq(schema.issues.id,producer.issueId));
    await assert.rejects(()=>call('funding_drafting_workspace'),/assignment unavailable/);
    await db.update(schema.issues).set({assigneeAgentId:producer.agentId}).where(eq(schema.issues.id,producer.issueId));
    authorized=false;
    await assert.rejects(()=>call('funding_drafting_workspace'),/disabled or configuration changed/);
    authorized=true;
    assert.equal(bridgeCalls,before);
  });
  await check('native agent revocation between Python callbacks aborts the same operation',async()=>{
    let called=false;
    afterContextHook=async()=>{
      if(called)return;called=true;
      await db.update(schema.agents).set({status:'paused'}).where(eq(schema.agents.id,producer.agentId));
    };
    await assert.rejects(()=>call('funding_drafting_workspace'),/trusted callback rejected/);
    afterContextHook=undefined;
    await db.update(schema.agents).set({status:'running'}).where(eq(schema.agents.id,producer.agentId));
    assert.ok(called);
    assert.deepEqual(inspect(),baseline);
  });
  await check('real public gap checkpoint survives a new Python process and exact replay',async()=>{
    const requirement=workspace.context.official_package.requirements[0];
    const params={workspace_hash:workspace.workspace_hash,progress:{requirement_id:requirement.key??requirement.requirement_key,attempts:[{id:'gateway-fixture-research',phase:'requirement_evidence',outcome:'complete',sources:['OPP-1'],finding:'Captured sponsor guide asks for the program and measurable outcomes.'}]}};
    const extraProgress={...params.progress,principal_id:'forged-producer'};
    const extraAttempt={...params.progress,attempts:[{...params.progress.attempts[0],run_id:'forged-run'}]};
    for(const progress of [extraProgress,extraAttempt])await assert.rejects(()=>call('save_funding_gap_progress',{...params,progress}),/rejected request/);
    assert.equal(inspect().gap_events.length,0);
    const first=await call('save_funding_gap_progress',params);
    const second=await call('save_funding_gap_progress',params);
    assert.equal(second.progress_hash,first.progress_hash);
    const snapshot=inspect();
    assert.equal(snapshot.gap_events.length,1);
    assert.equal(snapshot.gap_events[0].principal,producer.principalId);
    assert.equal(snapshot.gap_events[0].run,producer.runId);
    assert.equal(snapshot.gap_events[0].hash,first.progress_hash);
  });
  const evidence=workspace.context.evidence[0];
  const text='We propose a program with measurable outcomes.';
  const proposal={target_type:'sponsor_answer',target_key:'SPONSOR.PROGRAM_SUMMARY',value:text,evidence_ids:['OPP-1'],confidence:.8,rationale:'Public program basis',claim_support:[{claim_text:text,claim_start:0,claim_end:text.length,evidence_id:'OPP-1',source_locator:evidence.source_locator,source_revision:evidence.source_revision,source_content_hash:evidence.content_sha256,support_kind:'proposal_basis'}]};
  const saveParams={workspace_hash:workspace.workspace_hash,proposals:[proposal]};
  let saved,request;
  await check('real DFW candidate save persists one native public review document',async()=>{
    saved=await call('save_funding_proposals',saveParams);
    assert.equal(saved.results[0].state,'pending');
    assert.equal(wire.wakeups.length,1);
    assert.equal(wire.wakeups[0].issueId,reviewer.issueId);
    const documents=await wire.services.issueDocuments.list({issueId:reviewer.issueId,companyId});
    assert.equal(documents.length,1);
    const document=await wire.services.issueDocuments.get({issueId:reviewer.issueId,companyId,key:documents[0].key});
    request=JSON.parse(document.body).request;
    assert.equal(request.request_id,saved.results[0].request_id);
    assert.ok(!document.body.includes('PRIVATE-'));
    assert.ok(!document.body.includes(producer.principalId));
  });
  await check('native review document supplies the complete strict machine-review output contract',async()=>{
    const contract=request.output_contract;
    assert.equal(contract.type,'object');
    assert.equal(contract.additionalProperties,false);
    assert.deepEqual(new Set(contract.required),new Set(['candidate_hash','requirement_hash','evidence_set_hash','rubric_version','requirement_supported','findings']));
    for(const key of ['candidate_hash','requirement_hash','evidence_set_hash','rubric_version'])assert.equal(contract.properties[key].type,'string');
    assert.equal(contract.properties.rubric_version.minLength,1);
    assert.equal(contract.properties.requirement_supported.type,'boolean');
    assert.equal(contract.properties.findings.type,'array');
    const itemRef=contract.properties.findings.items.$ref;
    assert.match(itemRef,/^#\/\$defs\//);
    const finding=contract.$defs[itemRef.split('/').at(-1)];
    assert.equal(finding.additionalProperties,false);
    assert.deepEqual(new Set(finding.required),new Set(['claim_start','claim_end','support','excerpt','rationale']));
    assert.equal(finding.properties.claim_start.type,'integer');
    assert.equal(finding.properties.claim_end.type,'integer');
    assert.deepEqual(new Set(finding.properties.support.enum),new Set(['supported','partial','unsupported','contradicted']));
    for(const key of ['excerpt','rationale']){assert.equal(finding.properties[key].type,'string');assert.equal(finding.properties[key].minLength,1);}
  });
  const artifact={candidate_hash:request?.candidate.candidate_hash,requirement_hash:request?.candidate.requirement_hash,evidence_set_hash:request?.candidate.evidence_set_hash,rubric_version:'qualification-deterministic-v1',requirement_supported:true,findings:[{claim_start:0,claim_end:text.length,support:'supported',excerpt:'Describe the program and measurable outcomes.',rationale:'Deterministic fixture judgment, not live model quality.'}]};
  await check('reviewer identity comes from native callback, never candidate JSON',async()=>{
    await assert.rejects(()=>call('review_funding_candidate',{request_id:request.request_id,artifact}),/actor denied/);
    await assert.rejects(()=>call('review_funding_candidate',{request_id:request.request_id,artifact,principal_id:reviewer.principalId},reviewer),/Invalid public drafting parameters/);
    await assert.rejects(()=>call('review_funding_candidate',{request_id:request.request_id,artifact:{...artifact,principal_id:'forged-reviewer'}},reviewer),/rejected request/);
    await assert.rejects(()=>call('review_funding_candidate',{request_id:'f'.repeat(64),artifact},reviewer),/rejected request/);
    assert.equal(inspect().reviews.length,0);
    const result=await call('review_funding_candidate',{request_id:request.request_id,artifact},reviewer);
    assert.deepEqual(result,{request_id:request.request_id,state:'supported'});
    assert.ok(contexts.some(x=>x.op==='review'&&x.context.principal_id===reviewer.principalId&&x.context.run_id===reviewer.runId));
    assert.equal(wire.wakeups.length,2);
    assert.equal(wire.wakeups[1].issueId,producer.issueId);
  });
  await check('producer retry reuses reviewed durable candidate without human acceptance',async()=>{
    const result=await call('save_funding_proposals',saveParams);
    assert.equal(result.packet.draft_candidates[0].human_acceptance,'not_accepted');
    assert.equal(result.packet.requirement_review.ready_for_human_signoff,false);
    assert.equal(wire.wakeups.length,2);
    assert.ok(!JSON.stringify(result).includes('PRIVATE-'));
    await call('review_funding_candidate',{request_id:request.request_id,artifact},reviewer);
    assert.equal(wire.wakeups.length,2);
  });
  await check('same configured reviewer recovers exact completion from a new native run',async()=>{
    const successor={...reviewer,runId:randomUUID()};
    await db.update(schema.heartbeatRuns).set({status:'succeeded',finishedAt:new Date()}).where(eq(schema.heartbeatRuns.id,reviewer.runId));
    await db.insert(schema.heartbeatRuns).values({id:successor.runId,companyId,agentId:reviewer.agentId,status:'running',contextSnapshot:{issueId:reviewer.issueId,projectId}});
    await db.update(schema.issues).set({checkoutRunId:successor.runId,executionRunId:successor.runId}).where(eq(schema.issues.id,reviewer.issueId));
    const result=await call('review_funding_candidate',{request_id:request.request_id,artifact},successor);
    assert.deepEqual(result,{request_id:request.request_id,state:'supported'});
    const changed=structuredClone(artifact);changed.findings[0].rationale='Changed review bytes must not overwrite the accepted machine artifact.';
    await assert.rejects(()=>call('review_funding_candidate',{request_id:request.request_id,artifact:changed},successor),/rejected request/);
    assert.equal(wire.wakeups.length,2);
    assert.ok(contexts.some(x=>x.op==='review'&&x.context.run_id===successor.runId));
  });
  const domainSnapshot=inspect();
  await check('durable domain SQL records exact independent identities and only one effect',async()=>{
    assert.equal(domainSnapshot.candidates.length,1);
    assert.equal(domainSnapshot.reviews.length,1);
    assert.equal(domainSnapshot.suggestions.length,1);
    assert.equal(domainSnapshot.candidates[0].principal,producer.principalId);
    assert.equal(domainSnapshot.candidates[0].run,producer.runId);
    assert.equal(domainSnapshot.reviews[0].principal,reviewer.principalId);
    assert.equal(domainSnapshot.reviews[0].run,reviewer.runId);
    assert.equal(domainSnapshot.reviews[0].candidate,domainSnapshot.candidates[0].id);
    assert.equal(domainSnapshot.suggestions[0].status,'suggested');
    assert.equal(domainSnapshot.applicant_field_count,baseline.applicant_field_count);
    assert.equal(domainSnapshot.outcome_count,baseline.outcome_count);
  });
  const receipt={scope:'Controlled native gateway integration; no HTTP authentication, deployed runtime, real model, source acquisition, or live wake qualification.',nativeVersion:'2026.1012.0',migrationCount,nativeDatabase:'isolated in-memory PGlite with all pinned migrations and constraints',domainDatabase:'isolated SQLite using real DFW domain services',fixtures:['authenticated-route actor identity','native company/project/issues/agents/runs and tool allow policy','owner serialization callback','reviewer wake queue and deterministic candidate judgment','public sponsor evidence'],realPath:['createToolGatewayService.executePluginTool','createPluginToolDispatcher.executeTool','createPluginToolRegistry.executeTool','startWorkerRpcHost executeTool JSON-RPC','registerPublicDrafting callback','native buildHostServices issue reads/checkout/documents','createPublicDraftingBridge','public_drafting_stdio.py','PublicDraftingService'],checks,bridgeCalls,freshContextReads:contexts.length,wakeRequests:wire.wakeups.length,workDirectory:work};
  receipt.domainSnapshot=domainSnapshot;
  receipt.sourcePins=selectedPins;
  receipt.publicSourceHashes={};
  for(const relative of ['drafting/host.js','drafting/stdio.js','discovery/documents.js','discovery/service.js']){
    receipt.publicSourceHashes[relative]=createHash('sha256').update(await fs.readFile(path.join(root,'build/src',relative))).digest('hex');
  }
  receipt.nativeSourceHashes={};
  for(const relative of ['@paperclipai/server/dist/services/tool-gateway.js','@paperclipai/server/dist/services/plugin-tool-dispatcher.js','@paperclipai/server/dist/services/plugin-tool-registry.js','@paperclipai/server/dist/services/plugin-host-services.js','@paperclipai/plugin-sdk/dist/worker-rpc-host.js','@paperclipai/plugin-sdk/dist/host-client-factory.js','@paperclipai/db/dist/migrations/meta/_journal.json']){
    receipt.nativeSourceHashes[relative]=createHash('sha256').update(await fs.readFile(path.join(nativeRoot,relative))).digest('hex');
  }
  receipt.nativeInvocations=await db.select({tool:schema.toolInvocations.toolName,agent:schema.toolInvocations.agentId,run:schema.toolInvocations.runId,status:schema.toolInvocations.status}).from(schema.toolInvocations);
  await fs.writeFile(path.join(root,'gateway-dispatch-proof.json'),JSON.stringify({route:'createToolGatewayService.executePluginTool',fixtureActor:{type:'agent',companyId,agentId:producer.agentId,runId:producer.runId},workspaceRpc:wire.messages.find(x=>x.direction==='host'&&x.message.method==='executeTool'),pythonCallbacks:contexts},null,2)+'\n');
  await fs.writeFile(path.join(root,'qualification-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({checks:checks.length,bridgeCalls,freshContextReads:contexts.length,wakeRequests:wire.wakeups.length,pinnedPythonSources:sourceFiles.length,migrationCount,receipt:path.join(root,'qualification-receipt.json')},null,2));
}finally{
  wire?.close();await client.close();
}
