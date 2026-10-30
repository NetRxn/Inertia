import {reviewContextSelection,packetArtifactView} from './native-review-paging.mjs';
import{createNativeCaseReviewRouter}from'./native-case-review-router.mjs';
import{preparationBinding,preparationArtifact,preparationReceipt,preparationItemSchema}from'./native-preparation-review.mjs';
import{gapBinding,gapArtifact,gapReceipt}from'./native-gap-review.mjs';
import {scopeForIssue} from './native-portfolio-scope.mjs';
import {NATIVE_REVIEW_ARTIFACT_SCHEMA,NATIVE_WHOLE_PACKET_REVIEW_ARTIFACT_SCHEMA} from './native-review-artifact-schema.mjs';
import {packetBinding,packetArtifact,packetReceipt} from './native-packet-review.mjs';
/** One owning-host composition, installed before native startup/sweep work.
 * No registration route, model configuration, queue, reset or reconfiguration.
 * The root service must retain a returned lease until its OWN transaction ends.
 */
import {createHash} from 'node:crypto';
import {createNativeDomainReviewGuard,nativeDomainReviewAssignment} from './native-domain-review.mjs';
const fail=code=>{throw Error(code);};
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
function canonical(value){
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 fail('native_domain_review_artifact_invalid');
}
const hash=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const toolContext='netrxn.inertia:funding_review_context',toolAdmit='netrxn.inertia:review_funding_candidate';
function checkBinding(scope,input,binding,allowResolved=false){
 const expected=nativeDomainReviewAssignment(scope,input,{allowResolved});
 if(scope.wholePacketReview===true&&preparationBinding(binding)){if(Object.entries(expected).some(([k,v])=>binding[k]!==v))fail('native_preparation_receipt_mismatch');return;}
 if(scope.wholePacketReview===true&&gapBinding(binding)){if(Object.entries(expected).some(([k,v])=>binding[k]!==v))fail('native_gap_review_receipt_mismatch');return;}
 if(scope.wholePacketReview===true&&packetBinding(binding)){if(Object.entries(expected).some(([k,v])=>binding[k]!==v))fail('native_packet_review_receipt_mismatch');return;}
 if(!binding||Object.keys(binding).length!==9||!hash(binding.candidate_hash)||Object.entries(expected).some(([k,v])=>binding[k]!==v))fail('native_domain_review_receipt_mismatch');
}

