import test from'node:test';import assert from'node:assert/strict';import{mkdtemp,writeFile,readFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{spawnSync}from'node:child_process';import{createHash}from'node:crypto';
import{createNativeReviewStdio}from'../transport/native/native-review-stdio.mjs';
import{createNativeDomainReviewComposition}from'../transport/native/native-domain-review-composition.mjs';
const python=process.env.NATIVE_GAP_PYTHON,dfw=process.env.NATIVE_GAP_DFW_ROOT;
test('cold actual current-set review covers two real targets and gap across same-case producer runs without one-field retargeting',{skip:!python||!dfw},async()=>{
 const root=await mkdtemp(join(tmpdir(),'native-preparation-cold-'));
 try{
  const setup=`import sys,json\nfrom pathlib import Path\nfrom dataclasses import asdict\nsys.path[:0]=[${JSON.stringify(dfw+'/src')},${JSON.stringify(dfw+'/tests')}]\nimport pytest\nfrom test_native_preparation_review import fixture\ndb,public,reviewer,config,facts=fixture(Path(sys.argv[1]),pytest.MonkeyPatch())\nprint(json.dumps(dict(config=config,actor=asdict(reviewer),facts=facts)))`;
  const built=spawnSync(python,['-c',setup,root],{encoding:'utf8'});assert.equal(built.status,0,built.stderr);const f=JSON.parse(built.stdout);
  const entry=join(root,'entry.py'),file=join(root,'scope.json');await writeFile(entry,`import sys,runpy\nsys.path.insert(0,${JSON.stringify(dfw+'/src')})\nrunpy.run_path(${JSON.stringify(dfw+'/src/dfw_incentives/native_review_stdio.py')},run_name='__main__')\n`);await writeFile(file,JSON.stringify(f.config),{mode:0o600});
  const pins=await Promise.all([entry,file].map(async path=>({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')})));
  const bridge=createNativeReviewStdio({executable:python,args:[entry,'--config',file],cwd:root,entrypoint:entry,configurationPath:file,pins,timeoutMs:20000,maxOutputBytes:1048576}),callbacks={context:async()=>Object.fromEntries(Object.entries(f.actor).filter(([,v])=>v!==null)),nativeAssignment:async()=>f.facts};
  const ns=f.config.native_scope,scope={companyId:ns.company_id,projectId:ns.project_id,issueId:ns.issue_id,producerAgentId:ns.producer_agent_id,reviewerAgentId:ns.reviewer_agent_id,producerPrincipalId:ns.producer_principal_id,reviewerPrincipalId:ns.reviewer_principal_id,wholePacketReview:true};
  const input={issue:{id:scope.issueId,companyId:scope.companyId,projectId:scope.projectId,status:'in_review',executionRunId:f.facts.reviewer_run_id},interaction:{id:f.facts.interaction_id,companyId:scope.companyId,issueId:scope.issueId,sourceRunId:f.facts.producer_run_id,addresseeAgentId:scope.reviewerAgentId,payload:{target:{type:'custom',key:'native_completion_review',revisionId:f.facts.decision_id}}},actor:{agentId:scope.reviewerAgentId,runId:f.facts.reviewer_run_id},assignment:{sourceRun:{id:f.facts.producer_run_id,companyId:scope.companyId,nativeIssueId:scope.issueId,agentId:scope.producerAgentId},sourceDecision:{id:f.facts.decision_id,companyId:scope.companyId,issueId:scope.issueId,runId:f.facts.producer_run_id,applicationState:'applied'}}};
  const permissions=[],composition=createNativeDomainReviewComposition();composition.install({scopes:[scope],preparationReviewEnabled:true,authorize:async(_scope,_input,name)=>{permissions.push(name);return true;},readReviewContext:()=>bridge.call('context',{},callbacks),admitReview:(_scope,_input,a)=>bridge.call('admit',a,callbacks),readReviewReceipt:()=>bridge.call('receipt',{},callbacks),acquireFence:()=>bridge.call('fence',{},callbacks)});
  let manifest;const receipts=[];
  for(const pending of[3,2,1]){
   const context=await composition.reviewContext(input),r=context.context.request,d=r.data;
   assert.equal(context.context.counts.pending,pending);manifest??=context.binding.manifest_hash;assert.equal(context.binding.manifest_hash,manifest);
   const c=d.candidate,a=r.subject_kind==='candidate'?{candidate_hash:c.candidate_hash,requirement_hash:c.requirement_hash,evidence_set_hash:c.evidence_set_hash,rubric_version:'fixture-v1',requirement_supported:true,findings:[{claim_start:0,claim_end:c.value.length,support:'supported',excerpt:'Describe the program and measurable outcomes.',rationale:'Exact current public evidence'}]}:{workspace_hash:d.workspace_hash,progress_hash:d.progress_hash,requirement_id:d.progress.requirement_id,rubric_version:'actionable-gap-v1',agent_work_remaining:false,preparation_sufficient:true,source_support_sufficient:true,decision_is_precise:true,findings:[],next_step:'Request current adopted agreement'};
   const envelope={review_kind:'preparation_item',manifest_hash:manifest,subject_kind:r.subject_kind,subject_id:r.subject_id,artifact:a};
   await assert.rejects(()=>composition.recordPreparationReview(input,{...envelope,manifest_hash:'a'.repeat(64)}));
   const receipt=await composition.recordPreparationReview(input,envelope);assert.deepEqual(await composition.recordPreparationReview(input,envelope),receipt);receipts.push(receipt);
  }
  const final=await composition.reviewContext(input);assert.equal(final.context.counts.pending,0);assert.equal(final.context.request,null);assert.equal(final.context.next_action,'return_to_producer');assert.equal(new Set(receipts.map(r=>r.subject_kind+':'+r.subject_id)).size,3);assert(permissions.includes('netrxn.inertia:review_funding_gap_plan'));assert(permissions.includes('netrxn.inertia:review_funding_candidate'));
  await assert.rejects(()=>bridge.call('fence',{},callbacks));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('compiled record tool dispatch requires current bound reviewer and enabled scope before domain admission',{skip:!process.env.NATIVE_PORTFOLIO_CANDIDATE},async()=>{
 const{nativeFundingToolNames,assertNativeFundingTool}=await import('../transport/native/native-portfolio-funding-policy.mjs');
 assert(nativeFundingToolNames({role:'reviewer'}).includes('record_preparation_review'));
 const source=await readFile(process.env.NATIVE_PORTFOLIO_CANDIDATE+'/dist/services/native-runtime/paperclip-runner-tool-authority.js','utf8');
 const start=source.indexOf("        if(call.tool==='record_preparation_review')"),end=source.indexOf('        if (this.binding.nativeFundingPolicy) {',start);assert(start>=0&&end>start);
 const body=source.slice(start,end).replaceAll('this.#boundContext()','boundContext()').replaceAll('this.#domainReviewFacts(context)','domainReviewFacts(context)');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor,dispatch=new AsyncFunction('call','boundContext','domainReviewFacts','nativeDomainReviewComposition','assertNativeFundingTool','forbidden',body);
 const facts={issue:{id:'actual-current-child'},actor:{runId:'actual-current-review-run'}},calls=[];let enabled=true;
 const composition={preparationReviewEnabled:()=>enabled,recordPreparationReview:async(input,a)=>{calls.push([input,a]);return{distinct:'receipt'};}};
 const binding={nativeReview:{nativeReviewInteractionId:'actual-card'},nativeFundingPolicy:{role:'reviewer'}};
 const run=()=>dispatch.call({binding},{tool:'record_preparation_review',arguments:{manifest_hash:'a'.repeat(64)}},async()=>({issue:facts.issue}),async()=>facts,composition,assertNativeFundingTool,m=>new Error(m));
 assert.deepEqual(await run(),{distinct:'receipt'});assert.equal(calls[0][0],facts);enabled=false;await assert.rejects(run,/not enabled/);enabled=true;binding.nativeFundingPolicy.role='producer';await assert.rejects(run,/not enabled/);assert.equal(calls.length,1);
});
