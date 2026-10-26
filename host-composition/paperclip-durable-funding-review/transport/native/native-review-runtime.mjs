/** Trusted native/private adapter. Native services retain identity, grants and
 * lifecycle authority. No model-selected paths, credentials, routing or wakes.
 */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {nativeDomainReviewAssignment} from './native-domain-review.mjs';
const fail=code=>{throw Error(code);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const toolNames=['netrxn.inertia:funding_review_context','netrxn.inertia:review_funding_candidate'];
const scopeKeys=['companyId','projectId','issueId','producerAgentId','reviewerAgentId','producerPrincipalId','reviewerPrincipalId'];
const nonempty=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\s\x00-\x1f\x7f]/.test(v);
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export async function createNativeReviewRuntime({bindings,native,stdioFactory}={}) {
  if(!Array.isArray(bindings)||bindings.length!==1||typeof stdioFactory!=='function'
    ||['assertHostAdmission','assertCurrentReviewer','getIssue','getReviewAssignment','decideTool'].some(k=>typeof native?.[k]!=='function'))fail('native_domain_review_runtime_configuration_invalid');
  const entries=[];
  for(const b of bindings){
    const scope=b?.scope,policy=b?.reviewerPolicy;
    if(!scope||Object.keys(scope).length!==scopeKeys.length||scopeKeys.some(k=>!nonempty(scope[k]))
      ||scope.producerAgentId===scope.reviewerAgentId||scope.producerPrincipalId===scope.reviewerPrincipalId
      ||!policy||Object.keys(policy).sort().join()!=='issueIds,projectIds,role,version'
      ||policy.version!==1||policy.role!=='reviewer'||!same(policy.projectIds,[scope.projectId])||!same(policy.issueIds,[scope.issueId]))fail('native_domain_review_runtime_configuration_invalid');
    let config;
    try{
      const file=b.process?.configurationPath,meta=await fs.lstat(file),bytes=await fs.readFile(file);
      if(!meta.isFile()||meta.isSymbolicLink()||(meta.mode&0o077)!==0||meta.uid!==process.getuid?.()||bytes.length>16384)throw Error();
      const expected=b.process.pins?.find(p=>p.path===file)?.sha256;
      if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error();
      config=JSON.parse(bytes.toString('utf8'));
      const ns=config.native_scope;
      for(const [key,value] of Object.entries({company_id:scope.companyId,project_id:scope.projectId,issue_id:scope.issueId,producer_agent_id:scope.producerAgentId,producer_principal_id:scope.producerPrincipalId,reviewer_agent_id:scope.reviewerAgentId,reviewer_principal_id:scope.reviewerPrincipalId}))if(ns?.[key]!==value)throw Error();
      if(config.company_id!==scope.companyId||!nonempty(config.applicant_slug)||!nonempty(config.match_id)||ns.target_type!=='sponsor_answer'||!nonempty(ns.target_key))throw Error();
    }catch{fail('native_domain_review_runtime_configuration_invalid');}
    entries.push(Object.freeze({scope:Object.freeze({...scope}),policy:Object.freeze({...policy,projectIds:Object.freeze([...policy.projectIds]),issueIds:Object.freeze([...policy.issueIds])}),applicantSlug:config.applicant_slug,matchId:config.match_id,stdio:stdioFactory(structuredClone(b.process))}));
  }
  function entry(scope){const e=entries.find(e=>scopeKeys.every(k=>e.scope[k]===scope?.[k]));if(!e)fail('native_domain_review_scope_unavailable');return e;}
  async function hostAdmission(e,input){
    // The owning dispatcher must read current plugin/company enablement and the
    // exact enabled native-attention publicDrafting configuration fingerprint.
    // Native identity and surviving tool grants cannot stand in for this check.
    if(await native.assertHostAdmission(e.scope,freeze(structuredClone(input)))!==true)fail('native_domain_review_host_admission_denied');
  }
  async function fresh(e,input){
    if(input?.actor?.agentId!==e.scope.reviewerAgentId||!nonempty(input.actor.runId)||input.issue?.id!==e.scope.issueId||input.issue.companyId!==e.scope.companyId)fail('native_domain_review_assignment_required');
    await hostAdmission(e,input);
    const binding={companyId:e.scope.companyId,issueId:e.scope.issueId,agentId:e.scope.reviewerAgentId,runId:input.actor.runId,
      nativeFundingPolicy:{...e.policy,companyId:e.scope.companyId,agentId:e.scope.reviewerAgentId},
      nativeReview:{nativeReviewInteractionId:input.interaction?.id,nativeReviewDecisionId:input.assignment?.sourceDecision?.id}};
    await native.assertCurrentReviewer(binding);
    const issue=await native.getIssue(e.scope.issueId,e.scope.companyId);
    const assignment=await native.getReviewAssignment({...binding,contextSnapshot:binding.nativeReview,actingRunId:binding.runId,allowResolvedByRunId:binding.runId});
    const facts={issue,interaction:assignment?.interaction,actor:{agentId:binding.agentId,runId:binding.runId},assignment};
    nativeDomainReviewAssignment(e.scope,facts,{allowResolved:['accepted','rejected'].includes(facts.interaction?.status)});
    await hostAdmission(e,input);
    return facts;
  }
  async function decide(e,input,toolName,args={},options={}){
    if(!toolNames.includes(toolName))fail('native_domain_review_tool_access_denied');
    await fresh(e,input);
    const result=await native.decideTool({companyId:e.scope.companyId,actor:{actorType:'agent',actorId:e.scope.reviewerAgentId,agentId:e.scope.reviewerAgentId},
      runContext:{heartbeatRunId:input.actor.runId,issueId:e.scope.issueId,projectId:e.scope.projectId},
      request:{toolName,providerType:'paperclip_plugin',arguments:args,sideEffecting:toolName===toolNames[1]},consumeRateLimit:options.consumeRateLimit===true});
    return result?.allowed===true&&result.decision==='allow';
  }
  async function current(e,input){const facts=await fresh(e,input);for(const name of toolNames)if(!await decide(e,input,name,{},{}))fail('native_domain_review_tool_access_denied');return facts;}
  async function callbacks(e,input){
    await current(e,input);
    return {
      async context(signal){signal?.throwIfAborted();await current(e,input);signal?.throwIfAborted();return {company_id:e.scope.companyId,applicant_slug:e.applicantSlug,match_id:e.matchId,principal_id:e.scope.reviewerPrincipalId,run_id:input.actor.runId,role:'reviewer'};},
      async nativeAssignment(signal){signal?.throwIfAborted();const f=await current(e,input);signal?.throwIfAborted();return {company_id:e.scope.companyId,project_id:f.issue.projectId,issue_id:f.issue.id,interaction_id:f.interaction.id,decision_id:f.assignment.sourceDecision.id,producer_agent_id:f.assignment.sourceRun.agentId,producer_run_id:f.assignment.sourceRun.id,reviewer_agent_id:e.scope.reviewerAgentId,reviewer_run_id:input.actor.runId};},
    };
  }
  return Object.freeze({scopes:Object.freeze(entries.map(e=>e.scope)),
    authorize:async(scope,input,toolName,args,options)=>decide(entry(scope),input,toolName,args,options),
    async readReviewContext(scope,input){const e=entry(scope);return e.stdio.call('context',{},await callbacks(e,input));},
    async admitReview(scope,input,artifact){const e=entry(scope);return e.stdio.call('admit',artifact,await callbacks(e,input));},
    async readReviewReceipt(scope,input){const e=entry(scope);return e.stdio.call('receipt',{},await callbacks(e,input));},
    async acquireFence(scope,input){
      const e=entry(scope),lease=await e.stdio.call('fence',{},await callbacks(e,input));
      return Object.freeze({...lease,async assertAlive(){await current(e,input);await lease.assertAlive();await current(e,input);}});
    },
  });
}