export function createNativeDomainReviewComposition({required=false}={}) {
  if(typeof required!=='boolean')fail('native_domain_review_configuration_invalid');
  let installed;
  const assertReady=()=>{if(required&&!installed)fail('native_domain_review_uninitialized');};
  const scopeFor=issue=>installed?.scopes.map(s=>scopeForIssue(s,issue)).find(Boolean);
  const isBound=issue=>Boolean(scopeFor(issue));
  return Object.freeze({
    install({scopes,acquireFence,authorize,readReviewContext,admitReview,readReviewReceipt,preparationReviewEnabled=false}={}) {
      if(installed)fail('native_domain_review_already_initialized');
      if(typeof preparationReviewEnabled!=='boolean')fail('native_domain_review_configuration_invalid');
      if([acquireFence,authorize,readReviewContext,admitReview,readReviewReceipt].some(f=>typeof f!=='function'))fail('native_domain_review_configuration_invalid');
      // Validate/copy scope before anything can be installed or queried.
      createNativeDomainReviewGuard({scopes,readCandidate:async()=>null,readAdmission:async()=>null});
      installed=Object.freeze({preparationReviewEnabled,scopes:Object.freeze(scopes.map(s=>Object.freeze({...s}))),acquireFence,authorize,readReviewContext,admitReview,readReviewReceipt});
    },
    assertReady,
    isBound(issue){assertReady();return isBound(issue);},
    reviewArtifactSchema(issue){assertReady();const scope=scopeFor(issue);return scope?.wholePacketReview===true?NATIVE_WHOLE_PACKET_REVIEW_ARTIFACT_SCHEMA:NATIVE_REVIEW_ARTIFACT_SCHEMA;},
    preparationReviewEnabled(issue){assertReady();return installed?.preparationReviewEnabled===true&&scopeFor(issue)?.wholePacketReview===true;},
    preparationItemSchema(issue){assertReady();if(!scopeFor(issue)?.wholePacketReview)fail('native_preparation_review_unconfigured');return preparationItemSchema(NATIVE_REVIEW_ARTIFACT_SCHEMA);},
    async recordPreparationReview(input,artifact){
      assertReady();const scope=scopeFor(input?.issue);if(!installed?.preparationReviewEnabled||!scope?.wholePacketReview||!preparationArtifact(artifact))fail('native_preparation_review_unconfigured');
      nativeDomainReviewAssignment(scope,input);
      const tool=artifact.subject_kind==='gap_plan'?'netrxn.inertia:review_funding_gap_plan':toolAdmit;
      if(await installed.authorize(scope,input,tool,{request_id:artifact.subject_id,artifact},{consumeRateLimit:true})!==true)fail('native_domain_review_tool_access_denied');
      const result=await installed.admitReview(scope,input,artifact);checkBinding(scope,input,result?.binding);
      if(!preparationReceipt(result,artifact))fail('native_preparation_receipt_mismatch');return result;
    },
    async reviewContext(input,selection={}){
      assertReady();if(!isBound(input?.issue))return null;
      const scope=scopeFor(input.issue);
      nativeDomainReviewAssignment(scope,input);
      const view=reviewContextSelection(selection);if(view&&!scope.wholePacketReview)fail('native_domain_review_artifact_view_unavailable');const args=view?{artifact_view:view}:{};
      if(await installed.authorize(scope,input,toolContext,args,{consumeRateLimit:true})!==true)fail('native_domain_review_tool_access_denied');
      const result=await installed.readReviewContext(scope,input,args);
      checkBinding(scope,input,result?.binding);
      if(Buffer.byteLength(JSON.stringify(result))>1024*1024||(view?!packetArtifactView(result,view):!result.context||typeof result.context!=='object'))fail('native_domain_review_context_invalid');
      return result;
    },
    async admitReview(input,artifact){
      assertReady();if(!isBound(input?.issue))fail('native_domain_review_unconfigured');
      const scope=scopeFor(input.issue);
      nativeDomainReviewAssignment(scope,input);
      if(!artifact||!(hash(artifact.candidate_hash)||scope.wholePacketReview===true&&(packetArtifact(artifact)||gapArtifact(artifact)))||Buffer.byteLength(JSON.stringify(artifact))>128*1024)fail('native_domain_review_artifact_invalid');
      if(await installed.authorize(scope,input,gapArtifact(artifact)?'netrxn.inertia:review_funding_gap_plan':toolAdmit,{request_id:artifact.candidate_hash??artifact.manifest_hash??artifact.request_id,artifact},{consumeRateLimit:true})!==true)fail('native_domain_review_tool_access_denied');
      const result=await installed.admitReview(scope,input,artifact);
      checkBinding(scope,input,result?.binding);
      if(scope.wholePacketReview===true&&gapArtifact(artifact)){if(!gapReceipt(result,artifact))fail('native_gap_review_receipt_mismatch');return result;}
      if(scope.wholePacketReview===true&&packetArtifact(artifact)){if(!packetReceipt(result,artifact))fail('native_packet_review_receipt_mismatch');return result;}
      if(result.binding.candidate_hash!==artifact.candidate_hash||result.artifact_hash!==digest(artifact)||!['supported','rejected'].includes(result.state))fail('native_domain_review_receipt_mismatch');
      return result;
    },
    async readReviewReceipt(input,artifact){
      assertReady();if(!isBound(input?.issue))fail('native_domain_review_unconfigured');
      const scope=scopeFor(input.issue);
      nativeDomainReviewAssignment(scope,input,{allowResolved:true});
      for(const tool of [toolContext,gapArtifact(artifact)?'netrxn.inertia:review_funding_gap_plan':toolAdmit])if(await installed.authorize(scope,input,tool,{})!==true)fail('native_domain_review_tool_access_denied');
      const result=await installed.readReviewReceipt(scope,input);
      checkBinding(scope,input,result?.binding,true);
      if(scope.wholePacketReview===true&&gapArtifact(artifact)){if(!gapReceipt(result,artifact))fail('native_gap_review_receipt_mismatch');return result;}
      if(scope.wholePacketReview===true&&packetArtifact(artifact)){if(!packetReceipt(result,artifact))fail('native_packet_review_receipt_mismatch');return result;}
      if(!artifact||result.binding.candidate_hash!==artifact.candidate_hash||result.artifact_hash!==digest(artifact)||!['supported','rejected'].includes(result.state))fail('native_domain_review_receipt_mismatch');
      return result;
    },
    assertCompletion({issue,toStatus}={}) {
      assertReady();
      if(isBound(issue)&&toStatus==='done'&&issue.status!=='done')fail('native_domain_review_required_before_completion');
    },
    async acquireResolution(input) {
      assertReady();
      if(!isBound(input?.issue)||input.decision==='reject')return null;
      if(input.nestedTransaction===true)fail('native_domain_review_nested_transaction_unsupported');
      const scope=scopeFor(input.issue);
      let fence,released;
      const release=()=>released??=(async()=>{if(fence)await fence.release();})();
      const acquire=async()=>{
        if(!fence){
          for(const tool of [toolContext,toolAdmit])if(await installed.authorize(scope,input,tool,{})!==true)fail('native_domain_review_tool_access_denied');
          fence=await installed.acquireFence(Object.freeze({...scope}),input);
          if(!fence||typeof fence.release!=='function'||typeof fence.assertAlive!=='function')fail('native_domain_review_fence_invalid');
        }
        return fence;
      };
      try {
        // The guard validates native facts before its first candidate read, so
        // malformed or drifted authority cannot acquire private database locks.
        const guard=createNativeDomainReviewGuard({scopes:[scope],
          readCandidate:async value=>{const owned=await acquire();return owned.readCandidate(value);},
          readAdmission:async value=>{if(!fence)fail('native_domain_review_fence_invalid');return fence.readAdmission(value);},
        });
        const receipt=await guard(input);
        return Object.freeze({receipt,release,async assertAlive(){
          if(released)fail('native_domain_review_fence_closed');
          for(const tool of [toolContext,toolAdmit])if(await installed.authorize(scope,input,tool,{})!==true)fail('native_domain_review_tool_access_denied');
          await fence.assertAlive();
        }});
      } catch(error) {
        try{await release();}catch(releaseError){throw new AggregateError([error,releaseError],'native_domain_review_fence_release_failed');}
        throw error;
      }
    },
  });
}
const flag=process.env.PAPERCLIP_NATIVE_DOMAIN_REVIEW_REQUIRED;
if(flag!==undefined&&flag!=='0'&&flag!=='1')fail('native_domain_review_configuration_invalid');
// Same ESM instance is imported by bootstrap and every native service constructor.
export const nativeDomainReviewComposition=createNativeCaseReviewRouter(createNativeDomainReviewComposition({required:flag==='1'}),createNativeDomainReviewComposition);
