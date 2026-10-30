import test from'node:test';import assert from'node:assert/strict';import{mkdtemp,writeFile,readFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{spawnSync}from'node:child_process';import{createHash}from'node:crypto';
import{createNativeReviewStdio}from'../transport/native/native-review-stdio.mjs';
import{gapArtifact,gapReceipt}from'../transport/native/native-gap-review.mjs';
import{createNativeDomainReviewComposition}from'../transport/native/native-domain-review-composition.mjs';
import{createNativeDomainReviewGuard}from'../transport/native/native-domain-review.mjs';
const python=process.env.NATIVE_GAP_PYTHON,dfw=process.env.NATIVE_GAP_DFW_ROOT;
test('cold real private Python gap context/admission/receipt crosses bounded JS duplex and persists distinct evidence',{skip:!python||!dfw},async()=>{
 const root=await mkdtemp(join(tmpdir(),'native-gap-cold-'));
 try{
  const setup=`import sys,json\nfrom pathlib import Path\nfrom dataclasses import asdict\nsys.path[:0]=[${JSON.stringify(dfw+'/src')},${JSON.stringify(dfw+'/tests')}]\nfrom test_native_gap_review import fixture\ndb,public,reviewer,config,facts,envelope,context=fixture(Path(sys.argv[1]))\nprint(json.dumps(dict(config=config,actor=asdict(reviewer),facts=facts,envelope=envelope)))`;
  const built=spawnSync(python,['-c',setup,root],{encoding:'utf8'});assert.equal(built.status,0,built.stderr);const f=JSON.parse(built.stdout);
  const entry=join(root,'entry.py'),file=join(root,'scope.json');
  await writeFile(entry,`import sys,runpy\nsys.path.insert(0,${JSON.stringify(dfw+'/src')})\nrunpy.run_path(${JSON.stringify(dfw+'/src/dfw_incentives/native_review_stdio.py')},run_name='__main__')\n`);
  await writeFile(file,JSON.stringify(f.config),{mode:0o600});const pins=await Promise.all([entry,file].map(async path=>({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')})));
  const bridge=createNativeReviewStdio({executable:python,args:[entry,'--config',file],cwd:root,entrypoint:entry,configurationPath:file,pins,timeoutMs:10000,maxOutputBytes:1048576});
  const callbacks={context:async()=>Object.fromEntries(Object.entries(f.actor).filter(([,v])=>v!==null)),nativeAssignment:async()=>f.facts};
  const ns=f.config.native_scope,scope={companyId:ns.company_id,projectId:ns.project_id,issueId:ns.issue_id,producerAgentId:ns.producer_agent_id,reviewerAgentId:ns.reviewer_agent_id,producerPrincipalId:ns.producer_principal_id,reviewerPrincipalId:ns.reviewer_principal_id,wholePacketReview:true};
  const input={issue:{id:scope.issueId,companyId:scope.companyId,projectId:scope.projectId,status:'in_review',executionRunId:f.facts.reviewer_run_id},interaction:{id:f.facts.interaction_id,companyId:scope.companyId,issueId:scope.issueId,sourceRunId:f.facts.producer_run_id,addresseeAgentId:scope.reviewerAgentId,payload:{target:{type:'custom',key:'native_completion_review',revisionId:f.facts.decision_id}}},actor:{agentId:scope.reviewerAgentId,runId:f.facts.reviewer_run_id},assignment:{sourceRun:{id:f.facts.producer_run_id,companyId:scope.companyId,nativeIssueId:scope.issueId,agentId:scope.producerAgentId},sourceDecision:{id:f.facts.decision_id,companyId:scope.companyId,issueId:scope.issueId,runId:f.facts.producer_run_id,applicationState:'applied'}}};
  const permissions=[],composition=createNativeDomainReviewComposition();composition.install({scopes:[scope],authorize:async(_scope,_input,name)=>{permissions.push(name);return true;},readReviewContext:()=>bridge.call('context',{},callbacks),admitReview:(_scope,_input,a)=>bridge.call('admit',a,callbacks),readReviewReceipt:()=>bridge.call('receipt',{},callbacks),acquireFence:()=>bridge.call('fence',{},callbacks)});
  const context=await composition.reviewContext(input);assert.equal(context.binding.review_kind,'gap_plan');assert(!('candidate_hash'in context.binding));assert(!('manifest_hash'in context.binding));
  assert(gapArtifact(f.envelope));const receipt=await composition.admitReview(input,f.envelope);assert(gapReceipt(receipt,f.envelope));assert.equal(receipt.state,'handoff_ready');assert.deepEqual(await composition.readReviewReceipt(input,f.envelope),receipt);assert(permissions.includes('netrxn.inertia:review_funding_gap_plan'));
  await assert.rejects(()=>bridge.call('admit',{...f.envelope,artifact:{...f.envelope.artifact,progress_hash:'a'.repeat(64)}},callbacks));
  await assert.rejects(()=>bridge.call('fence',{},callbacks),/rejected/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('a gap review subject cannot satisfy the whole-packet native acceptance guard',async()=>{
 const scope={companyId:'company',projectId:'project',issueId:'issue',producerAgentId:'producer',reviewerAgentId:'reviewer',producerPrincipalId:'p',reviewerPrincipalId:'r',wholePacketReview:true};
 const input={decision:'accept',issue:{id:'issue',companyId:'company',projectId:'project',status:'in_review',executionRunId:'r-run'},interaction:{id:'card',companyId:'company',issueId:'issue',sourceRunId:'p-run',addresseeAgentId:'reviewer',payload:{target:{type:'custom',key:'native_completion_review',revisionId:'decision'}}},actor:{agentId:'reviewer',runId:'r-run'},assignment:{sourceRun:{id:'p-run',companyId:'company',nativeIssueId:'issue',agentId:'producer'},sourceDecision:{id:'decision',companyId:'company',issueId:'issue',runId:'p-run',applicationState:'applied'}}};
 const guard=createNativeDomainReviewGuard({scopes:[scope],readCandidate:async()=>({review_kind:'gap_plan'}),readAdmission:async()=>{throw Error('Must never read packet/candidate admission');}});
 await assert.rejects(()=>guard(input),/gap_review_requires_complete_packet/);
});
