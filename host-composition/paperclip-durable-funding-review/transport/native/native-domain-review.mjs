/** Domain prerequisite only. Native owns locks, participant authorization and lifecycle.
 * Construct from trusted immutable owning-host scope, never model/request JSON.
 * Wiring must call this under the shared native confirmation lock, after the
 * stock getNativeReviewAssignment check. This factory does not authenticate an
 * arbitrary assignment object and must not be exposed as an agent tool.
 */
const scopeKeys=['companyId','projectId','issueId','producerAgentId','reviewerAgentId','producerPrincipalId','reviewerPrincipalId'];
const bindingKeys=['company_id','issue_id','interaction_id','decision_id','producer_principal_id','producer_run_id','reviewer_principal_id','reviewer_run_id','candidate_hash'];
const nonempty=x=>typeof x==='string'&&x.length>0&&x.length<=200&&!/[\s\x00-\x1f\x7f]/.test(x);
const hash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join() === [...keys].sort().join();
const fail=code=>{throw Error(code);};
export function nativeDomainReviewAssignment(scope,{issue,interaction,actor,assignment}={}, {allowResolved=false}={}) {
    const target=interaction?.payload?.target;
    const source=assignment?.sourceRun;
    const applied=assignment?.sourceDecision;
    const terminal=['accepted','rejected'].includes(interaction?.status);
    const resolved=allowResolved&&terminal&&interaction.resolvedByAgentId===actor?.agentId&&interaction.resolvedByRunId===actor?.runId;
    if(issue?.projectId!==scope.projectId||(!resolved&&(terminal||issue.status!=='in_review'||issue.executionRunId!==actor?.runId))
      ||!actor?.runId||actor.agentId!==scope.reviewerAgentId
      ||!interaction?.id||interaction.companyId!==issue.companyId||interaction.issueId!==issue.id
      ||interaction.addresseeAgentId!==scope.reviewerAgentId||interaction.addresseeUserId
      ||target?.type!=='custom'||target.key!=='native_completion_review'
      ||!source||source.companyId!==issue.companyId||source.nativeIssueId!==issue.id||source.agentId!==scope.producerAgentId
      ||source.id!==interaction.sourceRunId||source.id===actor.runId
      ||!applied||applied.applicationState!=='applied'||applied.id!==target.revisionId
      ||applied.companyId!==issue.companyId||applied.issueId!==issue.id||applied.runId!==source.id)fail('native_domain_review_assignment_required');
    return Object.freeze({company_id:issue.companyId,issue_id:issue.id,interaction_id:interaction.id,decision_id:applied.id,producer_principal_id:scope.producerPrincipalId,producer_run_id:source.id,reviewer_principal_id:scope.reviewerPrincipalId,reviewer_run_id:actor.runId});
}
export function createNativeDomainReviewGuard({scopes,readCandidate,readAdmission}={}) {
  if(!Array.isArray(scopes)||scopes.length<1||scopes.length>16||typeof readCandidate!=='function'||typeof readAdmission!=='function')fail('native_domain_review_configuration_invalid');
  const pinned=scopes.map(s=>{
    if(!exact(s,scopeKeys)||scopeKeys.some(k=>!nonempty(s[k]))||(s.producerAgentId===s.reviewerAgentId||s.producerPrincipalId===s.reviewerPrincipalId))fail('native_domain_review_configuration_invalid');
    return Object.freeze({...s});
  });
  if(new Set(pinned.map(s=>s.companyId+'\0'+s.issueId)).size!==pinned.length)fail('native_domain_review_configuration_invalid');
  return async function assertDomainReview({decision,issue,interaction,actor,assignment}={}) {
    const scope=pinned.find(s=>s.companyId===issue?.companyId&&s.issueId===issue?.id);
    if(!scope)return {required:false};
    // Cancellation, withdrawal and conservative rejection do not assert that
    // a domain requirement is satisfied. Do not convert them into acceptance.
    if(decision==='reject')return {required:false};
    if(decision!=='accept')fail('native_domain_review_assignment_required');
    const facts=nativeDomainReviewAssignment(scope,{issue,interaction,actor,assignment});
    const source=assignment.sourceRun;
    const candidate=await readCandidate(Object.freeze({...scope,producerRunId:source.id}));
    if(!hash(candidate?.candidate_hash)||candidate.producer_principal_id!==scope.producerPrincipalId||candidate.producer_run_id!==source.id)fail('native_domain_review_admission_required');
    const binding=Object.freeze({...facts,candidate_hash:candidate.candidate_hash});
    const receipt=await readAdmission(binding);
    if(!receipt)fail('native_domain_review_admission_required');
    if(!exact(receipt,['binding','review_id','candidate_id','artifact_hash','state'])
      ||!exact(receipt.binding,bindingKeys)||bindingKeys.some(k=>receipt.binding[k]!==binding[k])
      ||!nonempty(receipt.review_id)||!nonempty(receipt.candidate_id)||!hash(receipt.artifact_hash))fail('native_domain_review_receipt_mismatch');
    if(receipt.state!=='supported')fail('native_domain_review_verdict_conflict');
    return Object.freeze({required:true,domainReviewId:receipt.review_id,candidateId:receipt.candidate_id,candidateHash:binding.candidate_hash,artifactHash:receipt.artifact_hash,nativeInteractionId:interaction.id,nativeDecisionId:facts.decision_id});
  };
}
