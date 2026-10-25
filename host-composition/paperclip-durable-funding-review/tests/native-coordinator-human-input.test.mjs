import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const host=path.join(root,'node_modules/@paperclipai/server/dist');
const source=await fs.readFile(path.join(host,'services/native-runtime/paperclip-runner-tool-authority.js'),'utf8');
const {resolveInteractionPolicy}=await import(pathToFileURL(path.join(host,'services/issue-thread-interactions.js')));
const {assertIssueThreadInteractionResolverAudience}=await import(pathToFileURL(path.join(host,'services/issue-thread-interaction-resolution.js')));

// Source-boundary contract: invoke the exact installed native request method,
// injecting only persistence/activity boundaries. This does NOT exercise native
// dispatch authorization, SQL transactions, mutation receipts or live delivery.
const start=source.indexOf('    async #requestHumanInput(input, identityContextId) {');
const end=source.indexOf('\n}\nfunction requiredString(',start);
assert(start>0 && end>start,'pinned native method boundaries must remain recognizable');
const method=source.slice(start,end);
const helper=name=>{
 const start=source.indexOf(`function ${name}(`);
 const end=source.indexOf('\n}',start)+2;
 assert(start>=0 && end>start);
 return source.slice(start,end);
};
const makeHarness=new Function('issueThreadInteractionService','persistActivity','publishActivity',`
${helper('record')}
${helper('requiredString')}
${helper('nullableProviderId')}
return class NativeRequestBoundary {
 constructor(binding){this.binding=binding;}
 #withMutationReceipt(_tool,_key,_input,callback){return callback({}, {issue:{id:this.binding.issueId,workMode:'standard'}});}
 invoke(input){return this.#requestHumanInput(input,null);}
${method}
};`);

for(const interactionKind of ['confirmation','checkbox','questions','suggest_tasks','item_verdicts']) {
 for(const restricted of [true,false]) test(`${interactionKind}: ${restricted?'Coordinator human-only':'ordinary inherited'} resolver boundary`,async()=>{
  let captured;
  const Harness=makeHarness(()=>({create:async(_issue,input)=>{captured=input;return {id:'interaction',kind:input.kind,status:'pending'};}}),async()=>({publication:null}),()=>{throw Error('Unexpected publication');});
  const binding={companyId:'company',issueId:'issue',runId:'run',agentId:'agent',...(restricted?{nativeCoordinatorPolicy:{version:1}}:{})};
  const result=await new Harness(binding).invoke({interactionKind,idempotencyKey:'question',title:'Synthetic',prompt:'Synthetic request',continuationPolicy:'wake_assignee',payload:{}});
  assert.equal(result.disposition,'applied');
  assert.equal(Object.hasOwn(captured,'resolverPolicy'),restricted);
  assert.equal(captured.resolverPolicy,restricted?'human_only':undefined);
  for(const governance of [{},{[captured.kind]:{defaultPolicy:'anyone',cap:'anyone'}}]){
   const policy=resolveInteractionPolicy({kind:captured.kind,requested:captured.resolverPolicy,governance,hasToolAction:false,hasSecretProposal:false});
   assert.equal(policy.requestedResolverPolicy,restricted?'human_only':'anyone');
   assert.equal(policy.effectiveResolverPolicy,restricted?'human_only':'anyone');
   assert.equal(policy.resolverPolicyProvenance,restricted?'explicit':'inherited');
   const input={actor:{type:'agent',agentId:'agent',runId:'run'},interaction:{...policy,createdByAgentId:'agent',sourceRunId:'run'}};
   if(restricted)assert.throws(()=>assertIssueThreadInteractionResolverAudience(input),error=>error.status===403 && error.details?.code==='interaction_human_only');
   else assert.equal(assertIssueThreadInteractionResolverAudience(input).allowed,true);
   assert.equal(assertIssueThreadInteractionResolverAudience({...input,actor:{type:'user',userId:'synthetic-human'}}).allowed,true);
  }
 });
}
